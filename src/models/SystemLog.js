const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['debug', 'info', 'warning', 'error'],
    default: 'info',
    required: true
  },
  module: {
    type: String,
    enum: ['auth', 'loan', 'user', 'system', 'upload'],
    required: true
  },
  action: {
    type: String,
    required: true,
    maxlength: [100, 'Action最多100个字符']
  },
  message: {
    type: String,
    required: true,
    maxlength: [500, '消息最多500个字符']
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  username: {
    type: String,
    default: null
  },
  ip_address: {
    type: String,
    required: true
  },
  user_agent: {
    type: String,
    default: null
  },
  request_method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'SEED'],
    default: null
  },
  request_url: {
    type: String,
    default: null
  },
  response_status: {
    type: Number,
    default: null
  },
  response_time: {
    type: Number, // 响应时间（毫秒）
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error_details: {
    type: String,
    default: null
  },
  stack_trace: {
    type: String,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false // 日志不需要更新时间
  },
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// 索引
systemLogSchema.index({ level: 1 });
systemLogSchema.index({ module: 1 });
systemLogSchema.index({ user_id: 1 });
systemLogSchema.index({ created_at: -1 });
systemLogSchema.index({ ip_address: 1 });
systemLogSchema.index({ 'level': 1, 'created_at': -1 });
systemLogSchema.index({ 'module': 1, 'created_at': -1 });

// 静态方法：创建日志
systemLogSchema.statics.createLog = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('创建日志失败:', error);
  }
};

// 静态方法：清理旧日志（保留最近30天）
systemLogSchema.statics.cleanOldLogs = async function(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  try {
    const result = await this.deleteMany({
      created_at: { $lt: cutoffDate }
    });
    console.log(`清理了 ${result.deletedCount} 条旧日志`);
    return result;
  } catch (error) {
    console.error('清理旧日志失败:', error);
  }
};

// 静态方法：获取日志统计
systemLogSchema.statics.getStatistics = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  try {
    const stats = await this.aggregate([
      {
        $match: {
          created_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            level: '$level',
            module: '$module',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$created_at'
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.level',
          total: { $sum: '$count' },
          dailyStats: {
            $push: {
              date: '$_id.date',
              module: '$_id.module',
              count: '$count'
            }
          }
        }
      }
    ]);
    
    return stats;
  } catch (error) {
    console.error('获取日志统计失败:', error);
    return [];
  }
};

module.exports = mongoose.model('SystemLog', systemLogSchema); 