const express = require('express');
const User = require('../models/User');
const Loan = require('../models/Loan');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorize } = require('../middleware/auth');
const AppError = require('../utils/AppError');

const router = express.Router();

// 管理员仪表盘
router.get('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // 基础统计数据
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const totalLoans = await Loan.countDocuments();
    const pendingLoans = await Loan.countDocuments({ status: 'pending' });
    
    // 贷款统计
    const loanStats = await Loan.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // 计算总金额
    const totalAmount = loanStats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    const approvedAmount = loanStats
      .filter(stat => stat._id === 'approved')
      .reduce((sum, stat) => sum + stat.totalAmount, 0);
    
    // 月度贷款趋势 (最近12个月)
    const monthlyTrends = await Loan.aggregate([
      {
        $match: {
          application_date: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$application_date' },
            month: { $month: '$application_date' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          },
          count: 1,
          amount: 1
        }
      }
    ]);
    
    // 银行分布统计
    const bankDistribution = await Loan.aggregate([
      {
        $group: {
          _id: '$bank',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // 最近活动 (最近7天的日志)
    const recentActivities = await SystemLog.find({
      created_at: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      level: { $in: ['info', 'warning', 'error'] }
    })
      .populate('user_id', 'username real_name')
      .sort({ created_at: -1 })
      .limit(10)
      .select('level module action message username created_at user_id');
    
    // 系统健康状态
    const errorCount = await SystemLog.countDocuments({
      level: 'error',
      created_at: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
      }
    });
    
    const warningCount = await SystemLog.countDocuments({
      level: 'warning',
      created_at: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    });
    
    // 状态分布
    const statusDistribution = {
      active: loanStats.active_loans || 0,
      completed: loanStats.completed_loans || 0
    };
    
    const overview = {
      total_users: totalUsers,
      total_loans: loanStats.total_loans,
      active_loans: loanStats.active_loans,
      completed_loans: loanStats.completed_loans,
      total_amount: loanStats.total_amount,
      average_amount: loanStats.average_amount
    };
    
    res.json({
      success: true,
      message: '获取管理员仪表盘数据成功',
      data: {
        overview: overview,
        loan_status_distribution: statusDistribution,
        monthly_trends: monthlyTrends,
        bank_distribution: bankDistribution,
        recent_activities: recentActivities,
        system_health: {
          recent_errors: errorCount,
          recent_warnings: warningCount,
          status: errorCount > 10 ? 'critical' : errorCount > 5 ? 'warning' : 'healthy'
        }
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 用户仪表盘
router.get('/user', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // 用户的贷款统计
    const userLoans = await Loan.find({ applicant_id: userId });
    const totalLoans = userLoans.length;
    
    // 按状态分组
    const statusStats = userLoans.reduce((acc, loan) => {
      acc[loan.status] = (acc[loan.status] || 0) + 1;
      return acc;
    }, {});
    
    // 总申请金额
    const totalAmount = userLoans.reduce((sum, loan) => sum + loan.amount, 0);
    
    // 最近的贷款申请
    const recentLoans = await Loan.find({ applicant_id: userId })
      .sort({ created_at: -1 })
      .limit(5)
      .select('loan_name amount status application_date');
    
    // 月度申请趋势 (最近6个月)
    const monthlyApplications = await Loan.aggregate([
      {
        $match: {
          applicant_id: userId,
          application_date: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$application_date' },
            month: { $month: '$application_date' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          },
          count: 1,
          amount: 1
        }
      }
    ]);
    
    // 待办事项 - 显示活跃贷款的下期还款提醒
    const activeLoans = await Loan.find({ 
      applicant_id: userId, 
      status: 'active' 
    }).select('loan_name amount application_date next_payment_date');
    
    const pendingItems = activeLoans
      .filter(loan => loan.next_payment_date && loan.next_payment_date <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7天内到期
      .map(loan => ({
        id: loan._id,
        type: 'payment_due',
        title: `还款提醒：${loan.loan_name}`,
        description: `下期还款日期：${loan.next_payment_date?.toLocaleDateString()}`,
        date: loan.next_payment_date
      }));
    
    res.json({
      success: true,
      message: '获取用户仪表盘数据成功',
      data: {
        overview: {
          total_loans: totalLoans,
          active_loans: statusStats.active || 0,
          completed_loans: statusStats.completed || 0,
          total_amount: totalAmount
        },
        status_distribution: {
          active: statusStats.active || 0,
          completed: statusStats.completed || 0
        },
        recent_loans: recentLoans,
        monthly_applications: monthlyApplications,
        pending_items: pendingItems
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 快速统计 (通用)
router.get('/quick-stats', authenticate, async (req, res, next) => {
  try {
    let stats;
    
    if (req.user.role === 'admin') {
      // 管理员快速统计
      const [totalUsers, totalLoans, pendingLoans, recentErrors] = await Promise.all([
        User.countDocuments(),
        Loan.countDocuments(),
        Loan.countDocuments({ status: 'pending' }),
        SystemLog.countDocuments({
          level: 'error',
          created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);
      
      stats = {
        total_users: totalUsers,
        total_loans: totalLoans,
        pending_loans: pendingLoans,
        recent_errors: recentErrors
      };
    } else {
      // 用户快速统计
      const userLoans = await Loan.find({ applicant_id: req.user._id });
      const pending = userLoans.filter(loan => loan.status === 'pending').length;
      const approved = userLoans.filter(loan => loan.status === 'approved').length;
      
      stats = {
        total_loans: userLoans.length,
        pending_loans: pending,
        approved_loans: approved,
        total_amount: userLoans.reduce((sum, loan) => sum + loan.amount, 0)
      };
    }
    
    res.json({
      success: true,
      message: '获取快速统计成功',
      data: stats,
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 