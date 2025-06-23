const Joi = require('joi');
const AppError = require('./AppError');
const PrecisionMath = require('./precisionMath');

// 通用验证中间件
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      const errors = {};
      error.details.forEach(detail => {
        const key = detail.path.join('.');
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });

      return next(new AppError('数据验证失败', 422, 4220, errors));
    }

    // 更新请求对象
    req[property] = value;
    next();
  };
};

// 分页验证模式
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').optional(),
  sort: Joi.string().valid('created_at', '-created_at', 'updated_at', '-updated_at').default('-created_at')
});

// 用户注册验证模式
const userRegistrationSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(20)
    .required()
    .messages({
      'string.alphanum': '用户名只能包含字母和数字',
      'string.min': '用户名至少3个字符',
      'string.max': '用户名最多20个字符',
      'any.required': '用户名是必填的'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': '密码至少6个字符',
      'any.required': '密码是必填的'
    }),
  role: Joi.string().valid('admin', 'user').default('user')
});

// 用户登录验证模式
const userLoginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': '用户名是必填的'
  }),
  password: Joi.string().required().messages({
    'any.required': '密码是必填的'
  }),
  role: Joi.string().valid('admin', 'user').optional()
});

// 用户更新验证模式
const userUpdateSchema = Joi.object({
  email: Joi.string().email().optional().messages({
    'string.email': '请输入有效的邮箱地址'
  }),
  real_name: Joi.string().trim().max(50).optional(),
  phone: Joi.string()
    .pattern(/^1[3-9]\d{9}$/)
    .optional()
    .messages({
      'string.pattern.base': '请输入有效的手机号码'
    }),
  avatar: Joi.string().uri().optional()
});

// 密码修改验证模式
const passwordChangeSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'any.required': '当前密码是必填的'
  }),
  new_password: Joi.string().min(6).required().messages({
    'string.min': '新密码至少6个字符',
    'any.required': '新密码是必填的'
  }),
  confirm_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only': '确认密码必须与新密码一致',
      'any.required': '确认密码是必填的'
    })
});

// 贷款创建验证模式
const loanCreateSchema = Joi.object({
  loan_name: Joi.string().trim().max(100).required().messages({
    'string.max': '贷款名称最多100个字符',
    'any.required': '贷款名称是必填的'
  }),
  applicant_name: Joi.string().trim().max(50).optional().messages({
    'string.max': '申请人姓名最多50个字符'
  }),
  amount: Joi.number().min(1000).max(100000000).required().messages({
    'number.min': '贷款金额不能少于1000元',
    'number.max': '贷款金额不能超过1亿元',
    'any.required': '贷款金额是必填的'
  }),
  interest_rate: Joi.number().min(0).max(100).required().messages({
    'number.min': '利率不能为负数',
    'number.max': '利率不能超过100%',
    'any.required': '利率是必填的'
  }),
  bank: Joi.string().trim().max(100).required().messages({
    'string.max': '银行名称最多100个字符',
    'any.required': '银行名称是必填的'
  }),
  term: Joi.number().integer().min(1).max(360).required().messages({
    'number.min': '贷款期限不能少于1个月',
    'number.max': '贷款期限不能超过360个月',
    'any.required': '贷款期限是必填的'
  }),
  repayment_method: Joi.string()
    .valid('equal_payment', 'equal_principal')
    .required()
    .messages({
      'any.only': '还款方式必须是equal_payment或equal_principal',
      'any.required': '还款方式是必填的'
    }),
  purpose: Joi.string().trim().max(500).optional(),
  collateral: Joi.string().trim().max(500).optional(),
  attachments: Joi.array().items(Joi.string()).optional()
});

// 贷款更新验证模式
const loanUpdateSchema = Joi.object({
  loan_name: Joi.string().trim().max(100).optional(),
  applicant_name: Joi.string().trim().max(50).optional().messages({
    'string.max': '申请人姓名最多50个字符'
  }),
  amount: Joi.number().min(1000).max(100000000).optional(),
  interest_rate: Joi.number().min(0).max(100).optional(),
  bank: Joi.string().trim().max(100).optional(),
  term: Joi.number().integer().min(1).max(360).optional(),
  repayment_method: Joi.string()
    .valid('equal_payment', 'equal_principal')
    .optional(),
  purpose: Joi.string().trim().max(500).optional(),
  collateral: Joi.string().trim().max(500).optional(),
  attachments: Joi.array().items(Joi.string()).optional()
});

