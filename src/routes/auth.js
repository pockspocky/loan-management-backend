const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const { generateToken, generateRefreshToken, authenticate } = require('../middleware/auth');
const { validateInput } = require('../utils/validation');
const AppError = require('../utils/AppError');
const { getClientIP } = require('../utils/helpers');

const router = express.Router();

// 用户注册
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // 验证必填字段
    const requiredFields = { username, password };
    const validation = validateInput(requiredFields, {
      username: { required: true, minLength: 3, maxLength: 20 },
      password: { required: true, minLength: 6 }
    });
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: validation.errors,
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在',
        code: 409,
        timestamp: new Date().toISOString()
      });
    }
    
    // 创建新用户
    const user = new User({
      username,
      password,
      role: 'user',
      status: 'active'
    });
    
    await user.save();
    
    // 记录注册日志
    await SystemLog.create({
      level: 'info',
      module: 'auth',
      action: 'register',
      message: `用户注册成功: ${username}`,
      user_id: user._id,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl
    });
    
    // 返回用户信息（不包含密码）
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: userResponse
      },
      code: 201,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 用户登录
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 查找用户（仅支持用户名登录）
    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      // 记录登录失败日志
      await SystemLog.create({
        level: 'warning',
        module: 'auth',
        action: 'login_failed',
        message: `登录失败: 用户不存在 - ${username}`,
        ip_address: getClientIP(req),
        user_agent: req.get('User-Agent'),
        request_method: req.method,
        request_url: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
        code: 401,
        timestamp: new Date().toISOString()
      });
    }
    
    // 检查用户状态
    if (user.status !== 'active') {
      await SystemLog.create({
        level: 'warning',
        module: 'auth',
        action: 'login_failed',
        message: `登录失败: 账户已被禁用 - ${username}`,
        user_id: user._id,
        ip_address: getClientIP(req),
        user_agent: req.get('User-Agent'),
        request_method: req.method,
        request_url: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: '账户已被禁用，请联系管理员',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await SystemLog.create({
        level: 'warning',
        module: 'auth',
        action: 'login_failed',
        message: `登录失败: 密码错误 - ${username}`,
        user_id: user._id,
        ip_address: getClientIP(req),
        user_agent: req.get('User-Agent'),
        request_method: req.method,
        request_url: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
        code: 401,
        timestamp: new Date().toISOString()
      });
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    // 更新最后登录时间
    user.last_login = new Date();
    await user.save();
    
    // 记录登录成功日志
    await SystemLog.create({
      level: 'info',
      module: 'auth',
      action: 'login',
      message: `用户登录成功: ${username}`,
      user_id: user._id,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl
    });
    
    // 返回用户信息和令牌
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: userResponse,
        token,
        expires_in: process.env.JWT_EXPIRES_IN || '24h'
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 用户登出
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // 记录登出日志
    await SystemLog.create({
      level: 'info',
      module: 'auth',
      action: 'logout',
      message: `用户登出: ${req.user.username}`,
      user_id: req.user._id,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl
    });
    
    res.json({
      success: true,
      message: '登出成功',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: '获取用户信息成功',
      data: {
        user
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 修改密码
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    
    // 验证输入
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: '所有密码字段都不能为空',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: '新密码和确认密码不匹配',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度不能少于6位',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 获取用户信息
    const user = await User.findById(req.user._id).select('+password');
    
    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isCurrentPasswordValid) {
      await SystemLog.create({
        level: 'warning',
        module: 'auth',
        action: 'change_password_failed',
        message: `修改密码失败: 当前密码错误 - ${user.username}`,
        user_id: user._id,
        ip_address: getClientIP(req),
        user_agent: req.get('User-Agent'),
        request_method: req.method,
        request_url: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        message: '当前密码错误',
        code: 401,
        timestamp: new Date().toISOString()
      });
    }
    
    // 更新密码
    user.password = new_password;
    await user.save();
    
    // 记录密码修改日志
    await SystemLog.create({
      level: 'info',
      module: 'auth',
      action: 'change_password',
      message: `用户修改密码成功: ${user.username}`,
      user_id: user._id,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl
    });
    
    res.json({
      success: true,
      message: '密码修改成功',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户资料
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { real_name, phone, email } = req.body;
    const userId = req.user._id;
    
    // 构建更新对象
    const updateData = {};
    if (real_name) updateData.real_name = real_name;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;
    
    // 验证输入
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 检查邮箱和手机号是否已被其他用户使用
    if (email || phone) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });
      
      if (existingUser) {
        let message = '更新失败';
        if (existingUser.email === email) message = '邮箱已被其他用户使用';
        else if (existingUser.phone === phone) message = '手机号已被其他用户使用';
        
        return res.status(409).json({
          success: false,
          message,
          code: 409,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 更新用户信息
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    // 记录更新日志
    await SystemLog.create({
      level: 'info',
      module: 'auth',
      action: 'update_profile',
      message: `用户更新资料: ${user.username}`,
      user_id: user._id,
      ip_address: getClientIP(req),
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl
    });
    
    res.json({
      success: true,
      message: '资料更新成功',
      data: {
        user
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 验证令牌
router.get('/verify', authenticate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: '令牌验证成功',
      data: {
        user: {
          id: req.user._id,
          username: req.user.username,
          role: req.user.role,
          status: req.user.status
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 