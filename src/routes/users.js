const express = require('express');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorize, checkOwnership } = require('../middleware/auth');
const { 
  validate, 
  userRegistrationSchema, 
  userUpdateSchema, 
  passwordChangeSchema,
  userQuerySchema 
} = require('../utils/validation');
const AppError = require('../utils/AppError');

const router = express.Router();

// 分页辅助函数
const buildPaginationResponse = (items, page, perPage, total) => {
  const totalPages = Math.ceil(total / perPage);
  return {
    items,
    pagination: {
      current_page: page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    }
  };
};

// 构建查询条件
const buildUserQuery = (query) => {
  const filter = {};
  
  if (query.search) {
    filter.$or = [
      { username: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { real_name: { $regex: query.search, $options: 'i' } }
    ];
  }
  
  if (query.role) {
    filter.role = query.role;
  }
  
  if (query.status) {
    filter.status = query.status;
  }
  
  return filter;
};

// 获取用户列表 (仅管理员)
router.get('/', authenticate, authorize('admin'), validate(userQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, per_page, search, role, status, sort } = req.query;
    
    const filter = buildUserQuery({ search, role, status });
    
    // 排序处理
    const sortOrder = sort.startsWith('-') ? -1 : 1;
    const sortField = sort.replace('-', '');
    const sortObj = { [sortField]: sortOrder };
    
    // 计算跳过的文档数
    const skip = (page - 1) * per_page;
    
    // 查询用户列表
    const users = await User.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(per_page)
      .select('-refresh_tokens');
    
    // 获取总数
    const total = await User.countDocuments(filter);
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'list_users',
      message: `管理员查看用户列表`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        filter,
        page,
        per_page,
        total
      }
    });
    
    const responseData = buildPaginationResponse(users, page, per_page, total);
    
    res.json({
      success: true,
      message: '获取用户列表成功',
      data: responseData,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户资料 - 必须在 /:user_id 路由之前定义
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('-password -refresh_tokens');
    
    if (!user) {
      return next(new AppError('用户不存在', 404, 4040));
    }
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'view_profile',
      message: `查看个人资料: ${user.username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        viewed_user_id: user._id,
        viewed_username: user.username
      }
    });
    
    res.json({
      success: true,
      message: '获取用户资料成功',
      data: { user },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取用户统计信息 - 在动态路由之前定义
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // 导入 Loan 模型
    const Loan = require('../models/Loan');
    
    // 统计用户的贷款数据
    const loanStats = await Loan.aggregate([
      { $match: { applicant_id: userId } },
      {
        $group: {
          _id: null,
          totalLoans: { $sum: 1 },
          activeLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedLoans: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalAmount: { $sum: '$amount' },
          avgInterestRate: { $avg: '$interest_rate' }
        }
      }
    ]);
    
    // 如果没有贷款数据，返回默认值
    const stats = loanStats[0] || {
      totalLoans: 0,
      activeLoans: 0,
      completedLoans: 0,
      totalAmount: 0,
      avgInterestRate: 0
    };
    
    // 构建响应数据（匹配前端期望的格式）
    const responseData = {
      totalTasks: stats.totalLoans,
      completedTasks: stats.completedLoans,
      activeProjects: stats.activeLoans,
      totalAmount: stats.totalAmount,
      avgInterestRate: Number(stats.avgInterestRate?.toFixed(2) || 0)
    };
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'view_stats',
      message: `查看用户统计: ${req.user.username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: responseData
    });
    
    res.json({
      success: true,
      message: '获取用户统计成功',
      data: responseData,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个用户信息
router.get('/:user_id', authenticate, async (req, res, next) => {
  try {
    const { user_id } = req.params;
    
    // 非管理员只能查看自己的信息
    if (req.user.role !== 'admin' && user_id !== req.user._id.toString()) {
      return next(new AppError('只能查看自己的信息', 403, 1003));
    }
    
    const user = await User.findById(user_id).select('-refresh_tokens');
    
    if (!user) {
      return next(new AppError('用户不存在', 404, 4040));
    }
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'view_user',
      message: `查看用户信息: ${user.username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        viewed_user_id: user._id,
        viewed_username: user.username
      }
    });
    
    res.json({
      success: true,
      message: '获取用户信息成功',
      data: { user },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 创建用户 (仅管理员)
router.post('/', authenticate, authorize('admin'), validate(userRegistrationSchema), async (req, res, next) => {
  try {
    const { username, email, password, real_name, phone, role, status } = req.body;
    
    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      const field = existingUser.username === username ? 'username' : 'email';
      const errors = {};
      errors[field] = [`${field === 'username' ? '用户名' : '邮箱'}已存在`];
      return next(new AppError('用户已存在', 409, 4090, errors));
    }
    
    // 创建新用户
    const user = new User({
      username,
      email,
      password,
      real_name,
      phone,
      role: role || 'user',
      status: status || 'active'
    });
    
    await user.save();
    
    // 记录创建日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'create_user',
      message: `管理员创建用户: ${username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 201,
      metadata: {
        created_user_id: user._id,
        created_username: user.username,
        created_role: user.role
      }
    });
    
    res.status(201).json({
      success: true,
      message: '创建用户成功',
      data: { user: user.toJSON() },
      code: 201,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户信息
router.put('/:user_id', authenticate, validate(userUpdateSchema), async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { email, real_name, phone, avatar } = req.body;
    
    // 非管理员只能更新自己的信息
    if (req.user.role !== 'admin' && user_id !== req.user._id.toString()) {
      return next(new AppError('只能更新自己的信息', 403, 1003));
    }
    
    const user = await User.findById(user_id);
    
    if (!user) {
      return next(new AppError('用户不存在', 404, 4040));
    }
    
    // 检查邮箱是否被其他用户使用
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user_id } });
      if (existingUser) {
        const errors = { email: ['邮箱已被其他用户使用'] };
        return next(new AppError('邮箱已存在', 409, 4090, errors));
      }
    }
    
    // 更新用户信息
    const updateData = {};
    if (email) updateData.email = email;
    if (real_name !== undefined) updateData.real_name = real_name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    
    const updatedUser = await User.findByIdAndUpdate(
      user_id,
      updateData,
      { new: true, runValidators: true }
    ).select('-refresh_tokens');
    
    // 记录更新日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'update_user',
      message: `更新用户信息: ${updatedUser.username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        updated_user_id: updatedUser._id,
        updated_fields: Object.keys(updateData)
      }
    });
    
    res.json({
      success: true,
      message: '更新用户信息成功',
      data: { user: updatedUser },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 删除用户 (仅管理员)
router.delete('/:user_id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { user_id } = req.params;
    
    // 不能删除自己
    if (user_id === req.user._id.toString()) {
      return next(new AppError('不能删除自己', 400, 4000));
    }
    
    const user = await User.findById(user_id);
    
    if (!user) {
      return next(new AppError('用户不存在', 404, 4040));
    }
    
    await User.findByIdAndDelete(user_id);
    
    // 记录删除日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'user',
      action: 'delete_user',
      message: `管理员删除用户: ${user.username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        deleted_user_id: user._id,
        deleted_username: user.username
      }
    });
    
    res.json({
      success: true,
      message: '删除用户成功',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 修改密码
router.patch('/:user_id/password', authenticate, validate(passwordChangeSchema), async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { current_password, new_password } = req.body;
    
    // 非管理员只能修改自己的密码
    if (req.user.role !== 'admin' && user_id !== req.user._id.toString()) {
      return next(new AppError('只能修改自己的密码', 403, 1003));
    }
    
    const user = await User.findById(user_id).select('+password');
    
    if (!user) {
      return next(new AppError('用户不存在', 404, 4040));
    }
    
    // 验证当前密码（管理员可以跳过）
    if (req.user.role !== 'admin' || user_id === req.user._id.toString()) {
      const isCurrentPasswordValid = await user.comparePassword(current_password);
      if (!isCurrentPasswordValid) {
        const errors = { current_password: ['当前密码错误'] };
        return next(new AppError('当前密码错误', 400, 4000, errors));
      }
    }
    
    // 更新密码
    user.password = new_password;
    await user.save();
    
    // 清除所有刷新令牌（强制重新登录）
    user.refresh_tokens = [];
    await user.save();
    
    // 记录密码修改日志
    await SystemLog.createLog({
      level: 'info',
      module: 'user',
      action: 'change_password',
      message: `修改密码: ${user.username}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        target_user_id: user._id,
        target_username: user.username
      }
    });
    
    res.json({
      success: true,
      message: '密码修改成功，请重新登录',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 管理员修改用户状态
router.patch('/:user_id/status', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return next(new AppError('无效的用户状态', 400, 4000));
    }
    
    // 不能修改自己的状态
    if (user_id === req.user._id.toString()) {
      return next(new AppError('不能修改自己的状态', 400, 4000));
    }
    
    const user = await User.findById(user_id);
    
    if (!user) {
      return next(new AppError('用户不存在', 404, 4040));
    }
    
    const oldStatus = user.status;
    user.status = status;
    await user.save();
    
    // 如果状态变为非活跃，清除刷新令牌
    if (status !== 'active') {
      user.refresh_tokens = [];
      await user.save();
    }
    
    // 记录状态修改日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'user',
      action: 'change_user_status',
      message: `管理员修改用户状态: ${user.username} (${oldStatus} -> ${status})`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        target_user_id: user._id,
        target_username: user.username,
        old_status: oldStatus,
        new_status: status
      }
    });
    
    res.json({
      success: true,
      message: '用户状态修改成功',
      data: { user: user.toJSON() },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 