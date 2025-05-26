const AppError = require('../utils/AppError');
const SystemLog = require('../models/SystemLog');
const logger = require('../utils/logger');

// 处理MongoDB验证错误
const handleValidationError = (err) => {
  const errors = {};
  Object.keys(err.errors).forEach(key => {
    errors[key] = [err.errors[key].message];
  });
  
  return new AppError('数据验证失败', 422, 4220, errors);
};

// 处理MongoDB重复键错误
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  
  const errors = {};
  errors[field] = [`${field}已存在: ${value}`];
  
  return new AppError('数据重复', 409, 4090, errors);
};

// 处理MongoDB类型转换错误
const handleCastError = (err) => {
  return new AppError(`无效的${err.path}: ${err.value}`, 400, 4000);
};

// 在开发环境发送错误详情
const sendErrorDev = (err, req, res) => {
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    code: err.errorCode || err.statusCode,
    error: err,
    stack: err.stack,
    errors: err.errors || {},
    timestamp: new Date().toISOString()
  });
};

// 在生产环境发送简化错误信息
const sendErrorProd = (err, req, res) => {
  // 操作性错误：发送给客户端
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.errorCode || err.statusCode,
      errors: err.errors || {},
      timestamp: new Date().toISOString()
    });
  } else {
    // 编程性错误：不泄露错误详情
    logger.error('非操作性错误:', err);
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      code: 5000,
      timestamp: new Date().toISOString()
    });
  }
};

// 记录错误日志
const logError = async (err, req) => {
  try {
    const logData = {
      level: 'error',
      module: 'system',
      action: 'error_occurred',
      message: err.message,
      user_id: req.user?._id || null,
      username: req.user?.username || null,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: err.statusCode,
      error_details: err.message,
      stack_trace: process.env.NODE_ENV === 'development' ? err.stack : null,
      metadata: {
        error_code: err.errorCode,
        is_operational: err.isOperational,
        request_body: req.body,
        request_params: req.params,
        request_query: req.query
      }
    };

    await SystemLog.createLog(logData);
  } catch (logError) {
    logger.error('记录错误日志失败:', logError);
  }
};

// 全局错误处理中间件
const errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  await logError(error, req);

  // 处理特定类型的错误
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }
  
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }
  
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // 确保错误具有状态码
  if (!error.statusCode) {
    error.statusCode = 500;
  }

  // 根据环境发送错误响应
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

module.exports = errorHandler; 