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

// 构建排序对象
const buildSortObject = (sort) => {
  const sortOrder = sort.startsWith('-') ? -1 : 1;
  const sortField = sort.replace('-', '');
  return { [sortField]: sortOrder };
};

// 构建日期范围查询
const buildDateRangeQuery = (dateFrom, dateTo, field = 'created_at') => {
  const query = {};
  if (dateFrom || dateTo) {
    query[field] = {};
    if (dateFrom) {
      query[field].$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query[field].$lte = endDate;
    }
  }
  return query;
};

// 构建金额范围查询
const buildAmountRangeQuery = (amountFrom, amountTo, field = 'amount') => {
  const query = {};
  if (amountFrom || amountTo) {
    query[field] = {};
    if (amountFrom) {
      query[field].$gte = parseFloat(amountFrom);
    }
    if (amountTo) {
      query[field].$lte = parseFloat(amountTo);
    }
  }
  return query;
};

// 获取客户端IP地址
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         '127.0.0.1';
};

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 生成随机字符串
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 验证文件类型
const isValidFileType = (mimetype, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']) => {
  return allowedTypes.includes(mimetype);
};

// 清理对象（移除空值）
const cleanObject = (obj) => {
  const cleaned = {};
  for (const key in obj) {
    if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};

module.exports = {
  buildPaginationResponse,
  buildSortObject,
  buildDateRangeQuery,
  buildAmountRangeQuery,
  getClientIP,
  formatFileSize,
  generateRandomString,
  isValidFileType,
  cleanObject
}; 