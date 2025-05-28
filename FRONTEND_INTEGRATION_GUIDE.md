# 前端对接指南 📱

## 📋 目录
- [基础配置](#基础配置)
- [认证流程](#认证流程)
- [API接口详解](#api接口详解)
- [前端示例代码](#前端示例代码)
- [错误处理](#错误处理)
- [状态管理](#状态管理)
- [文件上传](#文件上传)
- [WebSocket连接](#websocket连接)
- [安全注意事项](#安全注意事项)
- [调试技巧](#调试技巧)

## 🔧 基础配置

### API 基础信息
```javascript
const API_CONFIG = {
  BASE_URL: 'http://localhost:8080/api/v1',  // 开发环境
  // BASE_URL: 'https://api.yourdomain.com/v1',  // 生产环境
  TIMEOUT: 30000,  // 30秒超时
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};
```

### HTTP 客户端配置 (Axios 示例)
```javascript
import axios from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// 请求拦截器 - 添加Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求ID用于调试
    config.headers['X-Request-ID'] = generateRequestId();
    
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      data: config.data,
      headers: config.headers
    });
    
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Token过期自动刷新
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await refreshAccessToken(refreshToken);
          localStorage.setItem('token', response.data.token);
          originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // 刷新失败，重定向到登录页
        logout();
        window.location.href = '/login';
      }
    }
    
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    
    return Promise.reject(error);
  }
);

// 生成请求ID
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
```

## 🔐 认证流程

### 1. 用户注册
```javascript
/**
 * 用户注册
 * @param {Object} userData - 用户数据
 * @param {string} userData.username - 用户名 (3-20字符)
 * @param {string} userData.email - 邮箱
 * @param {string} userData.password - 密码 (最少6位)
 * @param {string} userData.real_name - 真实姓名
 * @param {string} userData.phone - 手机号
 * @param {string} userData.id_card - 身份证号
 */
async function registerUser(userData) {
  try {
    const response = await apiClient.post('/auth/register', {
      username: userData.username,
      email: userData.email,
      password: userData.password,
      real_name: userData.real_name,
      phone: userData.phone,
      id_card: userData.id_card
    });
    
    // 注册成功后的处理
    if (response.data.success) {
      console.log('注册成功:', response.data.message);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例
const registrationData = {
  username: 'newuser',
  email: 'newuser@example.com',
  password: 'securepassword123',
  real_name: '张三',
  phone: '13900139000',
  id_card: '110101199001011234'
};

const result = await registerUser(registrationData);
if (result.success) {
  // 注册成功，跳转到登录页或自动登录
  router.push('/login');
} else {
  // 显示错误信息
  showErrorMessage(result.message);
}
```

### 2. 用户登录
```javascript
/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {boolean} rememberMe - 是否记住登录状态
 */
async function loginUser(username, password, rememberMe = false) {
  try {
    const response = await apiClient.post('/auth/login', {
      username,
      password
    });
    
    if (response.data.success) {
      const { token, user } = response.data.data;
      
      // 存储认证信息
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', token);
      storage.setItem('user', JSON.stringify(user));
      
      // 更新全局状态
      updateUserState(user);
      
      return {
        success: true,
        data: { token, user },
        message: response.data.message
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例
const loginResult = await loginUser('admin', 'admin123456', true);
if (loginResult.success) {
  // 登录成功，跳转到仪表盘
  router.push('/dashboard');
} else {
  // 显示错误信息
  showErrorMessage(loginResult.message);
}
```

### 3. 获取当前用户信息
```javascript
/**
 * 获取当前登录用户信息
 */
async function getCurrentUser() {
  try {
    const response = await apiClient.get('/auth/me');
    
    if (response.data.success) {
      const user = response.data.data;
      
      // 更新本地存储的用户信息
      localStorage.setItem('user', JSON.stringify(user));
      updateUserState(user);
      
      return {
        success: true,
        data: user
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 4. 用户登出
```javascript
/**
 * 用户登出
 */
async function logout() {
  try {
    // 调用后端登出接口
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // 无论接口调用是否成功都要清理本地数据
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    // 清空用户状态
    updateUserState(null);
    
    // 跳转到登录页
    window.location.href = '/login';
  }
}
```

## 📡 API接口详解

### 用户管理

#### 获取用户列表 (仅管理员)
```javascript
/**
 * 获取用户列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码 (默认: 1)
 * @param {number} params.per_page - 每页数量 (默认: 20, 最大: 100)
 * @param {string} params.search - 搜索关键词
 * @param {string} params.role - 角色筛选 (admin|user)
 * @param {string} params.status - 状态筛选 (active|inactive|suspended)
 */
async function getUserList(params = {}) {
  try {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      per_page: Math.min(params.per_page || 20, 100),
      ...(params.search && { search: params.search }),
      ...(params.role && { role: params.role }),
      ...(params.status && { status: params.status })
    });
    
    const response = await apiClient.get(`/users?${queryParams}`);
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data.items,
        pagination: response.data.data.pagination
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例
const userListResult = await getUserList({
  page: 1,
  per_page: 20,
  search: '张三',
  role: 'user',
  status: 'active'
});

if (userListResult.success) {
  const { data: users, pagination } = userListResult;
  
  // 更新用户列表UI
  updateUserListUI(users);
  updatePaginationUI(pagination);
}
```

#### 更新用户信息
```javascript
/**
 * 更新用户信息
 * @param {string} userId - 用户ID
 * @param {Object} updateData - 更新数据
 */
async function updateUserInfo(userId, updateData) {
  try {
    const response = await apiClient.put(`/users/${userId}`, {
      email: updateData.email,
      real_name: updateData.real_name,
      phone: updateData.phone,
      avatar: updateData.avatar
    });
    
    if (response.data.success) {
      const updatedUser = response.data.data;
      
      // 如果是当前用户，更新本地存储
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser.id === userId) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        updateUserState(updatedUser);
      }
      
      return {
        success: true,
        data: updatedUser,
        message: response.data.message
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 贷款管理

#### 创建贷款申请
```javascript
/**
 * 创建贷款申请
 * @param {Object} loanData - 贷款数据
 */
async function createLoanApplication(loanData) {
  try {
    // 数据验证
    const validationResult = validateLoanData(loanData);
    if (!validationResult.valid) {
      return {
        success: false,
        message: validationResult.message,
        errors: validationResult.errors
      };
    }
    
    const response = await apiClient.post('/loans', {
      loan_name: loanData.loan_name,
      amount: Number(loanData.amount),
      interest_rate: Number(loanData.interest_rate),
      bank: loanData.bank,
      term: Number(loanData.term),
      repayment_method: loanData.repayment_method,
      purpose: loanData.purpose || '',
      collateral: loanData.collateral || '',
      attachments: loanData.attachments || []
    });
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 数据验证函数
function validateLoanData(data) {
  const errors = {};
  
  if (!data.loan_name || data.loan_name.trim().length < 2) {
    errors.loan_name = '贷款名称至少2个字符';
  }
  
  if (!data.amount || data.amount <= 0) {
    errors.amount = '贷款金额必须大于0';
  }
  
  if (!data.interest_rate || data.interest_rate < 0 || data.interest_rate > 100) {
    errors.interest_rate = '利率必须在0-100之间';
  }
  
  if (!data.bank || data.bank.trim().length < 2) {
    errors.bank = '银行名称至少2个字符';
  }
  
  if (!data.term || data.term < 1 || data.term > 360) {
    errors.term = '贷款期限必须在1-360个月之间';
  }
  
  if (!data.repayment_method || !['equal_payment', 'equal_principal'].includes(data.repayment_method)) {
    errors.repayment_method = '还款方式无效';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    message: Object.keys(errors).length > 0 ? '数据验证失败' : ''
  };
}

// 使用示例
const loanData = {
  loan_name: '房屋贷款',
  amount: 500000,
  interest_rate: 4.5,
  bank: '中国银行',
  term: 240,
  repayment_method: 'equal_payment',
  purpose: '购买住房',
  collateral: '房产抵押',
  attachments: ['file_id_1', 'file_id_2']
};

const result = await createLoanApplication(loanData);
if (result.success) {
  showSuccessMessage('贷款申请提交成功');
  router.push('/loans');
} else {
  showErrorMessage(result.message);
  if (result.errors) {
    highlightFormErrors(result.errors);
  }
}
```

#### 获取贷款列表
```javascript
/**
 * 获取贷款列表
 * @param {Object} params - 查询参数
 */
async function getLoanList(params = {}) {
  try {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      per_page: Math.min(params.per_page || 20, 100),
      ...(params.status && { status: params.status }),
      ...(params.applicant_id && { applicant_id: params.applicant_id }),
      ...(params.bank && { bank: params.bank }),
      ...(params.amount_min && { amount_min: params.amount_min }),
      ...(params.amount_max && { amount_max: params.amount_max }),
      ...(params.date_from && { date_from: params.date_from }),
      ...(params.date_to && { date_to: params.date_to })
    });
    
    const response = await apiClient.get(`/loans?${queryParams}`);
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data.items,
        pagination: response.data.data.pagination
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例 - 管理员查看所有贷款
const allLoansResult = await getLoanList({
  page: 1,
  per_page: 20,
  status: 'pending'
});

// 使用示例 - 用户查看自己的贷款
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
const myLoansResult = await getLoanList({
  page: 1,
  per_page: 10,
  applicant_id: currentUser.id
});
```

#### 贷款审批 (仅管理员)
```javascript
/**
 * 审批贷款
 * @param {string} loanId - 贷款ID
 * @param {Object} approvalData - 审批数据
 */
async function approveLoan(loanId, approvalData) {
  try {
    const response = await apiClient.patch(`/loans/${loanId}/approve`, {
      status: approvalData.status, // 'approved' | 'rejected'
      remark: approvalData.remark || '',
      approved_amount: approvalData.status === 'approved' ? Number(approvalData.approved_amount) : undefined,
      approved_rate: approvalData.status === 'approved' ? Number(approvalData.approved_rate) : undefined
    });
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例 - 审批通过
const approveResult = await approveLoan('loan_id_123', {
  status: 'approved',
  approved_amount: 450000,
  approved_rate: 4.2,
  remark: '申请材料齐全，风险评估通过'
});

// 使用示例 - 审批拒绝
const rejectResult = await approveLoan('loan_id_123', {
  status: 'rejected',
  remark: '收入证明不足，建议增加担保人'
});
```

### 仪表盘数据

#### 管理员仪表盘
```javascript
/**
 * 获取管理员仪表盘数据
 */
async function getAdminDashboard() {
  try {
    const response = await apiClient.get('/dashboard/admin');
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例
const dashboardResult = await getAdminDashboard();
if (dashboardResult.success) {
  const {
    overview,
    recent_activities,
    charts
  } = dashboardResult.data;
  
  // 更新概览数据
  updateOverviewCards({
    totalUsers: overview.total_users,
    totalLoans: overview.total_loans,
    pendingApprovals: overview.pending_approvals,
    totalAmount: overview.total_amount
  });
  
  // 更新最近活动
  updateRecentActivities(recent_activities);
  
  // 更新图表
  updateDashboardCharts(charts);
}
```

#### 用户仪表盘
```javascript
/**
 * 获取用户仪表盘数据
 */
async function getUserDashboard() {
  try {
    const response = await apiClient.get('/dashboard/user');
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 使用示例
const userDashboardResult = await getUserDashboard();
if (userDashboardResult.success) {
  const {
    loans_overview,
    recent_loans,
    monthly_applications
  } = userDashboardResult.data;
  
  // 更新贷款概览
  updateLoansOverview(loans_overview);
  
  // 更新最近贷款
  updateRecentLoans(recent_loans);
  
  // 更新月度申请图表
  updateMonthlyChart(monthly_applications);
}
```

## 📁 文件上传

### 单文件上传
```javascript
/**
 * 上传单个文件
 * @param {File} file - 文件对象
 * @param {string} type - 文件类型 ('document'|'image'|'other')
 * @param {Function} onProgress - 进度回调
 */
async function uploadFile(file, type = 'document', onProgress = null) {
  try {
    // 文件验证
    const validationResult = validateFile(file);
    if (!validationResult.valid) {
      return {
        success: false,
        message: validationResult.message
      };
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      }
    });
    
    if (response.data.success) {
      return {
        success: true,
        data: response.data.data,
        message: response.data.message
      };
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// 文件验证函数
function validateFile(file) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif'
  ];
  
  if (!file) {
    return { valid: false, message: '请选择文件' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, message: '文件大小不能超过10MB' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      message: '不支持的文件类型，请上传PDF、Word文档或图片文件' 
    };
  }
  
  return { valid: true };
}

// 使用示例
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

const uploadResult = await uploadFile(file, 'document', (progress) => {
  updateProgressBar(progress);
});

if (uploadResult.success) {
  const fileData = uploadResult.data;
  
  // 添加到附件列表
  addAttachment({
    file_id: fileData.file_id,
    filename: fileData.filename,
    original_name: fileData.original_name,
    size: fileData.size,
    url: fileData.url
  });
  
  showSuccessMessage('文件上传成功');
} else {
  showErrorMessage(uploadResult.message);
}
```

### 多文件上传
```javascript
/**
 * 批量上传文件
 * @param {FileList} files - 文件列表
 * @param {Function} onProgress - 总进度回调
 * @param {Function} onFileProgress - 单文件进度回调
 */
async function uploadMultipleFiles(files, onProgress = null, onFileProgress = null) {
  const results = [];
  const total = files.length;
  let completed = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const result = await uploadFile(file, 'document', (progress) => {
        if (onFileProgress) {
          onFileProgress(i, progress, file.name);
        }
      });
      
      results.push({
        file: file.name,
        success: result.success,
        data: result.data,
        message: result.message
      });
      
      completed++;
      
      if (onProgress) {
        onProgress(Math.round((completed / total) * 100));
      }
      
    } catch (error) {
      results.push({
        file: file.name,
        success: false,
        message: error.message
      });
      completed++;
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  
  return {
    success: successCount > 0,
    results,
    summary: {
      total,
      success: successCount,
      failed: total - successCount
    }
  };
}
```

## ❌ 错误处理

### 统一错误处理函数
```javascript
/**
 * 统一API错误处理
 * @param {Error} error - 错误对象
 */
function handleApiError(error) {
  console.error('API Error:', error);
  
  if (error.response) {
    // 服务器响应的错误
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return {
          success: false,
          message: data.message || '请求参数错误',
          errors: data.errors || {},
          code: data.code
        };
        
      case 401:
        return {
          success: false,
          message: '登录已过期，请重新登录',
          needLogin: true
        };
        
      case 403:
        return {
          success: false,
          message: '权限不足，无法执行此操作',
          code: data.code
        };
        
      case 404:
        return {
          success: false,
          message: '请求的资源不存在',
          code: data.code
        };
        
      case 422:
        return {
          success: false,
          message: data.message || '数据验证失败',
          errors: data.errors || {},
          code: data.code
        };
        
      case 429:
        return {
          success: false,
          message: '请求过于频繁，请稍后再试',
          code: data.code
        };
        
      case 500:
        return {
          success: false,
          message: '服务器内部错误，请稍后再试',
          code: data.code
        };
        
      default:
        return {
          success: false,
          message: data.message || `请求失败 (${status})`,
          code: data.code
        };
    }
  } else if (error.request) {
    // 网络错误
    return {
      success: false,
      message: '网络连接失败，请检查网络设置',
      isNetworkError: true
    };
  } else {
    // 其他错误
    return {
      success: false,
      message: error.message || '未知错误',
      isUnknownError: true
    };
  }
}

// 错误信息显示函数
function showErrorMessage(message, duration = 5000) {
  // 这里使用你的UI库的通知组件
  // 例如 Element UI, Ant Design, 或自定义组件
  
  // Element UI 示例
  // this.$message.error(message);
  
  // Ant Design 示例
  // message.error(message);
  
  // 自定义通知示例
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    document.body.removeChild(notification);
  }, duration);
}

function showSuccessMessage(message, duration = 3000) {
  // 类似错误信息的处理方式
  const notification = document.createElement('div');
  notification.className = 'success-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    document.body.removeChild(notification);
  }, duration);
}
```

### 重试机制
```javascript
/**
 * 带重试的API请求
 * @param {Function} apiCall - API调用函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 重试延迟(毫秒)
 */
async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      
      // 如果是最后一次重试或者是不可重试的错误，直接抛出
      if (i === maxRetries || isNonRetryableError(error)) {
        throw error;
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  
  throw lastError;
}

// 判断是否为不可重试的错误
function isNonRetryableError(error) {
  if (!error.response) return false;
  
  const nonRetryableStatuses = [400, 401, 403, 404, 422];
  return nonRetryableStatuses.includes(error.response.status);
}

// 使用示例
try {
  const result = await retryApiCall(() => getLoanList({ page: 1 }));
  updateLoanListUI(result.data);
} catch (error) {
  const errorResult = handleApiError(error);
  showErrorMessage(errorResult.message);
}
```

## 🔄 状态管理

### Vuex 状态管理 (Vue.js 示例)
```javascript
// store/modules/auth.js
const authModule = {
  namespaced: true,
  
  state: {
    user: null,
    token: null,
    isAuthenticated: false,
    loginLoading: false
  },
  
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.isAuthenticated = !!user;
    },
    
    SET_TOKEN(state, token) {
      state.token = token;
    },
    
    SET_LOGIN_LOADING(state, loading) {
      state.loginLoading = loading;
    },
    
    CLEAR_AUTH(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    }
  },
  
  actions: {
    async login({ commit }, { username, password, rememberMe }) {
      commit('SET_LOGIN_LOADING', true);
      
      try {
        const result = await loginUser(username, password, rememberMe);
        
        if (result.success) {
          commit('SET_USER', result.data.user);
          commit('SET_TOKEN', result.data.token);
          
          return { success: true };
        } else {
          return result;
        }
      } catch (error) {
        return handleApiError(error);
      } finally {
        commit('SET_LOGIN_LOADING', false);
      }
    },
    
    async logout({ commit }) {
      try {
        await logout();
      } finally {
        commit('CLEAR_AUTH');
      }
    },
    
    async refreshUser({ commit, state }) {
      if (!state.token) return;
      
      try {
        const result = await getCurrentUser();
        if (result.success) {
          commit('SET_USER', result.data);
        }
      } catch (error) {
        console.error('Refresh user failed:', error);
      }
    }
  },
  
  getters: {
    isAdmin: state => state.user?.role === 'admin',
    isUser: state => state.user?.role === 'user',
    userInfo: state => state.user,
    isLoggedIn: state => state.isAuthenticated
  }
};

// store/modules/loans.js
const loansModule = {
  namespaced: true,
  
  state: {
    list: [],
    pagination: null,
    loading: false,
    currentLoan: null
  },
  
  mutations: {
    SET_LOANS(state, { loans, pagination }) {
      state.list = loans;
      state.pagination = pagination;
    },
    
    SET_LOADING(state, loading) {
      state.loading = loading;
    },
    
    SET_CURRENT_LOAN(state, loan) {
      state.currentLoan = loan;
    },
    
    ADD_LOAN(state, loan) {
      state.list.unshift(loan);
    },
    
    UPDATE_LOAN(state, updatedLoan) {
      const index = state.list.findIndex(loan => loan.id === updatedLoan.id);
      if (index !== -1) {
        state.list.splice(index, 1, updatedLoan);
      }
    }
  },
  
  actions: {
    async fetchLoans({ commit }, params) {
      commit('SET_LOADING', true);
      
      try {
        const result = await getLoanList(params);
        
        if (result.success) {
          commit('SET_LOANS', {
            loans: result.data,
            pagination: result.pagination
          });
        }
        
        return result;
      } finally {
        commit('SET_LOADING', false);
      }
    },
    
    async createLoan({ commit }, loanData) {
      const result = await createLoanApplication(loanData);
      
      if (result.success) {
        commit('ADD_LOAN', result.data);
      }
      
      return result;
    },
    
    async approveLoan({ commit }, { loanId, approvalData }) {
      const result = await approveLoan(loanId, approvalData);
      
      if (result.success) {
        commit('UPDATE_LOAN', result.data);
      }
      
      return result;
    }
  }
};
```

### Redux 状态管理 (React 示例)
```javascript
// reducers/authReducer.js
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null
  },
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    updateUser: (state, action) => {
      state.user = action.payload;
    }
  }
});

export const { loginStart, loginSuccess, loginFailure, logout, updateUser } = authSlice.actions;

// Async thunks
export const loginAsync = (username, password, rememberMe) => async (dispatch) => {
  dispatch(loginStart());
  
  try {
    const result = await loginUser(username, password, rememberMe);
    
    if (result.success) {
      dispatch(loginSuccess(result.data));
      return { success: true };
    } else {
      dispatch(loginFailure(result.message));
      return result;
    }
  } catch (error) {
    const errorResult = handleApiError(error);
    dispatch(loginFailure(errorResult.message));
    return errorResult;
  }
};

export default authSlice.reducer;
```

## 📱 响应式设计注意事项

### 移动端适配
```javascript
// 检测设备类型
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 根据设备调整分页参数
function getDeviceSpecificPagination() {
  return {
    per_page: isMobile() ? 10 : 20,
    // 移动端减少每页数量以提高加载速度
  };
}

// 移动端优化的文件上传
function optimizeFileForMobile(file) {
  if (!isMobile()) return file;
  
  // 移动端压缩图片
  if (file.type.startsWith('image/')) {
    return compressImage(file, 0.8, 1920); // 质量80%，最大宽度1920px
  }
  
  return file;
}
```

## 🚀 性能优化

### 请求缓存
```javascript
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5分钟TTL
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear() {
    this.cache.clear();
  }
}

const apiCache = new ApiCache();

// 带缓存的API调用
async function getCachedData(key, apiCall) {
  const cached = apiCache.get(key);
  if (cached) {
    return cached;
  }
  
  const result = await apiCall();
  if (result.success) {
    apiCache.set(key, result);
  }
  
  return result;
}

// 使用示例
const dashboardData = await getCachedData(
  'admin_dashboard',
  () => getAdminDashboard()
);
```

### 防抖搜索
```javascript
/**
 * 防抖搜索函数
 * @param {Function} searchFn - 搜索函数
 * @param {number} delay - 延迟时间(毫秒)
 */
function debounceSearch(searchFn, delay = 500) {
  let timeoutId;
  
  return function(searchTerm) {
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      searchFn(searchTerm);
    }, delay);
  };
}

// 使用示例
const debouncedUserSearch = debounceSearch(async (searchTerm) => {
  if (!searchTerm.trim()) return;
  
  const result = await getUserList({
    search: searchTerm,
    page: 1,
    per_page: 10
  });
  
  if (result.success) {
    updateSearchResults(result.data);
  }
}, 300);

// 绑定到搜索输入框
document.getElementById('search-input').addEventListener('input', (e) => {
  debouncedUserSearch(e.target.value);
});
```

## 🛡️ 安全注意事项

### XSS 防护
```javascript
/**
 * HTML转义函数
 * @param {string} str - 需要转义的字符串
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 安全显示用户输入内容
function safeDisplayText(text) {
  return escapeHtml(text);
}

// 使用示例
document.getElementById('user-name').innerHTML = safeDisplayText(user.real_name);
```

### CSRF 防护
```javascript
// 获取CSRF Token (如果后端支持)
function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
}

// 在请求中添加CSRF Token
apiClient.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

### 敏感数据处理
```javascript
/**
 * 脱敏显示身份证号
 * @param {string} idCard - 身份证号
 */
function maskIdCard(idCard) {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.substring(0, 6) + '******' + idCard.substring(idCard.length - 4);
}

/**
 * 脱敏显示手机号
 * @param {string} phone - 手机号
 */
function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

/**
 * 脱敏显示银行卡号
 * @param {string} cardNumber - 银行卡号
 */
function maskBankCard(cardNumber) {
  if (!cardNumber || cardNumber.length < 8) return cardNumber;
  return cardNumber.substring(0, 4) + ' **** **** ' + cardNumber.substring(cardNumber.length - 4);
}
```

## 🔧 调试技巧

### 开发环境调试
```javascript
// 开发环境下启用详细日志
if (process.env.NODE_ENV === 'development') {
  // 启用 axios 请求日志
  apiClient.interceptors.request.use((config) => {
    console.group(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    console.log('Headers:', config.headers);
    console.log('Data:', config.data);
    console.groupEnd();
    return config;
  });
  
  apiClient.interceptors.response.use(
    (response) => {
      console.group(`✅ API Response: ${response.config.url}`);
      console.log('Status:', response.status);
      console.log('Data:', response.data);
      console.groupEnd();
      return response;
    },
    (error) => {
      console.group(`❌ API Error: ${error.config?.url}`);
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
      console.log('Error:', error.message);
      console.groupEnd();
      return Promise.reject(error);
    }
  );
}

// 全局错误监听
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  
  // 上报错误到监控系统
  if (typeof reportError === 'function') {
    reportError({
      type: 'unhandled_promise_rejection',
      message: event.reason?.message || 'Unknown error',
      stack: event.reason?.stack
    });
  }
});
```

### API 测试工具
```javascript
// 开发环境下的 API 测试助手
if (process.env.NODE_ENV === 'development') {
  window.apiHelper = {
    // 快速登录管理员
    async loginAdmin() {
      return await loginUser('admin', 'admin123456', true);
    },
    
    // 快速创建测试贷款
    async createTestLoan() {
      return await createLoanApplication({
        loan_name: '测试贷款',
        amount: 100000,
        interest_rate: 4.5,
        bank: '测试银行',
        term: 12,
        repayment_method: 'equal_payment',
        purpose: '测试用途',
        collateral: '测试抵押物'
      });
    },
    
    // 快速获取数据
    async getTestData() {
      const loans = await getLoanList({ page: 1, per_page: 5 });
      const dashboard = await getAdminDashboard();
      
      console.log('Loans:', loans);
      console.log('Dashboard:', dashboard);
      
      return { loans, dashboard };
    },
    
    // 清除所有缓存
    clearCache() {
      apiCache.clear();
      localStorage.clear();
      sessionStorage.clear();
      console.log('All cache cleared');
    }
  };
  
  console.log('🔧 API Helper 已加载，使用 window.apiHelper 进行测试');
}
```

## 📚 完整示例

### Vue.js 组件示例
```vue
<template>
  <div class="loan-list">
    <!-- 搜索和筛选 -->
    <div class="search-filters">
      <el-input
        v-model="searchTerm"
        placeholder="搜索贷款名称、申请人..."
        @input="handleSearch"
        clearable
      />
      
      <el-select v-model="statusFilter" placeholder="状态筛选">
        <el-option label="全部" value="" />
        <el-option label="待审批" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已拒绝" value="rejected" />
      </el-select>
    </div>
    
    <!-- 贷款列表 -->
    <el-table
      :data="loans"
      :loading="loading"
      stripe
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      
      <el-table-column prop="loan_name" label="贷款名称" />
      
      <el-table-column label="申请人">
        <template #default="{ row }">
          {{ row.applicant_name }}
        </template>
      </el-table-column>
      
      <el-table-column label="金额">
        <template #default="{ row }">
          ¥{{ formatCurrency(row.amount) }}
        </template>
      </el-table-column>
      
      <el-table-column label="状态">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="viewLoan(row)">
            查看
          </el-button>
          
          <el-button
            v-if="isAdmin && row.status === 'pending'"
            size="small"
            type="primary"
            @click="approveLoan(row)"
          >
            审批
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <!-- 分页 -->
    <el-pagination
      v-if="pagination"
      :current-page="pagination.current_page"
      :page-size="pagination.per_page"
      :total="pagination.total"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
    
    <!-- 审批对话框 -->
    <approval-dialog
      v-model="approvalVisible"
      :loan="currentLoan"
      @success="handleApprovalSuccess"
    />
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import ApprovalDialog from './ApprovalDialog.vue';

export default {
  name: 'LoanList',
  
  components: {
    ApprovalDialog
  },
  
  data() {
    return {
      searchTerm: '',
      statusFilter: '',
      selectedLoans: [],
      approvalVisible: false,
      currentLoan: null,
      
      // 防抖搜索
      searchDebounce: null
    };
  },
  
  computed: {
    ...mapState('loans', ['list', 'pagination', 'loading']),
    ...mapState('auth', ['user']),
    ...mapGetters('auth', ['isAdmin']),
    
    loans() {
      return this.list || [];
    },
    
    queryParams() {
      return {
        page: this.pagination?.current_page || 1,
        per_page: this.pagination?.per_page || 20,
        search: this.searchTerm,
        status: this.statusFilter
      };
    }
  },
  
  watch: {
    statusFilter() {
      this.loadLoans();
    }
  },
  
  async created() {
    await this.loadLoans();
  },
  
  methods: {
    ...mapActions('loans', ['fetchLoans', 'approveLoanAction']),
    
    async loadLoans() {
      const result = await this.fetchLoans(this.queryParams);
      
      if (!result.success) {
        this.$message.error(result.message);
      }
    },
    
    handleSearch() {
      // 防抖搜索
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.loadLoans();
      }, 500);
    },
    
    handleSelectionChange(selection) {
      this.selectedLoans = selection;
    },
    
    handleSizeChange(newSize) {
      this.loadLoans();
    },
    
    handleCurrentChange(newPage) {
      this.loadLoans();
    },
    
    viewLoan(loan) {
      this.$router.push(`/loans/${loan.id}`);
    },
    
    approveLoan(loan) {
      this.currentLoan = loan;
      this.approvalVisible = true;
    },
    
    async handleApprovalSuccess() {
      this.approvalVisible = false;
      this.currentLoan = null;
      await this.loadLoans();
      this.$message.success('审批操作完成');
    },
    
    getStatusType(status) {
      const types = {
        pending: 'warning',
        approved: 'success',
        rejected: 'danger',
        completed: 'info'
      };
      return types[status] || 'info';
    },
    
    getStatusText(status) {
      const texts = {
        pending: '待审批',
        approved: '已通过',
        rejected: '已拒绝',
        completed: '已完成'
      };
      return texts[status] || status;
    },
    
    formatCurrency(amount) {
      return new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    }
  }
};
</script>
```

### React Hook 示例
```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Table, Button, Select, Input, Tag, message } from 'antd';
import { fetchLoansAsync, approveLoanAsync } from '../store/slices/loansSlice';

const LoanList = () => {
  const dispatch = useDispatch();
  const { loans, pagination, loading } = useSelector(state => state.loans);
  const { user, isAdmin } = useSelector(state => state.auth);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLoans, setSelectedLoans] = useState([]);
  
  // 防抖搜索
  const [searchDebounce, setSearchDebounce] = useState(null);
  
  const queryParams = {
    page: pagination?.current_page || 1,
    per_page: pagination?.per_page || 20,
    search: searchTerm,
    status: statusFilter
  };
  
  const loadLoans = useCallback(() => {
    dispatch(fetchLoansAsync(queryParams));
  }, [dispatch, JSON.stringify(queryParams)]);
  
  useEffect(() => {
    loadLoans();
  }, [loadLoans]);
  
  const handleSearch = (value) => {
    setSearchTerm(value);
    
    // 防抖搜索
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    const timeoutId = setTimeout(() => {
      loadLoans();
    }, 500);
    
    setSearchDebounce(timeoutId);
  };
  
  const handleStatusChange = (value) => {
    setStatusFilter(value);
  };
  
  const handleApprove = async (loan, approvalData) => {
    try {
      const result = await dispatch(approveLoanAsync({
        loanId: loan.id,
        approvalData
      }));
      
      if (result.type.endsWith('/fulfilled')) {
        message.success('审批操作完成');
        loadLoans();
      } else {
        message.error(result.error?.message || '审批失败');
      }
    } catch (error) {
      message.error('审批失败');
    }
  };
  
  const columns = [
    {
      title: '贷款名称',
      dataIndex: 'loan_name',
      key: 'loan_name'
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name'
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${new Intl.NumberFormat('zh-CN').format(amount)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          pending: 'orange',
          approved: 'green',
          rejected: 'red',
          completed: 'blue'
        };
        
        const texts = {
          pending: '待审批',
          approved: '已通过',
          rejected: '已拒绝',
          completed: '已完成'
        };
        
        return <Tag color={colors[status]}>{texts[status]}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, loan) => (
        <div>
          <Button 
            size="small" 
            onClick={() => window.open(`/loans/${loan.id}`, '_blank')}
          >
            查看
          </Button>
          
          {isAdmin && loan.status === 'pending' && (
            <Button
              size="small"
              type="primary"
              style={{ marginLeft: 8 }}
              onClick={() => handleApprove(loan, {
                status: 'approved',
                approved_amount: loan.amount,
                approved_rate: loan.interest_rate,
                remark: '审批通过'
              })}
            >
              审批
            </Button>
          )}
        </div>
      )
    }
  ];
  
  return (
    <div className="loan-list">
      <div className="search-filters" style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索贷款名称、申请人..."
          style={{ width: 300, marginRight: 16 }}
          onSearch={handleSearch}
          onChange={(e) => handleSearch(e.target.value)}
        />
        
        <Select
          placeholder="状态筛选"
          style={{ width: 150 }}
          value={statusFilter}
          onChange={handleStatusChange}
        >
          <Select.Option value="">全部</Select.Option>
          <Select.Option value="pending">待审批</Select.Option>
          <Select.Option value="approved">已通过</Select.Option>
          <Select.Option value="rejected">已拒绝</Select.Option>
        </Select>
      </div>
      
      <Table
        columns={columns}
        dataSource={loans}
        loading={loading}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedLoans.map(loan => loan.id),
          onChange: (selectedRowKeys, selectedRows) => {
            setSelectedLoans(selectedRows);
          }
        }}
        pagination={{
          current: pagination?.current_page,
          pageSize: pagination?.per_page,
          total: pagination?.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, pageSize) => {
            // 处理分页变化
            loadLoans();
          }
        }}
      />
    </div>
  );
};

export default LoanList;
```

## 🔚 总结

这份前端对接指南涵盖了与贷款管理系统后端 API 集成的所有重要细节：

### ✅ 核心要点

1. **认证流程**: JWT Token 认证，自动刷新机制
2. **API 调用**: 统一的请求/响应处理，错误处理
3. **状态管理**: Vuex/Redux 集成示例
4. **文件上传**: 单/多文件上传，进度显示
5. **安全防护**: XSS/CSRF 防护，敏感数据脱敏
6. **性能优化**: 请求缓存，防抖搜索
7. **错误处理**: 统一错误处理，重试机制
8. **调试支持**: 开发环境调试工具

### 🚀 快速开始

1. 配置 API 客户端
2. 实现认证流程
3. 集成业务 API
4. 添加错误处理
5. 优化用户体验

按照这份指南，前端开发者可以快速、安全地集成贷款管理系统的所有功能。 