// 查询参数验证模式
const loanQuerySchema = paginationSchema.keys({
  status: Joi.string()
    .valid('active', 'completed')
    .optional(),
  applicant_id: Joi.string().optional(),
  bank: Joi.string().optional(),
  amount_min: Joi.number().min(0).optional(),
  amount_max: Joi.number().min(0).optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().min(Joi.ref('date_from')).optional()
});

const userQuerySchema = paginationSchema.keys({
  role: Joi.string().valid('admin', 'user').optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional()
});

const logQuerySchema = paginationSchema.keys({
  level: Joi.string().valid('debug', 'info', 'warning', 'error').optional(),
  module: Joi.string().valid('auth', 'loan', 'user', 'system', 'upload').optional(),
  user_id: Joi.string().optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().min(Joi.ref('date_from')).optional()
});

// 简单的输入验证函数
const validateInput = (data, rules) => {
  const errors = {};
  let isValid = true;

  for (const field in rules) {
    const value = data[field];
    const rule = rules[field];

    // 检查必填字段
    if (rule.required && (!value || value.toString().trim() === '')) {
      errors[field] = [`${field}是必填的`];
      isValid = false;
      continue;
    }

    // 如果字段为空且不是必填的，跳过其他验证
    if (!value && !rule.required) {
      continue;
    }

    // 检查最小长度
    if (rule.minLength && value.toString().length < rule.minLength) {
      if (!errors[field]) errors[field] = [];
      errors[field].push(`${field}最少需要${rule.minLength}个字符`);
      isValid = false;
    }

    // 检查最大长度
    if (rule.maxLength && value.toString().length > rule.maxLength) {
      if (!errors[field]) errors[field] = [];
      errors[field].push(`${field}最多允许${rule.maxLength}个字符`);
      isValid = false;
    }

    // 检查邮箱格式
    if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      if (!errors[field]) errors[field] = [];
      errors[field].push(`${field}格式不正确`);
      isValid = false;
    }

    // 检查正则表达式
    if (rule.pattern && !rule.pattern.test(value)) {
      if (!errors[field]) errors[field] = [];
      errors[field].push(`${field}格式不正确`);
      isValid = false;
    }
  }

  return { isValid, errors };
};

// 贷款数据验证
const validateLoanData = (req, res, next) => {
  const { amount, interest_rate, term } = req.body;
  const errors = [];
  
  // 验证金额
  if (!amount || !PrecisionMath.safeDecimal(amount).greaterThan(0)) {
    errors.push('贷款金额必须大于0');
  }
  
  const amountDecimal = PrecisionMath.safeDecimal(amount);
  if (PrecisionMath.lessThan(amountDecimal, 1000)) {
    errors.push('贷款金额不能少于1000元');
  }
  
  if (PrecisionMath.greaterThan(amountDecimal, 100000000)) {
    errors.push('贷款金额不能超过1亿元');
  }
  
  // 验证利率
  if (!interest_rate || !PrecisionMath.safeDecimal(interest_rate).greaterThan(0)) {
    errors.push('年利率必须大于0');
  }
  
  const rateDecimal = PrecisionMath.safeDecimal(interest_rate);
  if (PrecisionMath.greaterThan(rateDecimal, 36)) {
    errors.push('年利率不能超过36%');
  }
  
  // 验证期限
  if (!term || !PrecisionMath.safeDecimal(term).greaterThan(0)) {
    errors.push('还款期限必须大于0');
  }
  
  const termDecimal = PrecisionMath.safeDecimal(term);
  if (PrecisionMath.greaterThan(termDecimal, 360)) {
    errors.push('还款期限不能超过360个月');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors
    });
  }
  
  next();
};

// 还款数据验证
const validateRepaymentData = (req, res, next) => {
  const { paid_amount, total_amount } = req.body;
  const errors = [];
  
  const paidDecimal = PrecisionMath.safeDecimal(paid_amount);
  const totalDecimal = PrecisionMath.safeDecimal(total_amount);
  
  if (!PrecisionMath.greaterThan(paidDecimal, 0)) {
    errors.push('还款金额必须大于0');
  }
  
  if (PrecisionMath.greaterThan(paidDecimal, totalDecimal)) {
    errors.push('还款金额不能超过应还金额');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors
    });
  }
  
  next();
};

module.exports = {
  validate,
  validateInput,
  validateLoanData,
  validateRepaymentData,
  userRegistrationSchema,
  userLoginSchema,
  userUpdateSchema,
  passwordChangeSchema,
  loanCreateSchema,
  loanUpdateSchema,
  loanQuerySchema,
  userQuerySchema,
  logQuerySchema,
  paginationSchema
}; 