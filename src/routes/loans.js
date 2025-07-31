const express = require('express');
const Loan = require('../models/Loan');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validate, 
  loanCreateSchema, 
  loanUpdateSchema, 
  loanQuerySchema,
  paymentCreateSchema,
  paymentUpdateSchema,
  repaymentModifySchema
} = require('../utils/validation');
const { buildPaginationResponse, buildSortObject, buildDateRangeQuery } = require('../utils/helpers');
const { 
  calculateEqualInstallment, 
  calculateEqualPrincipal, 
  compareRepaymentMethods,
  calculatePrepayment 
} = require('../utils/loanCalculator');
const PrecisionMath = require('../utils/precisionMath');
const RepaymentSchedule = require('../models/RepaymentSchedule');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');

// 导入控制器方法
const loanController = require('../controllers/loanController');

const router = express.Router();

// 构建贷款查询条件
const buildLoanQuery = (query, user) => {
  const filter = {};
  
  // 普通用户只能查看自己的贷款
  if (user.role !== 'admin') {
    filter.applicant_id = user._id;
  }
  
  // 按申请人ID筛选（管理员功能）
  if (query.applicant_id && user.role === 'admin') {
    filter.applicant_id = query.applicant_id;
  }
  
  // 按状态筛选
  if (query.status) {
    filter.status = query.status;
  }
  
  // 按银行筛选
  if (query.bank) {
    filter.bank = { $regex: query.bank, $options: 'i' };
  }
  
  // 按金额范围筛选
  if (query.amount_min || query.amount_max) {
    filter.amount = {};
    if (query.amount_min) {
      filter.amount.$gte = query.amount_min;
    }
    if (query.amount_max) {
      filter.amount.$lte = query.amount_max;
    }
  }
  
  // 按日期范围筛选
  const dateFilter = buildDateRangeQuery(query.date_from, query.date_to, 'application_date');
  if (Object.keys(dateFilter).length > 0) {
    Object.assign(filter, dateFilter);
  }
  
  // 搜索功能
  if (query.search) {
    filter.$or = [
      { loan_name: { $regex: query.search, $options: 'i' } },
      { bank: { $regex: query.search, $options: 'i' } },
      { applicant_name: { $regex: query.search, $options: 'i' } }
    ];
  }
  
  return filter;
};

