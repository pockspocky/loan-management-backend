const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '用户名是必填的'],
    unique: true,
    trim: true,
    minlength: [3, '用户名至少3个字符'],
    maxlength: [20, '用户名最多20个字符'],
    match: [/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线']
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址'],
    default: null
  },
  password: {
    type: String,
    required: [true, '密码是必填的'],
    minlength: [6, '密码至少6个字符'],
    select: false // 默认查询时不返回密码
  },
  real_name: {
    type: String,
    trim: true,
    maxlength: [50, '真实姓名最多50个字符'],
    default: null
  },
  phone: {
    type: String,
    trim: true,
    match: [/^1[3-9]\d{9}$/, '请输入有效的手机号码'],
    default: null
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'user'],
      message: '用户角色必须是admin或user'
    },
    default: 'user'
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'suspended'],
      message: '用户状态必须是active、inactive或suspended'
    },
    default: 'active'
  },
  avatar: {
    type: String,
    default: null
  },
  last_login: {
    type: Date,
    default: null
  },
  login_attempts: {
    type: Number,
    default: 0
  },
  lock_until: {
    type: Date,
    default: null
  },
  refresh_tokens: [{
    token: String,
    created_at: {
      type: Date,
      default: Date.now
    },
    expires_at: Date
  }]
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refresh_tokens;
      delete ret.__v;
      return ret;
    }
  }
});

// 索引
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// 密码加密中间件
userSchema.pre('save', async function(next) {
  // 只有密码被修改时才加密
  if (!this.isModified('password')) return next();
  
  try {
    // 生成salt并加密密码
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 密码验证方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 检查账户是否被锁定
userSchema.methods.isLocked = function() {
  return !!(this.lock_until && this.lock_until > Date.now());
};

// 增加登录尝试次数
userSchema.methods.incLoginAttempts = function() {
  // 如果之前有锁定且已过期，重置尝试次数
  if (this.lock_until && this.lock_until < Date.now()) {
    return this.updateOne({
      $unset: { lock_until: 1 },
      $set: { login_attempts: 1 }
    });
  }
  
  const updates = { $inc: { login_attempts: 1 } };
  
  // 如果超过5次尝试，锁定账户1小时
  if (this.login_attempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lock_until: Date.now() + 60 * 60 * 1000 }; // 1小时后解锁
  }
  
  return this.updateOne(updates);
};

// 重置登录尝试次数
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { login_attempts: 1, lock_until: 1 }
  });
};

// 静态方法：查找可用用户
userSchema.statics.findActiveUser = function(query) {
  return this.findOne({ ...query, status: 'active' });
};

module.exports = mongoose.model('User', userSchema); 