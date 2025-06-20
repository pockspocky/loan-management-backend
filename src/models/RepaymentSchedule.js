const mongoose = require('mongoose');

const repaymentScheduleSchema = new mongoose.Schema({
  loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: [true, '贷款ID是必填的'],
    index: true
  },
  period_number: {
    type: Number,
    required: [true, '期数是必填的'],
    min: [1, '期数不能小于1']
  },
  due_date: {
    type: Date,
    required: [true, '应还日期是必填的']
  },
  total_amount: {
    type: Number,
    required: [true, '应还总额是必填的'],
    min: [0, '应还总额不能为负数']
  },
  principal_amount: {
    type: Number,
    required: [true, '应还本金是必填的'],
    min: [0, '应还本金不能为负数']
  },
  interest_amount: {
    type: Number,
    required: [true, '应还利息是必填的'],
    min: [0, '应还利息不能为负数']
  },
  remaining_principal: {
    type: Number,
    required: [true, '剩余本金是必填的'],
    min: [0, '剩余本金不能为负数']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'overdue', 'partial'],
      message: '状态必须是pending、paid、overdue或partial'
    },
    default: 'pending',
    index: true
  },
  paid_amount: {
    type: Number,
    default: 0,
    min: [0, '已还金额不能为负数']
  },
  paid_principal: {
    type: Number,
    default: 0,
    min: [0, '已还本金不能为负数']
  },
  paid_interest: {
    type: Number,
    default: 0,
    min: [0, '已还利息不能为负数']
  },
  paid_date: {
    type: Date,
    default: null
  },
  actual_paid_amount: {
    type: Number,
    min: [0, '实际支付金额不能为负数'],
    default: null
  },
  actual_paid_date: {
    type: Date,
    default: null
  },
  payment_method: {
    type: String,
    enum: {
      values: ['bank_transfer', 'online_payment', 'cash', 'check', 'other', null],
      message: '支付方式必须是bank_transfer、online_payment、cash、check、other或null'
    },
    default: null,
    required: false
  },
  transaction_id: {
    type: String,
    trim: true,
    default: null
  },
  late_fee: {
    type: Number,
    default: 0,
    min: [0, '滞纳金不能为负数']
  },
  paid_late_fee: {
    type: Number,
    default: 0,
    min: [0, '已付滞纳金不能为负数']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, '备注最多500个字符']
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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

// 复合索引
repaymentScheduleSchema.index({ loan_id: 1, period_number: 1 }, { unique: true });
repaymentScheduleSchema.index({ loan_id: 1, status: 1 });
repaymentScheduleSchema.index({ due_date: 1, status: 1 });
repaymentScheduleSchema.index({ status: 1, due_date: 1 });

// 虚拟字段：逾期天数
repaymentScheduleSchema.virtual('overdue_days').get(function() {
  if (this.status === 'paid' || !this.due_date) {
    return 0;
  }
  const today = new Date();
  const dueDate = new Date(this.due_date);
  const timeDiff = today.getTime() - dueDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return daysDiff > 0 ? daysDiff : 0;
});

// 虚拟字段：还款进度百分比
repaymentScheduleSchema.virtual('payment_progress').get(function() {
  if (this.total_amount === 0) return 0;
  return Math.round((this.paid_amount / this.total_amount) * 100);
});

// 虚拟字段：剩余未还金额
repaymentScheduleSchema.virtual('remaining_amount').get(function() {
  return Math.max(0, this.total_amount - this.paid_amount);
});

// 实例方法：标记为已支付
repaymentScheduleSchema.methods.markAsPaid = function(paymentData = {}) {
  this.status = 'paid';
  this.paid_amount = this.total_amount;
  this.paid_principal = this.principal_amount;
  this.paid_interest = this.interest_amount;
  this.paid_date = paymentData.paid_date || new Date();
  this.payment_method = paymentData.payment_method || null;
  this.transaction_id = paymentData.transaction_id || null;
  this.notes = paymentData.notes || null;
  this.updated_by = paymentData.updated_by || null;
  
  if (paymentData.late_fee) {
    this.paid_late_fee = paymentData.late_fee;
  }
};

