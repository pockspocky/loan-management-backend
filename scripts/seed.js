#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 导入模型
const User = require('../src/models/User');
const SystemLog = require('../src/models/SystemLog');

// 连接数据库
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  }
};

// 创建管理员账户
const createAdminUser = async () => {
  try {
    // 检查是否已存在管理员
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️  管理员账户已存在');
      console.log(`   用户名: ${existingAdmin.username}`);
      console.log(`   邮箱: ${existingAdmin.email}`);
      return;
    }

    // 创建默认管理员账户
    const adminData = {
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123456',
      real_name: '系统管理员',
      phone: '13800138000',
      role: 'admin',
      status: 'active'
    };

    const admin = new User(adminData);
    await admin.save();

    // 记录创建日志
    await SystemLog.createLog({
      level: 'info',
      module: 'system',
      action: 'create_admin',
      message: '创建默认管理员账户',
      user_id: admin._id,
      username: admin.username,
      ip_address: '127.0.0.1',
      user_agent: 'System Seed Script',
      request_method: 'SEED',
      request_url: '/seed',
      response_status: 201,
      metadata: {
        admin_id: admin._id,
        username: admin.username,
        email: admin.email
      }
    });

    console.log('✅ 管理员账户创建成功');
    console.log(`   用户名: ${admin.username}`);
    console.log(`   邮箱: ${admin.email}`);
    console.log(`   密码: ${adminData.password}`);
    console.log('');
    console.log('⚠️  请在生产环境中立即修改默认密码！');

  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error.message);
    throw error;
  }
};

// 创建示例数据
const createSampleData = async () => {
  try {
    // 检查是否已有用户数据
    const userCount = await User.countDocuments();
    
    if (userCount > 1) {
      console.log('⚠️  示例数据已存在，跳过创建');
      return;
    }

    // 创建示例用户
    const sampleUsers = [
      {
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
        real_name: '张三',
        phone: '13800138001',
        role: 'user',
        status: 'active'
      },
      {
        username: 'user2',
        email: 'user2@example.com',
        password: 'password123',
        real_name: '李四',
        phone: '13800138002',
        role: 'user',
        status: 'active'
      }
    ];

    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      
      console.log(`✅ 创建示例用户: ${user.username}`);
    }

    console.log('✅ 示例数据创建完成');

  } catch (error) {
    console.error('❌ 创建示例数据失败:', error.message);
    throw error;
  }
};

// 主函数
const main = async () => {
  try {
    console.log('🌱 开始初始化数据库...');
    console.log('');

    await connectDB();
    await createAdminUser();
    
    // 询问是否创建示例数据
    const args = process.argv.slice(2);
    if (args.includes('--sample') || args.includes('-s')) {
      await createSampleData();
    }

    console.log('');
    console.log('🎉 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📦 数据库连接已关闭');
    process.exit(0);
  }
};

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { createAdminUser, createSampleData }; 