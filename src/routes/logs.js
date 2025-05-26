const express = require('express');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, logQuerySchema } = require('../utils/validation');
const { buildPaginationResponse, buildSortObject, buildDateRangeQuery } = require('../utils/helpers');
const AppError = require('../utils/AppError');

const router = express.Router();

// 构建日志查询条件
const buildLogQuery = (query) => {
  const filter = {};
  
  // 按日志级别筛选
  if (query.level) {
    filter.level = query.level;
  }
  
  // 按模块筛选
  if (query.module) {
    filter.module = query.module;
  }
  
  // 按用户ID筛选
  if (query.user_id) {
    filter.user_id = query.user_id;
  }
  
  // 按日期范围筛选
  const dateFilter = buildDateRangeQuery(query.date_from, query.date_to, 'created_at');
  if (Object.keys(dateFilter).length > 0) {
    Object.assign(filter, dateFilter);
  }
  
  // 搜索功能
  if (query.search) {
    filter.$or = [
      { message: { $regex: query.search, $options: 'i' } },
      { username: { $regex: query.search, $options: 'i' } },
      { action: { $regex: query.search, $options: 'i' } }
    ];
  }
  
  return filter;
};

// 获取系统日志列表 (仅管理员)
router.get('/', authenticate, authorize('admin'), validate(logQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, per_page, sort, ...queryParams } = req.query;
    
    const filter = buildLogQuery(queryParams);
    const sortObj = buildSortObject(sort);
    
    // 计算跳过的文档数
    const skip = (page - 1) * per_page;
    
    // 查询日志列表
    const logs = await SystemLog.find(filter)
      .populate('user_id', 'username real_name email')
      .sort(sortObj)
      .skip(skip)
      .limit(per_page);
    
    // 获取总数
    const total = await SystemLog.countDocuments(filter);
    
    const responseData = buildPaginationResponse(logs, page, per_page, total);
    
    res.json({
      success: true,
      message: '获取系统日志成功',
      data: responseData,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个日志详情 (仅管理员)
router.get('/:log_id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { log_id } = req.params;
    
    const log = await SystemLog.findById(log_id)
      .populate('user_id', 'username real_name email');
    
    if (!log) {
      return next(new AppError('日志不存在', 404, 4040));
    }
    
    res.json({
      success: true,
      message: '获取日志详情成功',
      data: { log },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取日志统计信息 (仅管理员)
router.get('/statistics', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    
    const stats = await SystemLog.getStatistics(parseInt(days));
    
    // 获取各级别日志数量
    const levelStats = await SystemLog.aggregate([
      {
        $match: {
          created_at: { 
            $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) 
          }
        }
      },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 获取各模块日志数量
    const moduleStats = await SystemLog.aggregate([
      {
        $match: {
          created_at: { 
            $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) 
          }
        }
      },
      {
        $group: {
          _id: '$module',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      message: '获取日志统计成功',
      data: {
        period_days: parseInt(days),
        level_stats: levelStats,
        module_stats: moduleStats,
        detailed_stats: stats
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 清理旧日志 (仅管理员)
router.post('/cleanup', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { days_to_keep = 30 } = req.body;
    
    if (days_to_keep < 1 || days_to_keep > 365) {
      return next(new AppError('保留天数必须在1-365之间', 400, 4000));
    }
    
    const result = await SystemLog.cleanOldLogs(days_to_keep);
    
    // 记录清理日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'system',
      action: 'cleanup_logs',
      message: `管理员清理系统日志，保留${days_to_keep}天，删除${result.deletedCount}条记录`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        days_to_keep,
        deleted_count: result.deletedCount
      }
    });
    
    res.json({
      success: true,
      message: `成功清理${result.deletedCount}条旧日志`,
      data: {
        deleted_count: result.deletedCount,
        days_kept: days_to_keep
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 