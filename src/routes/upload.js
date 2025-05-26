const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const SystemLog = require('../models/SystemLog');
const { authenticate } = require('../middleware/auth');
const AppError = require('../utils/AppError');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('不支持的文件类型', 400, 3002), false);
  }
};

// 配置multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 上传单个文件
router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('请选择要上传的文件', 400, 4000));
    }
    
    const { type = 'document' } = req.body;
    const file = req.file;
    
    // 生成文件ID和URL
    const fileId = path.parse(file.filename).name;
    const fileUrl = `/uploads/${file.filename}`;
    
    // 记录上传日志
    await SystemLog.createLog({
      level: 'info',
      module: 'upload',
      action: 'upload_file',
      message: `文件上传: ${file.originalname}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        file_id: fileId,
        original_name: file.originalname,
        filename: file.filename,
        size: file.size,
        type: file.mimetype,
        upload_type: type
      }
    });
    
    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        file_id: fileId,
        filename: file.filename,
        original_name: file.originalname,
        size: file.size,
        formatted_size: formatFileSize(file.size),
        type: file.mimetype,
        upload_type: type,
        url: fileUrl
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 如果有文件已保存，删除它
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// 上传多个文件
router.post('/multiple', authenticate, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(new AppError('请选择要上传的文件', 400, 4000));
    }
    
    const { type = 'document' } = req.body;
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const fileId = path.parse(file.filename).name;
      const fileUrl = `/uploads/${file.filename}`;
      
      uploadedFiles.push({
        file_id: fileId,
        filename: file.filename,
        original_name: file.originalname,
        size: file.size,
        formatted_size: formatFileSize(file.size),
        type: file.mimetype,
        upload_type: type,
        url: fileUrl
      });
    }
    
    // 记录批量上传日志
    await SystemLog.createLog({
      level: 'info',
      module: 'upload',
      action: 'upload_multiple_files',
      message: `批量文件上传: ${req.files.length}个文件`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        file_count: req.files.length,
        files: uploadedFiles.map(f => ({
          file_id: f.file_id,
          original_name: f.original_name,
          size: f.size
        }))
      }
    });
    
    res.json({
      success: true,
      message: `成功上传${req.files.length}个文件`,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // 如果有文件已保存，删除它们
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    next(error);
  }
});

// 删除文件
router.delete('/:file_id', authenticate, async (req, res, next) => {
  try {
    const { file_id } = req.params;
    
    // 查找匹配的文件
    const files = fs.readdirSync(uploadDir);
    const targetFile = files.find(file => file.startsWith(file_id));
    
    if (!targetFile) {
      return next(new AppError('文件不存在', 404, 4040));
    }
    
    const filePath = path.join(uploadDir, targetFile);
    
    // 删除文件
    fs.unlinkSync(filePath);
    
    // 记录删除日志
    await SystemLog.createLog({
      level: 'warning',
      module: 'upload',
      action: 'delete_file',
      message: `删除文件: ${targetFile}`,
      user_id: req.user._id,
      username: req.user.username,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      request_method: req.method,
      request_url: req.originalUrl,
      response_status: 200,
      metadata: {
        file_id: file_id,
        filename: targetFile
      }
    });
    
    res.json({
      success: true,
      message: '文件删除成功',
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 获取文件信息
router.get('/:file_id/info', authenticate, async (req, res, next) => {
  try {
    const { file_id } = req.params;
    
    // 查找匹配的文件
    const files = fs.readdirSync(uploadDir);
    const targetFile = files.find(file => file.startsWith(file_id));
    
    if (!targetFile) {
      return next(new AppError('文件不存在', 404, 4040));
    }
    
    const filePath = path.join(uploadDir, targetFile);
    const stats = fs.statSync(filePath);
    
    res.json({
      success: true,
      message: '获取文件信息成功',
      data: {
        file_id: file_id,
        filename: targetFile,
        size: stats.size,
        formatted_size: formatFileSize(stats.size),
        created_at: stats.birthtime,
        modified_at: stats.mtime,
        url: `/uploads/${targetFile}`
      },
      code: 200,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 