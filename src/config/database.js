const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`✅ MongoDB 连接成功: ${conn.connection.host}/${conn.connection.name}`);

    // 监听连接事件
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB 连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB 连接断开');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB 重新连接');
    });

  } catch (error) {
    logger.error('❌ MongoDB 连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB; 