// 实例方法：部分还款
repaymentScheduleSchema.methods.makePartialPayment = function(amount, paymentData = {}) {
  if (amount <= 0 || amount > (this.total_amount - this.paid_amount)) {
    throw new Error('还款金额无效');
  }
  
  this.paid_amount += amount;
  this.paid_date = paymentData.paid_date || new Date();
  this.payment_method = paymentData.payment_method || null;
  this.transaction_id = paymentData.transaction_id || null;
  this.notes = paymentData.notes || null;
  this.updated_by = paymentData.updated_by || null;
  
  // 按比例分配本金和利息
  const totalDue = this.total_amount + this.late_fee;
  const paymentRatio = this.paid_amount / totalDue;
  this.paid_principal = Math.min(this.principal_amount, this.principal_amount * paymentRatio);
  this.paid_interest = Math.min(this.interest_amount, this.interest_amount * paymentRatio);
  
  // 更新状态
  if (this.paid_amount >= this.total_amount) {
    this.status = 'paid';
  } else {
    this.status = 'partial';
  }
  
  if (paymentData.late_fee) {
    this.paid_late_fee += paymentData.late_fee;
  }
};

// 实例方法：计算滞纳金
repaymentScheduleSchema.methods.calculateLateFee = function(lateFeeRate = 0.05) {
  const overdueDays = this.overdue_days;
  if (overdueDays <= 0) return 0;
  
  const remainingAmount = this.total_amount - this.paid_amount;
  return Math.round(remainingAmount * (lateFeeRate / 100) * overdueDays * 100) / 100;
};

// 更新前检查逾期状态
repaymentScheduleSchema.pre('save', function(next) {
  if (this.status === 'pending' && this.due_date) {
    const today = new Date();
    const dueDate = new Date(this.due_date);
    if (today > dueDate && this.paid_amount < this.total_amount) {
      this.status = 'overdue';
    }
  }
  next();
});

// 静态方法：获取贷款的还款统计
repaymentScheduleSchema.statics.getLoanPaymentStats = async function(loanId) {
  // 验证loanId是否为有效的ObjectId
  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    throw new Error(`无效的贷款ID: ${loanId}`);
  }
  
  const stats = await this.aggregate([
    { $match: { loan_id: new mongoose.Types.ObjectId(loanId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$total_amount' },
        paidAmount: { $sum: '$paid_amount' }
      }
    }
  ]);
  
  const result = {
    total_periods: 0,
    paid_periods: 0,
    pending_periods: 0,
    overdue_periods: 0,
    partial_periods: 0,
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    payment_progress: 0
  };
  
  stats.forEach(stat => {
    result.total_periods += stat.count;
    result.total_amount += stat.totalAmount;
    result.paid_amount += stat.paidAmount;
    
    switch (stat._id) {
      case 'paid':
        result.paid_periods = stat.count;
        break;
      case 'pending':
        result.pending_periods = stat.count;
        break;
      case 'overdue':
        result.overdue_periods = stat.count;
        break;
      case 'partial':
        result.partial_periods = stat.count;
        break;
    }
  });
  
  result.remaining_amount = result.total_amount - result.paid_amount;
  result.payment_progress = result.total_amount > 0 
    ? Math.round((result.paid_amount / result.total_amount) * 100)
    : 0;
  
  return result;
};

// 静态方法：生成还款计划
repaymentScheduleSchema.statics.generateSchedule = async function(loanId, calculationResult, startDate = new Date()) {
  // 删除现有的还款计划
  await this.deleteMany({ loan_id: loanId });
  
  const scheduleItems = [];
  let currentDate = new Date(startDate);
  
  calculationResult.schedule.forEach((item, index) => {
    // 计算每期的到期日期（每月同一天）
    const dueDate = new Date(currentDate);
    dueDate.setMonth(dueDate.getMonth() + index + 1);
    
    scheduleItems.push({
      loan_id: loanId,
      period_number: item.period,
      due_date: dueDate,
      total_amount: item.monthlyPayment,
      principal_amount: item.principalPayment,
      interest_amount: item.interestPayment,
      remaining_principal: item.remainingPrincipal,
      status: 'pending'
      // 不设置payment_method，让它保持undefined而不是null
    });
  });
  
  return await this.insertMany(scheduleItems);
};

module.exports = mongoose.model('RepaymentSchedule', repaymentScheduleSchema); 