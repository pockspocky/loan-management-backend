/**
 * 字段命名转换工具
 * 用于前后端字段命名不一致的问题
 * 前端使用 camelCase，后端使用 snake_case
 */

/**
 * 将 camelCase 转换为 snake_case
 * @param {Object} obj - 要转换的对象
 * @returns {Object} 转换后的对象
 */
function camelToSnake(obj) {
  if (!obj || typeof obj !== 'object' || obj instanceof Date || Array.isArray(obj)) {
    return obj;
  }
  
  const newObj = {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      // 将 camelCase 转换为 snake_case
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      // 递归处理嵌套对象
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
        newObj[snakeKey] = camelToSnake(obj[key]);
      } else {
        newObj[snakeKey] = obj[key];
      }
    }
  }
  return newObj;
}

/**
 * 将 snake_case 转换为 camelCase
 * @param {Object} obj - 要转换的对象
 * @returns {Object} 转换后的对象
 */
function snakeToCamel(obj) {
  if (!obj || typeof obj !== 'object' || obj instanceof Date || Array.isArray(obj)) {
    return obj;
  }
  
  const newObj = {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      // 将 snake_case 转换为 camelCase
      const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      
      // 递归处理嵌套对象
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
        newObj[camelKey] = snakeToCamel(obj[key]);
      } else {
        newObj[camelKey] = obj[key];
      }
    }
  }
  return newObj;
}

/**
 * 批量转换对象数组
 * @param {Array} arr - 要转换的对象数组
 * @param {Function} converter - 转换函数
 * @returns {Array} 转换后的数组
 */
function convertArray(arr, converter) {
  if (!Array.isArray(arr)) {
    return arr;
  }
  
  return arr.map(item => converter(item));
}

/**
 * 深度转换对象，处理嵌套数组
 * @param {*} data - 要转换的数据
 * @param {Function} converter - 转换函数
 * @returns {*} 转换后的数据
 */
function deepConvert(data, converter) {
  if (Array.isArray(data)) {
    return data.map(item => deepConvert(item, converter));
  } else if (data && typeof data === 'object' && !(data instanceof Date)) {
    const converted = converter(data);
    const result = {};
    for (let key in converted) {
      if (converted.hasOwnProperty(key)) {
        result[key] = deepConvert(converted[key], converter);
      }
    }
    return result;
  }
  return data;
}

/**
 * 中间件：自动转换请求体字段名
 * @param {Function} converter - 转换函数
 * @returns {Function} Express 中间件
 */
function createFieldConverter(converter) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = deepConvert(req.body, converter);
    }
    
    if (req.query && typeof req.query === 'object') {
      req.query = deepConvert(req.query, converter);
    }
    
    next();
  };
}

// 预定义的中间件
const camelToSnakeMiddleware = createFieldConverter(camelToSnake);
const snakeToCamelMiddleware = createFieldConverter(snakeToCamel);

module.exports = {
  camelToSnake,
  snakeToCamel,
  convertArray,
  deepConvert,
  createFieldConverter,
  camelToSnakeMiddleware,
  snakeToCamelMiddleware
}; 