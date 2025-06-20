const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  loan_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true,
    index: true
  },
  period_number: {
    type: Number,
    required: true,
    min: 1
  },
  paid_amount: {
    type: Number,
    required: true,
    min: 0
  },
  payment_method: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check', 'online', 'wechat', 'alipay'],
    default: 'bank_transfer'
  },
  transaction_id: {
    type: String,
    trim: true
  },
  paid_date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  recorded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引
PaymentSchema.index({ loan_id: 1, period_number: 1 });
PaymentSchema.index({ paid_date: 1 });
PaymentSchema.index({ recorded_by: 1 });

module.exports = mongoose.model('Payment', PaymentSchema); 