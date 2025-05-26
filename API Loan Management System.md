# 🌐 贷款管理系统 API 文档

## 📋 目录
- [API 概述](#api-概述)
- [认证授权](#认证授权)
- [通用规范](#通用规范)
- [用户认证 API](#用户认证-api)
- [用户管理 API](#用户管理-api)
- [贷款管理 API](#贷款管理-api)
- [系统日志 API](#系统日志-api)
- [文件上传 API](#文件上传-api)
- [数据统计 API](#数据统计-api)
- [错误处理](#错误处理)
- [数据模型](#数据模型)
- [安全注意事项](#安全注意事项)

## 🔍 API 概述

### 基础信息
- **Base URL**: `https://api.yourdomain.com/v1`
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Token

### 版本控制
- 当前版本: `v1`
- 版本在URL中指定: `/v1/endpoint`

## 🔐 认证授权

### JWT Token 认证
所有需要认证的API请求都必须在Header中包含JWT Token：

```http
Authorization: Bearer <jwt_token>
```

### 用户角色
- `admin`: 管理员，拥有所有权限
- `user`: 普通用户，仅能操作自己的数据

## 📏 通用规范

### HTTP 方法
- `GET`: 获取资源
- `POST`: 创建资源
- `PUT`: 更新整个资源
- `PATCH`: 部分更新资源
- `DELETE`: 删除资源

### 状态码
- `200`: 请求成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未认证
- `403`: 权限不足
- `404`: 资源不存在
- `422`: 数据验证失败
- `500`: 服务器内部错误

### 通用响应格式
```json
{
  "success": true,
  "message": "操作成功",
  "data": {},
  "code": 200,
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 分页格式
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 100,
      "total_pages": 5,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

## 👤 用户认证 API

### 用户登录
```http
POST /auth/login
```

**请求参数：**
```json
{
  "username": "string",    // 用户名 (必填)
  "password": "string",    // 密码 (必填)
  "role": "admin|user"     // 用户角色 (可选，默认user)
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400,
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "avatar": "https://example.com/avatar.jpg",
      "last_login": "2024-01-20T10:30:00Z"
    }
  }
}
```

### 用户注册
```http
POST /auth/register
```

**请求参数：**
```json
{
  "username": "string",      // 用户名 (必填, 3-20字符)
  "email": "string",         // 邮箱 (必填)
  "password": "string",      // 密码 (必填, 最少6位)
  "confirm_password": "string", // 确认密码 (必填)
  "phone": "string",         // 手机号 (可选)
  "real_name": "string"      // 真实姓名 (可选)
}
```

### 刷新Token
```http
POST /auth/refresh
```

**请求Header：**
```http
Authorization: Bearer <refresh_token>
```

### 用户登出
```http
POST /auth/logout
```

**请求Header：**
```http
Authorization: Bearer <jwt_token>
```

### 获取当前用户信息
```http
GET /auth/me
```

**请求Header：**
```http
Authorization: Bearer <jwt_token>
```

## 👥 用户管理 API

### 获取用户列表 (仅管理员)
```http
GET /users?page=1&per_page=20&search=keyword&role=admin|user
```

**查询参数：**
- `page`: 页码 (默认: 1)
- `per_page`: 每页数量 (默认: 20, 最大: 100)
- `search`: 搜索关键词 (用户名、邮箱、真实姓名)
- `role`: 用户角色筛选
- `status`: 用户状态筛选 (active|inactive|suspended)

### 获取单个用户信息
```http
GET /users/{user_id}
```

**权限要求：**
- 管理员：可查看所有用户
- 普通用户：仅可查看自己

### 创建用户 (仅管理员)
```http
POST /users
```

**请求参数：**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "admin|user",
  "real_name": "string",
  "phone": "string",
  "status": "active"
}
```

### 更新用户信息
```http
PUT /users/{user_id}
```

**请求参数：**
```json
{
  "email": "string",
  "real_name": "string",
  "phone": "string",
  "avatar": "string"
}
```

### 删除用户 (仅管理员)
```http
DELETE /users/{user_id}
```

### 修改密码
```http
PATCH /users/{user_id}/password
```

**请求参数：**
```json
{
  "current_password": "string",  // 当前密码
  "new_password": "string",      // 新密码
  "confirm_password": "string"   // 确认新密码
}
```

## 💰 贷款管理 API

### 获取贷款列表
```http
GET /loans?page=1&per_page=20&status=pending&applicant_id=1
```

**查询参数：**
- `page`: 页码
- `per_page`: 每页数量
- `status`: 状态筛选 (pending|approved|rejected|completed)
- `applicant_id`: 申请人ID (管理员可查看所有，用户只能查看自己的)
- `bank`: 银行筛选
- `amount_min`: 最小金额
- `amount_max`: 最大金额
- `date_from`: 开始日期 (YYYY-MM-DD)
- `date_to`: 结束日期 (YYYY-MM-DD)

### 获取单个贷款详情
```http
GET /loans/{loan_id}
```

### 创建贷款申请
```http
POST /loans
```

**请求参数：**
```json
{
  "loan_name": "string",           // 贷款名称 (必填)
  "amount": 100000,                // 贷款金额 (必填, 正数)
  "interest_rate": 4.5,            // 利率 (必填, 0-100)
  "bank": "string",                // 银行名称 (必填)
  "term": 12,                      // 贷款期限(月) (必填, 1-360)
  "repayment_method": "equal_payment", // 还款方式 (必填)
  "purpose": "string",             // 贷款用途 (可选)
  "collateral": "string",          // 抵押物 (可选)
  "attachments": ["file_id_1", "file_id_2"] // 附件文件ID数组 (可选)
}
```

**还款方式枚举：**
- `equal_payment`: 等额本息
- `equal_principal`: 等额本金

### 更新贷款信息
```http
PUT /loans/{loan_id}
```

**权限要求：**
- 管理员：可更新所有贷款
- 用户：仅可更新自己的待审批贷款

### 审批贷款 (仅管理员)
```http
PATCH /loans/{loan_id}/approve
```

**请求参数：**
```json
{
  "status": "approved|rejected",   // 审批状态 (必填)
  "remark": "string",              // 审批备注 (可选)
  "approved_amount": 80000,        // 批准金额 (可选，审批通过时)
  "approved_rate": 4.2             // 批准利率 (可选，审批通过时)
}
```

### 删除贷款
```http
DELETE /loans/{loan_id}
```

**权限要求：**
- 管理员：可删除所有贷款
- 用户：仅可删除自己的待审批贷款

### 获取贷款统计信息 (仅管理员)
```http
GET /loans/statistics
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total_loans": 1250,
    "pending_loans": 45,
    "approved_loans": 980,
    "rejected_loans": 225,
    "total_amount": 125000000,
    "approved_amount": 98000000,
    "average_amount": 100000,
    "monthly_stats": [
      {
        "month": "2024-01",
        "count": 120,
        "amount": 12000000
      }
    ]
  }
}
```

## 📋 系统日志 API

### 获取系统日志 (仅管理员)
```http
GET /logs?page=1&per_page=50&level=info&date_from=2024-01-01
```

**查询参数：**
- `page`: 页码
- `per_page`: 每页数量
- `level`: 日志级别 (debug|info|warning|error)
- `module`: 模块筛选 (auth|loan|user|system)
- `user_id`: 用户ID筛选
- `date_from`: 开始日期
- `date_to`: 结束日期

**响应示例：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "level": "info",
        "module": "loan",
        "action": "create",
        "message": "用户创建贷款申请",
        "user_id": 123,
        "username": "张三",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "metadata": {
          "loan_id": 456,
          "amount": 100000
        },
        "created_at": "2024-01-20T10:30:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

## 📁 文件上传 API

### 上传文件
```http
POST /upload
```

**请求格式：** `multipart/form-data`

**请求参数：**
- `file`: 文件 (必填)
- `type`: 文件类型 (可选: document|image|other)

**响应示例：**
```json
{
  "success": true,
  "data": {
    "file_id": "uuid-string",
    "filename": "document.pdf",
    "original_name": "贷款申请书.pdf",
    "size": 1024000,
    "type": "application/pdf",
    "url": "https://cdn.example.com/files/uuid-string.pdf"
  }
}
```

### 删除文件
```http
DELETE /upload/{file_id}
```

## 📊 数据统计 API

### 仪表盘统计 (管理员)
```http
GET /dashboard/admin
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_users": 1250,
      "total_loans": 890,
      "pending_approvals": 45,
      "total_amount": 125000000
    },
    "recent_activities": [
      {
        "type": "loan_created",
        "message": "张三提交了贷款申请",
        "time": "2024-01-20T10:30:00Z"
      }
    ],
    "charts": {
      "loan_trends": [...],
      "amount_distribution": [...]
    }
  }
}
```

### 用户仪表盘统计
```http
GET /dashboard/user
```

## ❌ 错误处理

### 错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "code": 400,
  "errors": {
    "field_name": ["具体错误信息"]
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 常见错误码
| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 1001 | 用户名或密码错误 | 检查登录凭据 |
| 1002 | Token已过期 | 刷新Token或重新登录 |
| 1003 | 权限不足 | 检查用户角色权限 |
| 2001 | 贷款金额超出限制 | 调整贷款金额 |
| 2002 | 贷款申请已存在 | 检查是否重复提交 |
| 3001 | 文件大小超出限制 | 压缩文件或选择更小的文件 |
| 3002 | 文件格式不支持 | 使用支持的文件格式 |

## 📋 数据模型

### User (用户)
```json
{
  "id": 1,
  "username": "string",
  "email": "string",
  "real_name": "string",
  "phone": "string",
  "role": "admin|user",
  "status": "active|inactive|suspended",
  "avatar": "string",
  "last_login": "datetime",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Loan (贷款)
```json
{
  "id": 1,
  "loan_name": "string",
  "applicant_id": 1,
  "applicant_name": "string",
  "amount": 100000,
  "interest_rate": 4.5,
  "bank": "string",
  "term": 12,
  "repayment_method": "equal_payment|equal_principal",
  "status": "pending|approved|rejected|completed",
  "purpose": "string",
  "collateral": "string",
  "approved_amount": 80000,
  "approved_rate": 4.2,
  "remark": "string",
  "attachments": [
    {
      "file_id": "uuid",
      "filename": "document.pdf",
      "url": "https://..."
    }
  ],
  "application_date": "datetime",
  "approval_date": "datetime",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## 🔒 安全注意事项

### 认证安全
1. **Token安全**
   - JWT Token包含有效期，建议设置为24小时
   - 使用HTTPS传输，防止Token被截取
   - 客户端应安全存储Token，避免XSS攻击

2. **密码安全**
   - 密码必须经过加密存储（bcrypt推荐）
   - 实施密码复杂度要求
   - 提供密码重置功能

### API安全
1. **请求验证**
   - 所有输入数据必须验证和清理
   - 使用白名单验证而非黑名单
   - 实施SQL注入防护

2. **访问控制**
   - 基于角色的访问控制(RBAC)
   - 资源级别的权限检查
   - 审计日志记录

3. **速率限制**
   - 实施API调用频率限制
   - 防止暴力破解攻击
   - 监控异常请求模式

### 数据安全
1. **敏感数据保护**
   - 敏感字段加密存储
   - 日志中避免记录敏感信息
   - 数据传输使用HTTPS

2. **文件上传安全**
   - 验证文件类型和大小
   - 扫描恶意文件
   - 隔离存储用户上传文件

## 📝 开发注意事项

### 请求规范
1. **Content-Type**: 所有POST/PUT请求使用`application/json`
2. **字符编码**: 统一使用UTF-8
3. **时间格式**: ISO 8601格式 (YYYY-MM-DDTHH:mm:ssZ)
4. **数字格式**: 金额使用分为单位存储，显示时转换

### 响应规范
1. **状态码**: 正确使用HTTP状态码
2. **错误信息**: 提供用户友好的错误信息
3. **数据一致性**: 保持响应格式的一致性
4. **性能优化**: 大数据量使用分页

### 测试建议
1. **单元测试**: 覆盖所有业务逻辑
2. **集成测试**: 测试API端点
3. **压力测试**: 验证系统性能
4. **安全测试**: 检查安全漏洞

---

## 📞 技术支持

如有API相关问题，请：
1. 查阅本文档常见问题部分
2. 在GitHub Issues中提交问题
3. 联系技术支持：api@yourdomain.com

**文档版本**: v1.0.0  
**最后更新**: 2024-01-20  
**维护团队**: 贷款管理系统开发团队 