// 获取贷款列表
router.get('/', authenticate, validate(loanQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, per_page, sort, ...queryParams } = req.query;
    
    const filter = buildLoanQuery(queryParams, req.user);
    const sortObj = buildSortObject(sort);
    
    // 计算跳过的文档数
    const skip = (page - 1) * per_page;
    
    // 查询贷款列表
    const loans = await Loan.find(filter)
      .populate('applicant_id', 'username real_name email')
      .sort(sortObj)
      .skip(skip)
      .limit(per_page);
    
    // 获取总数
    const total = await Loan.countDocuments(filter);
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'list_loans',
      message: `查看贷款列表`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        filter,
        page,
        per_page,
        total
      }
    });
    
    const responseData = buildPaginationResponse(loans, page, per_page, total);
    
    res.json({
      success: true,
      message: '获取贷款列表成功',
      data: responseData,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 贷款计算API - 在动态路由之前定义
router.post('/calculate', authenticate, async (req, res, next) => {
  try {
    const { amount, interest_rate, term, method } = req.body;
    
    // 验证输入参数
    if (!amount || !interest_rate || !term || !method) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: amount, interest_rate, term, method',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (amount < 1000 || amount > 100000000) {
      return res.status(400).json({
        success: false,
        message: '贷款金额必须在1000-100000000之间',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (interest_rate < 0 || interest_rate > 100) {
      return res.status(400).json({
        success: false,
        message: '利率必须在0-100之间',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (term < 1 || term > 360) {
      return res.status(400).json({
        success: false,
        message: '贷款期限必须在1-360个月之间',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!['equal_payment', 'equal_principal'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: '还款方式必须是equal_payment或equal_principal',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    let calculationResult;
    
    if (method === 'equal_payment') {
      // 等额本息
      calculationResult = calculateEqualInstallment(amount, interest_rate, term);
    } else {
      // 等额本金
      calculationResult = calculateEqualPrincipal(amount, interest_rate, term);
    }
    
    // 记录计算日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'calculate_loan',
      message: `贷款计算: ${method}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        amount,
        interest_rate,
        term,
        method
      }
    });
    
    res.json({
      success: true,
      message: '贷款计算成功',
      data: {
        monthly_payment: calculationResult.monthlyPayment,
        total_payment: calculationResult.totalPayment,
        total_interest: calculationResult.totalInterest,
        method: method
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取贷款统计信息 (仅管理员) - 移到动态路由之前
router.get('/statistics', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await Loan.getStatistics();
    
    res.json({
      success: true,
      message: '获取贷款统计成功',
      data: stats,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个贷款详情
router.get('/:loan_id', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    
    const loan = await Loan.findById(loan_id)
      .populate('applicant_id', 'username real_name email phone');
    
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 普通用户只能查看自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id._id.toString() !== req.user._id.toString()) {
      return next(new AppError('只能查看自己的贷款', 403, 1003));
    }
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'view_loan',
      message: `查看贷款详情: ${loan.loan_name}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        loan_name: loan.loan_name
      }
    });
    
    res.json({
      success: true,
      message: '获取贷款详情成功',
      data: { loan },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 创建贷款申请
router.post('/', authenticate, validate(loanCreateSchema), async (req, res, next) => {
  try {
    const {
      loan_name,
      applicant_name,
      amount,
      interest_rate,
      bank,
      term,
      repayment_method,
      purpose,
      collateral,
      attachments
    } = req.body;
    
    // 创建贷款申请 - 使用前端发送的申请人姓名，如果没有则使用当前用户姓名
    const loan = new Loan({
      loan_name,
      applicant_id: req.user._id,
      applicant_name: applicant_name || req.user.real_name || req.user.username,
      amount,
      interest_rate,
      bank,
      term,
      repayment_method,
      purpose,
      collateral,
      attachments: attachments || []
    });
    
    await loan.save();
    
    // 自动生成还款计划（无需审查）
    try {
      await loan.generateRepaymentSchedule();
      await loan.save();
    } catch (scheduleError) {
      console.error('生成还款计划失败:', scheduleError);
      // 贷款创建成功，但还款计划生成失败，记录警告
    }
    
    // 记录创建日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'create_loan',
      message: `创建贷款申请: ${loan_name}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 201,
      metadata: {
        loan_id: loan._id,
        loan_name: loan.loan_name,
        amount: loan.amount,
        applicant_name: loan.applicant_name
      }
    });
    
    res.status(201).json({
      success: true,
      message: '贷款创建成功',
      data: { loan },
      code: 201,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 更新贷款信息
router.put('/:loan_id', authenticate, validate(loanUpdateSchema), async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    
    const loan = await Loan.findById(loan_id);
    
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 普通用户只能更新自己的贷款
    if (req.user.role !== 'admin') {
      if (loan.applicant_id.toString() !== req.user._id.toString()) {
        return next(new AppError('只能更新自己的贷款', 403, 1003));
      }
    }
    
    // 更新贷款信息
    const updateData = {};
    const allowedFields = [
      'loan_name', 'applicant_name', 'amount', 'interest_rate', 'bank', 
      'term', 'repayment_method', 'purpose', 'collateral', 'attachments'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    const updatedLoan = await Loan.findByIdAndUpdate(
      loan_id,
      updateData,
      { new: true, runValidators: true }
    ).populate('applicant_id', 'username real_name email');
    
    // 如果关键参数发生变化，重新生成还款计划
    const keyFields = ['amount', 'interest_rate', 'term', 'repayment_method'];
    const hasKeyChanges = keyFields.some(field => req.body[field] !== undefined);
    
    if (hasKeyChanges) {
      try {
        await updatedLoan.generateRepaymentSchedule();
        await updatedLoan.save();
      } catch (scheduleError) {
        console.error('重新生成还款计划失败:', scheduleError);
      }
    }
    
    // 记录更新日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'update_loan',
      message: `更新贷款信息: ${updatedLoan.loan_name}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: updatedLoan._id,
        updated_fields: Object.keys(updateData)
      }
    });

    res.json({
      success: true,
      message: '贷款信息更新成功',
      data: { loan: updatedLoan },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 审查功能已移除 - 贷款创建后自动生成还款计划

// 删除贷款
router.delete('/:loan_id', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    
    const loan = await Loan.findById(loan_id);
    
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 普通用户只能删除自己的贷款
    if (req.user.role !== 'admin') {
      if (loan.applicant_id.toString() !== req.user._id.toString()) {
        return next(new AppError('只能删除自己的贷款', 403, 1003));
      }
      // 如果贷款已有还款记录，不允许删除
      const paidSchedules = await RepaymentSchedule.findOne({
        loan_id,
        status: 'paid'
      });
      
      if (paidSchedules) {
        return next(new AppError('已有还款记录的贷款不能删除', 400, 4000));
      }
    }
    
    await Loan.findByIdAndDelete(loan_id);
    
    // 记录删除日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'loan',
      action: 'delete_loan',
      message: `删除贷款: ${loan.loan_name}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        loan_name: loan.loan_name
      }
    });
    
    res.json({
      success: true,
      message: '贷款删除成功',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 等额本息还款计算
router.post('/calculate/equal-installment', authenticate, async (req, res, next) => {
  try {
    const { principal, annual_rate, months } = req.body;
    
    // 参数验证
    if (!principal || !annual_rate || !months) {
      return next(new AppError('请提供完整的计算参数', 400, 4000));
    }
    
    const P = PrecisionMath.safeDecimal(principal);
    const r = PrecisionMath.safeDecimal(annual_rate);
    const n = PrecisionMath.safeDecimal(months);
    
    if (!PrecisionMath.greaterThan(P, 0) || PrecisionMath.lessThan(r, 0) || !PrecisionMath.greaterThan(n, 0)) {
      return next(new AppError('参数错误：本金必须大于0，利率不能为负数，期数必须大于0', 400, 4000));
    }
    
    // 使用高精度计算
    const annualRateDecimal = PrecisionMath.divide(r, 100);
    const monthlyPayment = PrecisionMath.calculateEqualInstallment(
      PrecisionMath.toNumber(P), 
      PrecisionMath.toNumber(annualRateDecimal), 
      PrecisionMath.toNumber(n)
    );
    const totalPayment = PrecisionMath.multiply(monthlyPayment, n);
    const totalInterest = PrecisionMath.subtract(totalPayment, P);
    
    // 生成详细还款计划
    const schedule = [];
    let remainingPrincipal = P;
    const monthlyRate = PrecisionMath.divide(annualRateDecimal, 12);
    
    for (let i = 1; i <= PrecisionMath.toNumber(n); i++) {
      const interestPayment = PrecisionMath.multiply(remainingPrincipal, monthlyRate);
      const principalPayment = PrecisionMath.subtract(monthlyPayment, interestPayment);
      remainingPrincipal = PrecisionMath.subtract(remainingPrincipal, principalPayment);
      
      schedule.push({
        period: i,
        monthlyPayment: PrecisionMath.toNumber(PrecisionMath.round(monthlyPayment)),
        principalPayment: PrecisionMath.toNumber(PrecisionMath.round(principalPayment)),
        interestPayment: PrecisionMath.toNumber(PrecisionMath.round(interestPayment)),
        remainingPrincipal: PrecisionMath.toNumber(PrecisionMath.round(remainingPrincipal))
      });
    }
    
    const result = {
      type: 'equalInstallment',
      principal: PrecisionMath.toNumber(P),
      annualRate: PrecisionMath.toNumber(r),
      months: PrecisionMath.toNumber(n),
      monthlyPayment: PrecisionMath.toNumber(PrecisionMath.round(monthlyPayment)),
      totalPayment: PrecisionMath.toNumber(PrecisionMath.round(totalPayment)),
      totalInterest: PrecisionMath.toNumber(PrecisionMath.round(totalInterest)),
      schedule
    };
    
    // 记录计算日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'calculate_equal_installment',
      message: `计算等额本息还款`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        principal: result.principal,
        annual_rate: result.annualRate,
        months: result.months,
        monthly_payment: result.monthlyPayment,
        total_payment: result.totalPayment,
        total_interest: result.totalInterest
      }
    });
    
    res.json({
      success: true,
      message: '等额本息还款计算成功',
      data: result,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 等额本金还款计算
router.post('/calculate/equal-principal', authenticate, async (req, res, next) => {
  try {
    const { principal, annual_rate, months } = req.body;
    
    // 参数验证
    if (!principal || !annual_rate || !months) {
      return next(new AppError('请提供完整的计算参数', 400, 4000));
    }
    
    const P = PrecisionMath.safeDecimal(principal);
    const r = PrecisionMath.safeDecimal(annual_rate);
    const n = PrecisionMath.safeDecimal(months);
    
    if (!PrecisionMath.greaterThan(P, 0) || PrecisionMath.lessThan(r, 0) || !PrecisionMath.greaterThan(n, 0)) {
      return next(new AppError('参数错误：本金必须大于0，利率不能为负数，期数必须大于0', 400, 4000));
    }
    
    // 使用高精度计算
    const annualRateDecimal = PrecisionMath.divide(r, 100);
    const monthlyPrincipal = PrecisionMath.divide(P, n);
    const monthlyRate = PrecisionMath.divide(annualRateDecimal, 12);
    
    // 计算首月还款
    const firstMonthInterest = PrecisionMath.multiply(P, monthlyRate);
    const firstMonthPayment = PrecisionMath.add(monthlyPrincipal, firstMonthInterest);
    
    // 计算末月还款
    const lastMonthPrincipal = PrecisionMath.subtract(P, PrecisionMath.multiply(monthlyPrincipal, PrecisionMath.subtract(n, 1)));
    const lastMonthInterest = PrecisionMath.multiply(lastMonthPrincipal, monthlyRate);
    const lastMonthPayment = PrecisionMath.add(monthlyPrincipal, lastMonthInterest);
    
    // 生成详细还款计划
    const schedule = [];
    let remainingPrincipal = P;
    let totalPayment = PrecisionMath.decimal(0);
    let totalInterest = PrecisionMath.decimal(0);
    
    for (let i = 1; i <= PrecisionMath.toNumber(n); i++) {
      const interestPayment = PrecisionMath.multiply(remainingPrincipal, monthlyRate);
      const totalMonthlyPayment = PrecisionMath.add(monthlyPrincipal, interestPayment);
      remainingPrincipal = PrecisionMath.subtract(remainingPrincipal, monthlyPrincipal);
      
      totalPayment = PrecisionMath.add(totalPayment, totalMonthlyPayment);
      totalInterest = PrecisionMath.add(totalInterest, interestPayment);
      
      schedule.push({
        period: i,
        monthlyPayment: PrecisionMath.toNumber(PrecisionMath.round(totalMonthlyPayment)),
        principalPayment: PrecisionMath.toNumber(PrecisionMath.round(monthlyPrincipal)),
        interestPayment: PrecisionMath.toNumber(PrecisionMath.round(interestPayment)),
        remainingPrincipal: PrecisionMath.toNumber(PrecisionMath.round(remainingPrincipal))
      });
    }
    
    const result = {
      type: 'equalPrincipal',
      principal: PrecisionMath.toNumber(P),
      annualRate: PrecisionMath.toNumber(r),
      months: PrecisionMath.toNumber(n),
      monthlyPrincipal: PrecisionMath.toNumber(PrecisionMath.round(monthlyPrincipal)),
      firstMonthPayment: PrecisionMath.toNumber(PrecisionMath.round(firstMonthPayment)),
      lastMonthPayment: PrecisionMath.toNumber(PrecisionMath.round(lastMonthPayment)),
      totalPayment: PrecisionMath.toNumber(PrecisionMath.round(totalPayment)),
      totalInterest: PrecisionMath.toNumber(PrecisionMath.round(totalInterest)),
      schedule
    };
    
    // 记录计算日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'calculate_equal_principal',
      message: `计算等额本金还款`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        principal: result.principal,
        annual_rate: result.annualRate,
        months: result.months,
        monthly_principal: result.monthlyPrincipal,
        first_month_payment: result.firstMonthPayment,
        last_month_payment: result.lastMonthPayment,
        total_payment: result.totalPayment,
        total_interest: result.totalInterest
      }
    });
    
    res.json({
      success: true,
      message: '等额本金还款计算成功',
      data: result,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 比较两种还款方式
router.post('/calculate/compare', authenticate, async (req, res, next) => {
  try {
    const { principal, annual_rate, months } = req.body;
    
    // 参数验证
    if (!principal || !annual_rate || !months) {
      return next(new AppError('请提供完整的计算参数', 400, 4000));
    }
    
    const P = PrecisionMath.safeDecimal(principal);
    const r = PrecisionMath.safeDecimal(annual_rate);
    const n = PrecisionMath.safeDecimal(months);
    
    if (!PrecisionMath.greaterThan(P, 0) || PrecisionMath.lessThan(r, 0) || !PrecisionMath.greaterThan(n, 0)) {
      return next(new AppError('参数错误：本金必须大于0，利率不能为负数，期数必须大于0', 400, 4000));
    }
    
    // 高精度计算等额本息
    const annualRateDecimal = PrecisionMath.divide(r, 100);
    const monthlyPaymentInstallment = PrecisionMath.calculateEqualInstallment(
      PrecisionMath.toNumber(P), 
      PrecisionMath.toNumber(annualRateDecimal), 
      PrecisionMath.toNumber(n)
    );
    const totalPaymentInstallment = PrecisionMath.multiply(monthlyPaymentInstallment, n);
    const totalInterestInstallment = PrecisionMath.subtract(totalPaymentInstallment, P);
    
    // 高精度计算等额本金
    const monthlyPrincipal = PrecisionMath.divide(P, n);
    const monthlyRate = PrecisionMath.divide(annualRateDecimal, 12);
    
    let totalPaymentPrincipal = PrecisionMath.decimal(0);
    let totalInterestPrincipal = PrecisionMath.decimal(0);
    let remainingPrincipal = P;
    
    for (let i = 1; i <= PrecisionMath.toNumber(n); i++) {
      const interestPayment = PrecisionMath.multiply(remainingPrincipal, monthlyRate);
      const totalMonthlyPayment = PrecisionMath.add(monthlyPrincipal, interestPayment);
      
      totalPaymentPrincipal = PrecisionMath.add(totalPaymentPrincipal, totalMonthlyPayment);
      totalInterestPrincipal = PrecisionMath.add(totalInterestPrincipal, interestPayment);
      remainingPrincipal = PrecisionMath.subtract(remainingPrincipal, monthlyPrincipal);
    }
    
    // 计算首月和末月还款
    const firstMonthInterest = PrecisionMath.multiply(P, monthlyRate);
    const firstMonthPayment = PrecisionMath.add(monthlyPrincipal, firstMonthInterest);
    
    const lastMonthPrincipal = PrecisionMath.subtract(P, PrecisionMath.multiply(monthlyPrincipal, PrecisionMath.subtract(n, 1)));
    const lastMonthInterest = PrecisionMath.multiply(lastMonthPrincipal, monthlyRate);
    const lastMonthPayment = PrecisionMath.add(monthlyPrincipal, lastMonthInterest);
    
    // 计算差异
    const interestDifference = PrecisionMath.subtract(totalInterestInstallment, totalInterestPrincipal);
    const paymentDifference = PrecisionMath.subtract(monthlyPaymentInstallment, firstMonthPayment);
    
    const result = {
      equalInstallment: {
        type: 'equalInstallment',
        monthlyPayment: PrecisionMath.toNumber(PrecisionMath.round(monthlyPaymentInstallment)),
        totalPayment: PrecisionMath.toNumber(PrecisionMath.round(totalPaymentInstallment)),
        totalInterest: PrecisionMath.toNumber(PrecisionMath.round(totalInterestInstallment))
      },
      equalPrincipal: {
        type: 'equalPrincipal',
        monthlyPrincipal: PrecisionMath.toNumber(PrecisionMath.round(monthlyPrincipal)),
        firstMonthPayment: PrecisionMath.toNumber(PrecisionMath.round(firstMonthPayment)),
        lastMonthPayment: PrecisionMath.toNumber(PrecisionMath.round(lastMonthPayment)),
        totalPayment: PrecisionMath.toNumber(PrecisionMath.round(totalPaymentPrincipal)),
        totalInterest: PrecisionMath.toNumber(PrecisionMath.round(totalInterestPrincipal))
      },
      comparison: {
        interestDifference: PrecisionMath.toNumber(PrecisionMath.round(interestDifference)),
        paymentDifference: PrecisionMath.toNumber(PrecisionMath.round(paymentDifference)),
        recommendation: PrecisionMath.greaterThan(interestDifference, 0) ? 'equalPrincipal' : 'equalInstallment'
      }
    };
    
    // 记录计算日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'compare_repayment_methods',
      message: `比较两种还款方式`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        principal: PrecisionMath.toNumber(P),
        annual_rate: PrecisionMath.toNumber(r),
        months: PrecisionMath.toNumber(n),
        interest_difference: result.comparison.interestDifference,
        payment_difference: result.comparison.paymentDifference
      }
    });
    
    res.json({
      success: true,
      message: '还款方式比较成功',
      data: result,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 提前还款计算
router.post('/calculate/prepayment', authenticate, async (req, res, next) => {
  try {
    const { 
      principal, 
      annual_rate, 
      original_months, 
      paid_months, 
      prepayment_amount, 
      repayment_type = 'equalInstallment' 
    } = req.body;
    
    // 参数验证
    if (!principal || !annual_rate || !original_months || !paid_months || !prepayment_amount) {
      return next(new AppError('请提供完整的计算参数', 400, 4000));
    }
    
    if (principal <= 0 || annual_rate < 0 || original_months <= 0 || paid_months < 0 || prepayment_amount <= 0) {
      return next(new AppError('参数错误：请检查所有参数的有效性', 400, 4000));
    }
    
    if (paid_months >= original_months) {
      return next(new AppError('已还期数不能大于等于总期数', 400, 4000));
    }
    
    const result = calculatePrepayment(
      principal, 
      annual_rate, 
      original_months, 
      paid_months, 
      prepayment_amount, 
      repayment_type
    );
    
    // 记录计算日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'calculate_prepayment',
      message: `计算提前还款`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        principal,
        annual_rate,
        original_months,
        paid_months,
        prepayment_amount,
        repayment_type,
        saved_interest: result.savedInterest,
        type: result.type
      }
    });
    
    res.json({
      success: true,
      message: '提前还款计算成功',
      data: result,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取贷款还款计划
router.get('/:loan_id/repayment-schedule', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    const { page = 1, per_page = 50, status } = req.query;
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('只能查看自己的贷款还款计划', 403, 1003));
    }
    
    // 构建查询条件
    const filter = { loan_id };
    if (status) {
      filter.status = status;
    }
    
    const skip = (page - 1) * per_page;
    
    // 查询还款计划
    const schedule = await RepaymentSchedule.find(filter)
      .sort({ period_number: 1 })
      .skip(skip)
      .limit(per_page);
    
    const total = await RepaymentSchedule.countDocuments(filter);
    
    // 获取还款统计
    const stats = await RepaymentSchedule.getLoanPaymentStats(loan_id);
    
    const responseData = buildPaginationResponse(schedule, page, per_page, total);
    responseData.payment_stats = stats;
    
    res.json({
      success: true,
      message: '获取还款计划成功',
      data: responseData,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 简化的记录还款路由 (前端兼容)
router.post('/:loan_id/payments', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    const { 
      period_number,
      paid_amount, 
      payment_method, 
      transaction_id, 
      notes, 
      paid_date 
    } = req.body;
    
    // 参数验证
    if (!period_number) {
      return next(new AppError('期数是必填的', 400, 4000));
    }
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查：管理员可以操作所有贷款，普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('您只能操作自己的贷款', 403, 1003));
    }
    
    const schedule = await RepaymentSchedule.findOne({
      loan_id,
      period_number: parseInt(period_number)
    });
    
    if (!schedule) {
      return next(new AppError('还款计划不存在', 404, 4040));
    }
    
    if (schedule.status === 'paid') {
      return next(new AppError('该期已经还款', 400, 4000));
    }
    
    // 验证还款金额
    if (!paid_amount || paid_amount <= 0) {
      return next(new AppError('还款金额必须大于0', 400, 4000));
    }
    
    const remainingAmount = schedule.total_amount - schedule.paid_amount;
    if (paid_amount > remainingAmount) {
      return next(new AppError('还款金额超过应还金额', 400, 4000));
    }
    
    // 记录还款
    const paymentData = {
      paid_date: paid_date ? new Date(paid_date) : new Date(),
      payment_method,
      transaction_id,
      notes,
      updated_by: req.user._id
    };
    
    if (paid_amount >= remainingAmount) {
      // 全额还款
      schedule.markAsPaid(paymentData);
    } else {
      // 部分还款
      schedule.makePartialPayment(paid_amount, paymentData);
    }
    
    await schedule.save();
    
    // 更新贷款的还款状态
    await loan.updatePaymentStatus();
    
    // 记录操作日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'record_payment',
      message: `记录贷款还款: ${loan.loan_name} 第${period_number}期`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        period_number: parseInt(period_number),
        paid_amount,
        payment_method,
        transaction_id
      }
    });
    
    res.json({
      success: true,
      message: '还款记录成功',
      data: { 
        schedule,
        loan_status: {
          repayment_status: loan.repayment_status,
          total_paid_amount: loan.total_paid_amount,
          paid_periods: loan.paid_periods,
          payment_progress: loan.payment_progress
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 记录还款 (详细路由)
router.post('/:loan_id/repayment-schedule/:period_number/payment', authenticate, async (req, res, next) => {
  try {
    const { loan_id, period_number } = req.params;
    const { 
      paid_amount, 
      payment_method, 
      transaction_id, 
      notes, 
      paid_date 
    } = req.body;
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查：管理员可以记录所有贷款的还款，普通用户只能记录自己的贷款
    if (req.user.role !== 'admin' && loan.user_id.toString() !== req.user._id.toString()) {
      return next(new AppError('您只能操作自己的贷款', 403, 1003));
    }
    
    const schedule = await RepaymentSchedule.findOne({
      loan_id,
      period_number: parseInt(period_number)
    });
    
    if (!schedule) {
      return next(new AppError('还款计划不存在', 404, 4040));
    }
    
    if (schedule.status === 'paid') {
      return next(new AppError('该期已经还款', 400, 4000));
    }
    
    // 验证还款金额
    if (!paid_amount || paid_amount <= 0) {
      return next(new AppError('还款金额必须大于0', 400, 4000));
    }
    
    const remainingAmount = schedule.total_amount - schedule.paid_amount;
    if (paid_amount > remainingAmount) {
      return next(new AppError('还款金额超过应还金额', 400, 4000));
    }
    
    // 记录还款
    const paymentData = {
      paid_date: paid_date ? new Date(paid_date) : new Date(),
      payment_method,
      transaction_id,
      notes,
      updated_by: req.user._id
    };
    
    if (paid_amount >= remainingAmount) {
      // 全额还款
      schedule.markAsPaid(paymentData);
    } else {
      // 部分还款
      schedule.makePartialPayment(paid_amount, paymentData);
    }
    
    await schedule.save();
    
    // 更新贷款的还款状态
    await loan.updatePaymentStatus();
    
    // 记录操作日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'record_payment',
      message: `记录贷款还款: ${loan.loan_name} 第${period_number}期`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        period_number: parseInt(period_number),
        paid_amount,
        payment_method,
        transaction_id
      }
    });
    
    res.json({
      success: true,
      message: '还款记录成功',
      data: { 
        schedule,
        loan_status: {
          repayment_status: loan.repayment_status,
          total_paid_amount: loan.total_paid_amount,
          paid_periods: loan.paid_periods,
          payment_progress: loan.payment_progress
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取还款历史记录 (前端兼容)
router.get('/:loan_id/payments', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    const { page = 1, per_page = 50, status } = req.query;
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('只能查看自己的贷款还款记录', 403, 1003));
    }
    
    // 构建查询条件
    const filter = { loan_id };
    if (status) {
      filter.status = status;
    }
    
    const skip = (page - 1) * per_page;
    
    // 查询还款记录
    const payments = await RepaymentSchedule.find(filter)
      .sort({ period_number: 1 })
      .skip(skip)
      .limit(per_page);
    
    const total = await RepaymentSchedule.countDocuments(filter);
    
    // 获取还款统计
    const stats = await RepaymentSchedule.getLoanPaymentStats(loan_id);
    
    const responseData = buildPaginationResponse(payments, page, per_page, total);
    responseData.payment_stats = stats;
    
    res.json({
      success: true,
      message: '获取还款记录成功',
      data: responseData,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取贷款还款统计
router.get('/:loan_id/payment-stats', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('只能查看自己的贷款统计', 403, 1003));
    }
    
    const stats = await RepaymentSchedule.getLoanPaymentStats(loan_id);
    
    // 获取逾期的还款计划
    const overdueSchedules = await RepaymentSchedule.find({
      loan_id,
      status: 'overdue'
    }).sort({ period_number: 1 });
    
    // 获取下期还款信息
    const nextPayment = await RepaymentSchedule.findOne({
      loan_id,
      status: { $in: ['pending', 'overdue', 'partial'] }
    }).sort({ period_number: 1 });
    
    const result = {
      loan_info: {
        loan_name: loan.loan_name,
        total_payment: loan.total_payment,
        repayment_status: loan.repayment_status,
        payment_progress: loan.payment_progress,
        remaining_amount: loan.remaining_amount
      },
      payment_stats: stats,
      overdue_schedules: overdueSchedules,
      next_payment: nextPayment
    };
    
    res.json({
      success: true,
      message: '获取还款统计成功',
      data: result,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 为贷款生成还款计划（用户和管理员都可以使用）
router.post('/:loan_id/generate-schedule', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    const { start_date } = req.body;
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查：普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('只能操作自己的贷款', 403, 1003));
    }
    
    // 检查是否已有还款记录
    const paidSchedules = await RepaymentSchedule.findOne({
      loan_id,
      status: 'paid'
    });
    
    if (paidSchedules) {
      return next(new AppError('已有还款记录，无法重新生成还款计划', 400, 4000));
    }
    
    // 设置还款开始日期
    if (start_date) {
      loan.repayment_start_date = new Date(start_date);
    }
    
    // 生成还款计划
    const calculationResult = await loan.generateRepaymentSchedule();
    await loan.save();
    
    // 记录操作日志
    await SystemLog.createLog({
      level: 'info',
      module: 'loan',
      action: 'generate_schedule',
      message: `生成还款计划: ${loan.loan_name}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        start_date: loan.repayment_start_date
      }
    });
    
    res.json({
      success: true,
      message: '还款计划生成成功',
      data: { 
        loan,
        calculation_result: calculationResult
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 批量修改还款计划（必须在单期修改之前）
router.put('/:loan_id/repayment-schedule/batch', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    const { schedules } = req.body;
    
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return next(new AppError('请提供要修改的还款计划数据', 400, 4000));
    }
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查：管理员可以操作所有贷款，普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('您只能操作自己的贷款', 403, 1003));
    }
    
    const results = [];
    const errors = [];
    
    // 开启事务
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      for (const scheduleData of schedules) {
        const { period_number, due_date, total_amount, principal_amount, interest_amount, notes, late_fee } = scheduleData;
        
        if (!period_number || isNaN(parseInt(period_number))) {
          errors.push({ period_number: period_number || null, error: '期数是必填的且必须是有效数字' });
          continue;
        }
        
        const periodNum = parseInt(period_number);
        const schedule = await RepaymentSchedule.findOne({
          loan_id,
          period_number: periodNum
        }).session(session);
        
        if (!schedule) {
          errors.push({ period_number: periodNum, error: '还款计划不存在' });
          continue;
        }
        
        if (schedule.status === 'paid') {
          errors.push({ period_number: periodNum, error: '已完成还款的记录不能修改' });
          continue;
        }
        
        // 准备更新数据
        const updateData = {
          updated_by: req.user._id
        };
        
        if (due_date !== undefined) updateData.due_date = new Date(due_date);
        if (total_amount !== undefined) updateData.total_amount = total_amount;
        if (principal_amount !== undefined) updateData.principal_amount = principal_amount;
        if (interest_amount !== undefined) updateData.interest_amount = interest_amount;
        if (late_fee !== undefined) updateData.late_fee = late_fee;
        if (notes !== undefined) updateData.notes = notes;
        
        // 验证数据一致性
        if (total_amount !== undefined || principal_amount !== undefined || interest_amount !== undefined) {
          const newPrincipal = updateData.principal_amount ?? schedule.principal_amount;
          const newInterest = updateData.interest_amount ?? schedule.interest_amount;
          const newTotal = updateData.total_amount ?? schedule.total_amount;
          
          if (Math.abs((newPrincipal + newInterest) - newTotal) > 0.01) {
            errors.push({ period_number: periodNum, error: '本金和利息之和必须等于总还款额' });
            continue;
          }
          
          if (schedule.paid_amount > newTotal) {
            errors.push({ period_number: periodNum, error: '修改后的应还金额不能小于已还金额' });
            continue;
          }
          
          // 重新计算已还本金和利息的分配
          if (schedule.paid_amount > 0) {
            const paymentRatio = schedule.paid_amount / newTotal;
            updateData.paid_principal = Math.min(newPrincipal, newPrincipal * paymentRatio);
            updateData.paid_interest = Math.min(newInterest, newInterest * paymentRatio);
          }
        }
        
        // 更新还款计划
        const updatedSchedule = await RepaymentSchedule.findOneAndUpdate(
          { loan_id, period_number: periodNum },
          updateData,
          { new: true, runValidators: true, session }
        );
        
        results.push(updatedSchedule);
      }
      
      // 如果有错误，回滚事务
      if (errors.length > 0 && results.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: '批量修改失败',
          data: { errors },
          code: 4000,
          timestamp: new Date().toISOString()
        });
      }
      
      // 重新计算贷款状态
      await loan.updatePaymentStatus();
      
      await session.commitTransaction();
      
      // 记录操作日志
      await SystemLog.createLog({
        level: 'warning',
        module: 'loan',
        action: 'batch_modify_repayment_schedule',
        message: `批量修改还款计划: ${loan.loan_name}`,
        user_id: req.user._id,
        username: req.user.username,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        request_method: req.method,
        request_url: req.originalUrl,
        response_status: 200,
        metadata: {
          loan_id: loan._id,
          modified_periods: results.map(r => r.period_number),
          success_count: results.length,
          error_count: errors.length
        }
      });
      
      res.json({
        success: true,
        message: `批量修改完成，成功${results.length}条，失败${errors.length}条`,
        data: { 
          modified_schedules: results,
          errors: errors,
          loan_status: {
            repayment_status: loan.repayment_status,
            total_paid_amount: loan.total_paid_amount,
            paid_periods: loan.paid_periods,
            payment_progress: loan.payment_progress
          }
        },
        code: 200,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    next(error);
  }
});

// 修改还款计划
router.put('/:loan_id/repayment-schedule/:period_number', authenticate, async (req, res, next) => {
  try {
    const { loan_id, period_number } = req.params;
    const { 
      due_date, 
      total_amount, 
      principal_amount, 
      interest_amount,
      notes,
      late_fee
    } = req.body;
    
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 权限检查：管理员可以操作所有贷款，普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return next(new AppError('您只能操作自己的贷款', 403, 1003));
    }
    
    const schedule = await RepaymentSchedule.findOne({
      loan_id,
      period_number: parseInt(period_number)
    });
    
    if (!schedule) {
      return next(new AppError('还款计划不存在', 404, 4040));
    }
    
    // 不允许修改已经还款完成的记录
    if (schedule.status === 'paid') {
      return next(new AppError('已完成还款的记录不能修改', 400, 4000));
    }
    
    // 准备更新数据
    const updateData = {
      updated_by: req.user._id
    };
    
    // 如果修改了金额相关字段，需要重新计算
    let needRecalculate = false;
    
    if (due_date !== undefined) {
      updateData.due_date = new Date(due_date);
    }
    
    if (total_amount !== undefined) {
      updateData.total_amount = total_amount;
      needRecalculate = true;
    }
    
    if (principal_amount !== undefined) {
      updateData.principal_amount = principal_amount;
      needRecalculate = true;
    }
    
    if (interest_amount !== undefined) {
      updateData.interest_amount = interest_amount;
      needRecalculate = true;
    }
    
    if (late_fee !== undefined) {
      updateData.late_fee = late_fee;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    // 如果修改了金额，需要验证数据一致性
    if (needRecalculate) {
      const newPrincipal = updateData.principal_amount ?? schedule.principal_amount;
      const newInterest = updateData.interest_amount ?? schedule.interest_amount;
      const newTotal = updateData.total_amount ?? schedule.total_amount;
      
      // 验证本金+利息=总额
      if (Math.abs((newPrincipal + newInterest) - newTotal) > 0.01) {
        return next(new AppError('本金和利息之和必须等于总还款额', 400, 4000));
      }
      
      // 如果已有部分还款，需要验证已还金额不超过新的应还总额
      if (schedule.paid_amount > newTotal) {
        return next(new AppError('修改后的应还金额不能小于已还金额', 400, 4000));
      }
      
      // 重新计算已还本金和利息的分配
      if (schedule.paid_amount > 0) {
        const paymentRatio = schedule.paid_amount / newTotal;
        updateData.paid_principal = Math.min(newPrincipal, newPrincipal * paymentRatio);
        updateData.paid_interest = Math.min(newInterest, newInterest * paymentRatio);
      }
    }
    
    // 更新还款计划
    const updatedSchedule = await RepaymentSchedule.findOneAndUpdate(
      { loan_id, period_number: parseInt(period_number) },
      updateData,
      { new: true, runValidators: true }
    );
    
    // 如果修改了金额，需要重新计算贷款的总体状态
    if (needRecalculate) {
      await loan.updatePaymentStatus();
    }
    
    // 记录操作日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'loan',
      action: 'modify_repayment_schedule',
      message: `修改还款计划: ${loan.loan_name} 第${period_number}期`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        period_number: parseInt(period_number),
        original_data: {
          due_date: schedule.due_date,
          total_amount: schedule.total_amount,
          principal_amount: schedule.principal_amount,
          interest_amount: schedule.interest_amount
        },
        updated_fields: Object.keys(updateData)
      }
    });
    
    res.json({
      success: true,
      message: '还款计划修改成功',
      data: { 
        schedule: updatedSchedule,
        loan_status: {
          repayment_status: loan.repayment_status,
          total_paid_amount: loan.total_paid_amount,
          paid_periods: loan.paid_periods,
          payment_progress: loan.payment_progress
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 添加控制器路由（按照文档要求）
// 还款计划和统计
router.get('/:loanId/repayment-schedule', authenticate, loanController.getRepaymentSchedule);
router.get('/:loanId/payment-stats', authenticate, loanController.getPaymentStats);

// 还款记录和修改（已移除管理员限制，添加资源所有权检查）
router.post('/:loanId/payments', authenticate, loanController.recordPayment);
router.put('/:loanId/repayment-schedule/:periodNumber', authenticate, loanController.modifySchedulePeriod);
router.put('/:loanId/repayment-schedule/batch', authenticate, loanController.batchModifySchedule);

module.exports = router; 