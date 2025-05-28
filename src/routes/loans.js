const express = require('express');
const Loan = require('../models/Loan');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validate, 
  loanCreateSchema, 
  loanUpdateSchema, 
  loanApprovalSchema,
  loanQuerySchema 
} = require('../utils/validation');
const { buildPaginationResponse, buildSortObject, buildDateRangeQuery } = require('../utils/helpers');
const AppError = require('../utils/AppError');

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
      .populate('approved_by', 'username real_name')
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

// 获取单个贷款详情
router.get('/:loan_id', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    
    const loan = await Loan.findById(loan_id)
      .populate('applicant_id', 'username real_name email phone')
      .populate('approved_by', 'username real_name');
    
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
      message: '贷款申请创建成功',
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
    
    // 普通用户只能更新自己的待审批贷款
    if (req.user.role !== 'admin') {
      if (loan.applicant_id.toString() !== req.user._id.toString()) {
        return next(new AppError('只能更新自己的贷款', 403, 1003));
      }
      if (loan.status !== 'pending') {
        return next(new AppError('只能更新待审批的贷款', 400, 4000));
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

// 审批贷款 (仅管理员)
router.patch('/:loan_id/approve', authenticate, authorize('admin'), validate(loanApprovalSchema), async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    const { status, remark, approved_amount, approved_rate } = req.body;
    
    const loan = await Loan.findById(loan_id).populate('applicant_id', 'username real_name email');
    
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    if (loan.status !== 'pending') {
      return next(new AppError('只能审批待审核的贷款', 400, 4000));
    }
    
    // 更新贷款状态
    loan.status = status;
    loan.remark = remark;
    loan.approval_date = new Date();
    loan.approved_by = req.user._id;
    
    if (status === 'approved') {
      loan.approved_amount = approved_amount || loan.amount;
      loan.approved_rate = approved_rate || loan.interest_rate;
    }
    
    await loan.save();
    
    // 记录审批日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'loan',
      action: 'approve_loan',
      message: `审批贷款: ${loan.loan_name} - ${status}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        loan_id: loan._id,
        loan_name: loan.loan_name,
        applicant_name: loan.applicant_name,
        approval_status: status,
        approved_amount: loan.approved_amount,
        approved_rate: loan.approved_rate
      }
    });
    
    res.json({
      success: true,
      message: `贷款${status === 'approved' ? '审批通过' : '审批拒绝'}`,
      data: { loan },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 删除贷款
router.delete('/:loan_id', authenticate, async (req, res, next) => {
  try {
    const { loan_id } = req.params;
    
    const loan = await Loan.findById(loan_id);
    
    if (!loan) {
      return next(new AppError('贷款不存在', 404, 4040));
    }
    
    // 普通用户只能删除自己的待审批贷款
    if (req.user.role !== 'admin') {
      if (loan.applicant_id.toString() !== req.user._id.toString()) {
        return next(new AppError('只能删除自己的贷款', 403, 1003));
      }
      if (loan.status !== 'pending') {
        return next(new AppError('只能删除待审批的贷款', 400, 4000));
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

// 获取贷款统计信息 (仅管理员)
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

module.exports = router; 