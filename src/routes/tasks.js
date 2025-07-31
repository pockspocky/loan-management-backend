const express = require('express');
const { authenticate } = require('../middleware/auth');
const SystemLog = require('../models/SystemLog');
const AppError = require('../utils/AppError');

const router = express.Router();

// 模拟任务数据存储（在真实项目中应该使用数据库）
let tasks = [
  {
    id: 1,
    title: '完善个人资料',
    description: '填写完整的个人信息',
    status: 'pending',
    priority: 'high',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 2,
    title: '申请贷款',
    description: '提交贷款申请并等待审核',
    status: 'completed',
    priority: 'medium',
    created_at: new Date(),
    updated_at: new Date()
  }
];

let nextId = 3;

// 获取任务列表
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, priority, page = 1, per_page = 20 } = req.query;
    
    let filteredTasks = tasks.filter(task => task.user_id === req.user._id.toString());
    
    // 按状态过滤
    if (status) {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    
    // 按优先级过滤
    if (priority) {
      filteredTasks = filteredTasks.filter(task => task.priority === priority);
    }
    
    // 分页处理
    const skip = (page - 1) * per_page;
    const paginatedTasks = filteredTasks.slice(skip, skip + per_page);
    const total = filteredTasks.length;
    const totalPages = Math.ceil(total / per_page);
    
    // 记录查看日志
    await SystemLog.createLog({
      level: 'info',
      module: 'task',
      action: 'list_tasks',
      message: `查看任务列表`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        total,
        page,
        per_page
      }
    });
    
    res.json({
      success: true,
      message: '获取任务列表成功',
      data: {
        items: paginatedTasks,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(per_page),
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个任务
router.get('/:task_id', authenticate, async (req, res, next) => {
  try {
    const { task_id } = req.params;
    
    const task = tasks.find(t => t.id === parseInt(task_id) && t.user_id === req.user._id.toString());
    
    if (!task) {
      return next(new AppError('任务不存在', 404, 4040));
    }
    
    res.json({
      success: true,
      message: '获取任务详情成功',
      data: { task },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 创建任务
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, description, priority = 'medium' } = req.body;
    
    // 验证输入
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '任务标题不能为空',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: '优先级必须是low、medium或high',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 创建任务
    const newTask = {
      id: nextId++,
      title,
      description: description || '',
      status: 'pending',
      priority,
      user_id: req.user._id.toString(),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    tasks.push(newTask);
    
    // 记录创建日志
    await SystemLog.createLog({
      level: 'info',
      module: 'task',
      action: 'create_task',
      message: `创建任务: ${title}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 201,
      metadata: {
        task_id: newTask.id,
        title: newTask.title
      }
    });
    
    res.status(201).json({
      success: true,
      message: '任务创建成功',
      data: { task: newTask },
      code: 201,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 更新任务
router.put('/:task_id', authenticate, async (req, res, next) => {
  try {
    const { task_id } = req.params;
    const { title, description, status, priority } = req.body;
    
    const taskIndex = tasks.findIndex(t => t.id === parseInt(task_id) && t.user_id === req.user._id.toString());
    
    if (taskIndex === -1) {
      return next(new AppError('任务不存在', 404, 4040));
    }
    
    // 验证状态
    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '状态必须是pending、in_progress或completed',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 验证优先级
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: '优先级必须是low、medium或high',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    // 更新任务
    const task = tasks[taskIndex];
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    task.updated_at = new Date();
    
    // 记录更新日志
    await SystemLog.createLog({
      level: 'info',
      module: 'task',
      action: 'update_task',
      message: `更新任务: ${task.title}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        task_id: task.id,
        title: task.title
      }
    });
    
    res.json({
      success: true,
      message: '任务更新成功',
      data: { task },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 删除任务
router.delete('/:task_id', authenticate, async (req, res, next) => {
  try {
    const { task_id } = req.params;
    
    const taskIndex = tasks.findIndex(t => t.id === parseInt(task_id) && t.user_id === req.user._id.toString());
    
    if (taskIndex === -1) {
      return next(new AppError('任务不存在', 404, 4040));
    }
    
    const task = tasks[taskIndex];
    tasks.splice(taskIndex, 1);
    
    // 记录删除日志
    await SystemLog.createLog({
      level: 'info',
      module: 'task',
      action: 'delete_task',
      message: `删除任务: ${task.title}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        task_id: task.id,
        title: task.title
      }
    });
    
    res.json({
      success: true,
      message: '任务删除成功',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 