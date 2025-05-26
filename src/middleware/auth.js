const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const AppError = require('../utils/AppError');

// 生成JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// 生成刷新Token
const generateRefreshToken = (userId, role) => {
  return jwt.sign(
    { userId, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

// 验证Token中间件
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('未提供认证令牌', 401, 1002));
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(new AppError('认证令牌格式错误', 401, 1002));
    }

    // 验证token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('认证令牌已过期', 401, 1002));
      } else if (error.name === 'JsonWebTokenError') {
        return next(new AppError('无效的认证令牌', 401, 1002));
      } else {
        return next(new AppError('认证失败', 401, 1002));
      }
    }

    // 查找用户
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new AppError('用户不存在', 401, 1001));
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return next(new AppError('账户已被禁用', 403, 1003));
    }

    // 将用户信息添加到请求对象
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    next(new AppError('认证过程中发生错误', 500, 5000));
  }
};

// 角色授权中间件
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401, 1002));
    }

    if (!roles.includes(req.user.role)) {
      // 记录无权限访问日志
      SystemLog.createLog({
        level: 'warning',
        module: 'auth',
        action: 'unauthorized_access',
        message: `用户尝试访问无权限的资源: ${req.originalUrl}`,
        user_id: req.user._id,
        username: req.user.username,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        request_method: req.method,
        request_url: req.originalUrl,
        response_status: 403,
        metadata: {
          required_roles: roles,
          user_role: req.user.role
        }
      });

      return next(new AppError('权限不足', 403, 1003));
    }

    next();
  };
};

// 检查资源所有权中间件
const checkOwnership = (resourcePath = 'id') => {
  return async (req, res, next) => {
    try {
      // 管理员可以访问所有资源
      if (req.user.role === 'admin') {
        return next();
      }

      // 获取资源ID
      const resourceId = req.params[resourcePath];
      
      if (!resourceId) {
        return next(new AppError('缺少资源ID', 400, 4000));
      }

      // 检查是否是用户自己的资源
      if (resourceId !== req.user._id.toString()) {
        return next(new AppError('只能访问自己的资源', 403, 1003));
      }

      next();
    } catch (error) {
      next(new AppError('权限检查失败', 500, 5000));
    }
  };
};

// 可选认证中间件（token可有可无）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.status === 'active') {
        req.user = user;
        req.token = token;
      }
    } catch (error) {
      // 忽略token错误，继续处理请求
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  authenticate,
  authorize,
  checkOwnership,
  optionalAuth
}; 