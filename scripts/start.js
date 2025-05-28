#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 检查环境变量文件
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ 错误: .env 文件不存在');
  console.log('📝 请复制 .env.example 到 .env 并配置环境变量');
  process.exit(1);
}

// 加载环境变量
require('dotenv').config({ path: envPath });

// 检查必要的环境变量
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ 错误: 缺少必要的环境变量:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.log('📝 请在 .env 文件中配置这些变量');
  process.exit(1);
}

// 创建必要的目录
const directories = [
  path.join(__dirname, '../logs'),
  path.join(__dirname, '../uploads')
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 创建目录: ${dir}`);
  }
});

console.log('🚀 启动贷款管理系统后端服务...');
console.log(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 数据库: ${process.env.MONGODB_URI}`);
console.log(`🌐 端口: ${process.env.PORT || 8080}`);
console.log('');

// 启动应用
require('../src/app.js'); 