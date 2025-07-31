const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const RepaymentSchedule = require('../models/RepaymentSchedule');
const Payment = require('../models/Payment');
const { generateRepaymentSchedule } = require('../utils/repaymentCalculator');
const PrecisionMath = require('../utils/precisionMath');

// 获取还款计划
exports.getRepaymentSchedule = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { page = 1, per_page = 50, status } = req.query;

    // 验证贷款是否存在
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '贷款不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // 如果还款计划不存在，自动生成
    let scheduleCount = await RepaymentSchedule.countDocuments({ loan_id: loanId });
    if (scheduleCount === 0) {
      console.log('还款计划不存在，开始生成...');
      await generateRepaymentSchedule(loan);
    }

    // 构建查询条件
    const query = { loan_id: loanId };
    if (status) {
      query.status = status;
    }

    // 分页查询
    const skip = (page - 1) * per_page;
    const schedules = await RepaymentSchedule.find(query)
      .sort({ period_number: 1 })
      .skip(skip)
      .limit(parseInt(per_page));

    const total = await RepaymentSchedule.countDocuments(query);

    res.status(200).json({
      success: true,
      message: '获取还款计划成功',
      data: {
        items: schedules,
        pagination: {
          page: parseInt(page),
          per_page: parseInt(per_page),
          total,
          total_pages: Math.ceil(total / per_page)
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取还款计划失败:', error);
    res.status(500).json({
      success: false,
      message: '获取还款计划失败',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
};

// 获取还款统计
exports.getPaymentStats = async (req, res, next) => {
  try {
    const { loanId } = req.params;

    // 验证贷款是否存在
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '贷款不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // 如果还款计划不存在，自动生成
    let scheduleCount = await RepaymentSchedule.countDocuments({ loan_id: loanId });
    if (scheduleCount === 0) {
      await generateRepaymentSchedule(loan);
    }

    // 统计各种状态的期数
    const totalPeriods = await RepaymentSchedule.countDocuments({ loan_id: loanId });
    const paidPeriods = await RepaymentSchedule.countDocuments({ 
      loan_id: loanId, 
      status: 'paid' 
    });
    const overduePeriods = await RepaymentSchedule.countDocuments({ 
      loan_id: loanId, 
      status: 'overdue' 
    });

    // 计算详细统计数据
    const allSchedules = await RepaymentSchedule.find({ loan_id: loanId });
    
    let totalAmount = PrecisionMath.decimal(0);
    let paidAmount = PrecisionMath.decimal(0);
    
    allSchedules.forEach(schedule => {
      const scheduleTotal = PrecisionMath.safeDecimal(schedule.total_amount);
      const schedulePaid = PrecisionMath.safeDecimal(schedule.actual_paid_amount || 0);
      
      totalAmount = PrecisionMath.add(totalAmount, scheduleTotal);
      paidAmount = PrecisionMath.add(paidAmount, schedulePaid);
    });
    
    const remainingAmount = PrecisionMath.subtract(totalAmount, paidAmount);
    const paymentProgress = PrecisionMath.greaterThan(totalAmount, 0) ? 
      PrecisionMath.toNumber(PrecisionMath.multiply(PrecisionMath.divide(paidAmount, totalAmount), 100)) : 0;

    const stats = {
      total_periods: totalPeriods,
      paid_periods: paidPeriods,
      pending_periods: totalPeriods - paidPeriods,
      overdue_periods: overduePeriods,
      total_amount: PrecisionMath.toNumber(PrecisionMath.round(totalAmount)),
      paid_amount: PrecisionMath.toNumber(PrecisionMath.round(paidAmount)),
      remaining_amount: PrecisionMath.toNumber(PrecisionMath.round(remainingAmount)),
      payment_progress: Math.round(paymentProgress)
    };

    res.status(200).json({
      success: true,
      message: '获取还款统计成功',
      data: stats,
      code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取还款统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取还款统计失败',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
};

// 记录还款
exports.recordPayment = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { 
      period_number, 
      paid_amount, 
      payment_method = 'bank_transfer', 
      transaction_id, 
      paid_date = new Date(), 
      notes 
    } = req.body;

    // 验证贷款是否存在
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '贷款不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // 权限检查：管理员可以操作所有贷款，普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '您只能操作自己的贷款',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    // 验证还款期数是否存在
    const schedule = await RepaymentSchedule.findOne({
      loan_id: loanId,
      period_number: period_number
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: '还款期数不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    if (schedule.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: '该期已完成还款',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    // 创建还款记录
    const payment = new Payment({
      loan_id: loanId,
      period_number,
      paid_amount,
      payment_method,
      transaction_id,
      paid_date,
      notes,
      recorded_by: req.user._id
    });

    await payment.save();

    // 更新还款计划状态
    await RepaymentSchedule.updateOne(
      { loan_id: loanId, period_number },
      { 
        status: 'paid',
        actual_paid_amount: paid_amount,
        actual_paid_date: paid_date,
        updated_at: new Date(),
        updated_by: req.user._id
      }
    );

    res.status(201).json({
      success: true,
      message: '还款记录成功',
      data: { payment },
      code: 201,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('记录还款失败:', error);
    res.status(500).json({
      success: false,
      message: '记录还款失败',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
};

// 修改单期还款计划
exports.modifySchedulePeriod = async (req, res, next) => {
  try {
    const { loanId, periodNumber } = req.params;
    
    // 验证贷款是否存在并检查权限
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '贷款不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // 权限检查：管理员可以操作所有贷款，普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '您只能操作自己的贷款',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }
    
    const updateData = {
      ...req.body,
      updated_at: new Date(),
      updated_by: req.user._id
    };

    const result = await RepaymentSchedule.updateOne(
      { loan_id: loanId, period_number: periodNumber },
      updateData
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '还款计划不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      message: '还款计划修改成功',
      code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('修改还款计划失败:', error);
    res.status(500).json({
      success: false,
      message: '修改还款计划失败',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
};

// 批量修改还款计划
exports.batchModifySchedule = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { schedules } = req.body;

    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({
        success: false,
        message: '无效的批量修改数据',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    // 验证贷款是否存在并检查权限
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '贷款不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // 权限检查：管理员可以操作所有贷款，普通用户只能操作自己的贷款
    if (req.user.role !== 'admin' && loan.applicant_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '您只能操作自己的贷款',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    for (const schedule of schedules) {
      await RepaymentSchedule.updateOne(
        { loan_id: loanId, period_number: schedule.period_number },
        { 
          ...schedule,
          updated_at: new Date(),
          updated_by: req.user._id
        }
      );
    }

    res.status(200).json({
      success: true,
      message: '批量修改还款计划成功',
      code: 200,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('批量修改还款计划失败:', error);
    res.status(500).json({
      success: false,
      message: '批量修改还款计划失败',
      code: 500,
      timestamp: new Date().toISOString()
    });
  }
}; 