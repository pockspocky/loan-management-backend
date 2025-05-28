# 贷款管理系统后端

[![Node.js CI](https://github.com/pockspocky/loan-management-backend/workflows/Node.js%20CI/badge.svg)](https://github.com/pockspocky/loan-management-backend/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%3E%3D4.0-green)](https://www.mongodb.com/)

一个基于 Node.js + Express + MongoDB 的贷款管理系统后端服务。

## 功能特性

- 🔐 用户认证与授权（JWT）
- 👥 用户管理（注册、登录、资料管理）
- 💰 贷款申请与管理
- ✅ 贷款审批流程
- 📊 数据统计与仪表盘
- 📁 文件上传管理
- 📝 系统日志记录
- 🔍 数据查询与分页

## 在线演示

- **API 文档**: [查看API文档](API%20Loan%20Management%20System.md)
- **项目总结**: [查看项目总结](PROJECT_SUMMARY.md)

## 技术栈

- **后端框架**: Express.js
- **数据库**: MongoDB + Mongoose
- **认证**: JWT (JSON Web Tokens)
- **文件上传**: Multer
- **数据验证**: Joi + 自定义验证
- **日志记录**: 自定义日志系统
- **开发工具**: Nodemon

## 快速开始

### 克隆项目

```bash
git clone https://github.com/pockspocky/loan-management-backend.git
cd loan-management-backend
```

### 环境要求

- Node.js >= 14.0.0
- MongoDB >= 4.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 到 `.env` 并配置相关参数：

```bash
cp .env.example .env
```

配置数据库连接和其他环境变量：

```env
# 服务器配置
PORT=8080
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/loan_management

# JWT配置
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

### 初始化数据库

```bash
npm run seed
```

这将创建一个默认的管理员账户：
- 用户名: `admin`
- 密码: `admin123456`
- 邮箱: `admin@example.com`

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:8080` 启动。

## API 文档

### 认证相关

#### 用户注册
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456",
  "real_name": "测试用户",
  "phone": "13900139000",
  "id_card": "110101199001011234"
}
```

#### 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123456"
}
```

#### 获取用户信息
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

### 贷款管理

#### 创建贷款申请
```http
POST /api/v1/loans
Authorization: Bearer <token>
Content-Type: application/json

{
  "loan_name": "房屋贷款",
  "amount": 500000,
  "interest_rate": 4.5,
  "bank": "中国银行",
  "term": 240,
  "repayment_method": "equal_payment",
  "purpose": "购买住房",
  "collateral": "房产抵押"
}
```

#### 获取贷款列表
```http
GET /api/v1/loans?page=1&per_page=20&status=pending
Authorization: Bearer <token>
```

#### 审批贷款（管理员）
```http
PATCH /api/v1/loans/:loan_id/approve
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "approved",
  "approved_amount": 500000,
  "approved_rate": 4.5,
  "remark": "审批通过"
}
```

### 仪表盘

#### 管理员仪表盘
```http
GET /api/v1/dashboard/admin
Authorization: Bearer <admin_token>
```

#### 用户仪表盘
```http
GET /api/v1/dashboard/user
Authorization: Bearer <token>
```

### 文件上传

#### 上传单个文件
```http
POST /api/v1/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
```

### 系统日志（管理员）

#### 获取系统日志
```http
GET /api/v1/logs?page=1&per_page=20&level=error
Authorization: Bearer <admin_token>
```

## 数据模型

### 用户模型 (User)
- username: 用户名
- email: 邮箱
- password: 密码（加密）
- real_name: 真实姓名
- phone: 手机号
- id_card: 身份证号
- role: 角色（admin/user）
- status: 状态（active/inactive/suspended）

### 贷款模型 (Loan)
- loan_name: 贷款名称
- applicant_id: 申请人ID
- amount: 申请金额
- interest_rate: 利率
- bank: 银行
- term: 期限（月）
- repayment_method: 还款方式
- status: 状态（pending/approved/rejected/completed）
- purpose: 贷款用途
- collateral: 抵押物

### 系统日志模型 (SystemLog)
- level: 日志级别（debug/info/warning/error）
- module: 模块名称
- action: 操作类型
- message: 日志消息
- user_id: 用户ID
- ip_address: IP地址
- user_agent: 用户代理

## 项目结构

```
src/
├── config/          # 配置文件
├── middleware/      # 中间件
├── models/          # 数据模型
├── routes/          # 路由定义
├── utils/           # 工具函数
├── app.js           # 应用入口
└── server.js        # 服务器启动
```

## 开发指南

### 添加新的API路由

1. 在 `src/routes/` 目录下创建新的路由文件
2. 在 `src/app.js` 中注册路由
3. 添加相应的中间件和验证

### 数据验证

系统支持两种验证方式：
- Joi 验证（用于复杂验证）
- 自定义 validateInput 函数（用于简单验证）

### 错误处理

所有错误都通过统一的错误处理中间件处理，支持：
- 操作错误和程序错误分类
- 详细的错误信息和堆栈跟踪
- 自动日志记录

## 部署

### 使用 PM2 部署

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

### 使用 Docker 部署

```bash
docker build -t loan-management-backend .
docker run -p 8080:8080 loan-management-backend
```

## 安全考虑

- 密码使用 bcrypt 加密
- JWT token 有效期限制
- 输入数据验证和清理
- 文件上传类型限制
- 详细的操作日志记录

## 贡献

我们欢迎任何形式的贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解更多信息。

### 如何贡献

1. Fork 这个项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'feat: 添加一些了不起的功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 版本历史

查看 [Releases](https://github.com/pockspocky/loan-management-backend/releases) 了解版本更新历史。

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 作者

- **pockspocky** - *初始开发* - [GitHub](https://github.com/pockspocky)

## 联系方式

- 邮箱: feiyuanzhong@outlook.com
- GitHub: [@pockspocky](https://github.com/pockspocky)

## 致谢

- 感谢所有贡献者的支持
- 基于现代化的 Node.js 技术栈构建
- 使用了优秀的开源项目和库

---

⭐ 如果这个项目对你有帮助，请给它一个 Star！ 