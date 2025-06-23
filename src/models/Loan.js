const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  loan_name: {
    type: String,
    required: [true, '贷款名称是必填的'],
    trim: true,
    maxlength: [100, '贷款名称最多100个字符']
  },
  applicant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '申请人ID是必填的']
  },
  applicant_name: {
    type: String,
    required: [true, '申请人姓名是必填的']
  },
  amount: {
    type: Number,
    required: [true, '贷款金额是必填的'],
    min: [1000, '贷款金额不能少于1000元'],
    max: [100000000, '贷款金额不能超过1亿元']
  },
  interest_rate: {
    type: Number,
    required: [true, '利率是必填的'],
    min: [0, '利率不能为负数'],
    max: [100, '利率不能超过100%']
  },
  bank: {
    type: String,
    required: [true, '银行名称是必填的'],
    trim: true,
    maxlength: [100, '银行名称最多100个字符']
  },
  term: {
    type: Number,
    required: [true, '贷款期限是必填的'],
    min: [1, '贷款期限不能少于1个月'],
    max: [360, '贷款期限不能超过360个月']
  },
  repayment_method: {
    type: String,
    required: [true, '还款方式是必填的'],
    enum: {
      values: ['equal_payment', 'equal_principal'],
      message: '还款方式必须是equal_payment或equal_principal'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'completed'],
      message: '状态必须是active或completed'
    },
    default: 'active'
  },
  purpose: {
    type: String,
    trim: true,
    maxlength: [500, '贷款用途描述最多500个字符']
  },
  collateral: {
    type: String,
    trim: true,
    maxlength: [500, '抵押物描述最多500个字符']
  },
  attachments: [{
    file_id: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    original_name: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploaded_at: {
      type: Date,
      default: Date.now
    }
  }],
  application_date: {
    type: Date,
    default: Date.now
  },
  monthly_payment: {
    type: Number,
    default: null
  },
  total_payment: {
    type: Number,
    default: null
  },
  total_interest: {
    type: Number,
    default: null
  },
  repayment_status: {
    type: String,
    enum: {
      values: ['not_started', 'in_progress', 'completed', 'overdue'],
      message: '还款状态必须是not_started、in_progress、completed或overdue'
    },
    default: 'not_started',
    index: true
  },
  total_paid_amount: {
    type: Number,
    default: 0,
    min: [0, '总已还金额不能为负数']
  },
  repayment_start_date: {
    type: Date,
    default: null
  },
  next_payment_date: {
    type: Date,
    default: null
  },
  last_payment_date: {
    type: Date,
    default: null
  },
  paid_periods: {
    type: Number,
    default: 0,
    min: [0, '已还期数不能为负数']
  },
  overdue_periods: {
    type: Number,
    default: 0,
    min: [0, '逾期期数不能为负数']
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// 索引
loanSchema.index({ applicant_id: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ bank: 1 });
loanSchema.index({ application_date: -1 });
loanSchema.index({ amount: 1 });
loanSchema.index({ 'applicant_id': 1, 'status': 1 });

// 虚拟字段：贷款编号
loanSchema.virtual('loan_number').get(function() {
  const date = this.application_date || this.created_at;
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `LOAN${dateStr}${this._id.toString().slice(-6).toUpperCase()}`;
});

// 虚拟字段：还款进度百分比
loanSchema.virtual('payment_progress').get(function() {
  if (!this.total_payment || this.total_payment === 0) return 0;
  return Math.round((this.total_paid_amount / this.total_payment) * 100);
});

// 虚拟字段：剩余还款金额
loanSchema.virtual('remaining_amount').get(function() {
  if (!this.total_payment) return 0;
  return Math.max(0, this.total_payment - this.total_paid_amount);
});

// 计算月供的方法
loanSchema.methods.calculateMonthlyPayment = function() {
  const principal = this.amount; // 直接使用申请金额
  const rate = this.interest_rate / 100 / 12; // 月利率
  const term = this.term;

  if (this.repayment_method === 'equal_payment') {
    // 等额本息
    if (rate === 0) {
      return principal / term;
    }
    const monthlyPayment = principal * rate * Math.pow(1 + rate, term) / (Math.pow(1 + rate, term) - 1);
    return Math.round(monthlyPayment * 100) / 100;
  } else {
    // 等额本金 - 首月还款额
    const principalPayment = principal / term;
    const interestPayment = principal * rate;
    return Math.round((principalPayment + interestPayment) * 100) / 100;
  }
};

// 计算总还款额的方法
loanSchema.methods.calculateTotalPayment = function() {
  const principal = this.amount; // 直接使用申请金额
  const rate = this.interest_rate / 100 / 12;
  const term = this.term;

  if (this.repayment_method === 'equal_payment') {
    const monthlyPayment = this.calculateMonthlyPayment();
    return Math.round(monthlyPayment * term * 100) / 100;
  } else {
    // 等额本金总利息计算
    const totalInterest = principal * rate * (term + 1) / 2;
    return Math.round((principal + totalInterest) * 100) / 100;
  }
};

// 实例方法：生成还款计划
loanSchema.methods.generateRepaymentSchedule = async function() {
  const { 
    calculateEqualInstallment, 
    calculateEqualPrincipal 
  } = require('../utils/loanCalculator');
  
  const RepaymentSchedule = require('./RepaymentSchedule');
  
  const principal = this.amount;
  const annualRate = this.interest_rate / 100;
  const months = this.term;
  
  let calculationResult;
  
  if (this.repayment_method === 'equal_payment') {
    calculationResult = calculateEqualInstallment(principal, annualRate, months);
  } else {
    calculationResult = calculateEqualPrincipal(principal, annualRate, months);
  }
  
  // 设置还款开始日期（审批日期后一个月）
  const startDate = this.repayment_start_date || new Date();
  if (!this.repayment_start_date) {
    startDate.setMonth(startDate.getMonth() + 1);
    this.repayment_start_date = startDate;
  }
  
  // 设置下次还款日期
  const nextPaymentDate = new Date(startDate);
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
  this.next_payment_date = nextPaymentDate;
  
  // 生成还款计划
  await RepaymentSchedule.generateSchedule(this._id, calculationResult, startDate);
  
  return calculationResult;
};

// 实例方法：更新还款状态
loanSchema.methods.updatePaymentStatus = async function() {
  const RepaymentSchedule = require('./RepaymentSchedule');
  
  const stats = await RepaymentSchedule.getLoanPaymentStats(this._id);
  
  this.total_paid_amount = stats.paid_amount;
  this.paid_periods = stats.paid_periods;
  this.overdue_periods = stats.overdue_periods;
  
  // 更新还款状态
  if (stats.paid_periods === 0) {
    this.repayment_status = 'not_started';
  } else if (stats.paid_periods === stats.total_periods) {
    this.repayment_status = 'completed';
  } else if (stats.overdue_periods > 0) {
    this.repayment_status = 'overdue';
  } else {
    this.repayment_status = 'in_progress';
  }
  
  // 更新下次还款日期
  if (this.repayment_status !== 'completed') {
    const nextPayment = await RepaymentSchedule.findOne({
      loan_id: this._id,
      status: { $in: ['pending', 'overdue', 'partial'] }
    }).sort({ period_number: 1 });
    
    if (nextPayment) {
      this.next_payment_date = nextPayment.due_date;
    }
  }
  
  // 更新最后还款日期
  const lastPayment = await RepaymentSchedule.findOne({
    loan_id: this._id,
    status: 'paid'
  }).sort({ period_number: -1 });
  
  if (lastPayment) {
    this.last_payment_date = lastPayment.paid_date;
  }
  
  await this.save();
  return stats;
};

// 保存前计算相关字段
loanSchema.pre('save', function(next) {
  // 自动计算还款相关字段
  if (this.isModified('amount') || this.isModified('interest_rate') || this.isModified('term')) {
    this.monthly_payment = this.calculateMonthlyPayment();
    this.total_payment = this.calculateTotalPayment();
    this.total_interest = this.total_payment - this.amount;
  }
  next();
});

// 静态方法：获取统计信息
loanSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);

  const result = {
    total_loans: 0,
    active_loans: 0,
    completed_loans: 0,
    total_amount: 0,
    average_amount: 0
  };

  stats.forEach(stat => {
    result.total_loans += stat.count;
    result.total_amount += stat.totalAmount;
    
    switch (stat._id) {
      case 'active':
        result.active_loans = stat.count;
        break;
      case 'completed':
        result.completed_loans = stat.count;
        break;
    }
  });

  result.average_amount = result.total_loans > 0 
    ? Math.round(result.total_amount / result.total_loans) 
    : 0;

  return result;
};

module.exports = mongoose.model('Loan', loanSchema); 