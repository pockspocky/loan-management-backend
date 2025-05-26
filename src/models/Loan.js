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
      values: ['pending', 'approved', 'rejected', 'completed'],
      message: '状态必须是pending、approved、rejected或completed'
    },
    default: 'pending'
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
  approved_amount: {
    type: Number,
    min: [0, '批准金额不能为负数'],
    default: null
  },
  approved_rate: {
    type: Number,
    min: [0, '批准利率不能为负数'],
    max: [100, '批准利率不能超过100%'],
    default: null
  },
  remark: {
    type: String,
    trim: true,
    maxlength: [1000, '备注最多1000个字符']
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
  approval_date: {
    type: Date,
    default: null
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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

// 计算月供的方法
loanSchema.methods.calculateMonthlyPayment = function() {
  const principal = this.approved_amount || this.amount;
  const rate = (this.approved_rate || this.interest_rate) / 100 / 12; // 月利率
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
  const principal = this.approved_amount || this.amount;
  const rate = (this.approved_rate || this.interest_rate) / 100 / 12;
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

// 保存前计算相关字段
loanSchema.pre('save', function(next) {
  if (this.status === 'approved' && (this.isModified('approved_amount') || this.isModified('approved_rate') || this.isModified('term'))) {
    this.monthly_payment = this.calculateMonthlyPayment();
    this.total_payment = this.calculateTotalPayment();
    this.total_interest = this.total_payment - (this.approved_amount || this.amount);
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
    pending_loans: 0,
    approved_loans: 0,
    rejected_loans: 0,
    completed_loans: 0,
    total_amount: 0,
    approved_amount: 0,
    average_amount: 0
  };

  stats.forEach(stat => {
    result.total_loans += stat.count;
    result.total_amount += stat.totalAmount;
    
    switch (stat._id) {
      case 'pending':
        result.pending_loans = stat.count;
        break;
      case 'approved':
        result.approved_loans = stat.count;
        result.approved_amount += stat.totalAmount;
        break;
      case 'rejected':
        result.rejected_loans = stat.count;
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