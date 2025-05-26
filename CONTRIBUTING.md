# 贡献指南

感谢您对贷款管理系统项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果您发现了bug或有功能请求，请：

1. 在 [Issues](../../issues) 页面搜索是否已有相似问题
2. 如果没有，请创建新的 issue
3. 使用清晰的标题和详细的描述
4. 如果是bug，请提供复现步骤

### 提交代码

1. **Fork 项目**
   ```bash
   git clone https://github.com/pockspocky/loan-management-backend.git
   cd loan-management-backend
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **配置开发环境**
   ```bash
   npm install
   cp .env.example .env
   # 配置你的环境变量
   ```

4. **进行更改**
   - 遵循项目的代码风格
   - 添加必要的测试
   - 更新相关文档

5. **测试更改**
   ```bash
   npm test
   npm run lint
   ```

6. **提交更改**
   ```bash
   git add .
   git commit -m "type: 简短描述你的更改"
   ```

7. **推送到你的分支**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **创建 Pull Request**
   - 提供清晰的PR标题和描述
   - 关联相关的issue（如果有）
   - 等待代码审查

## 代码风格

- 使用2个空格缩进
- 使用驼峰命名法
- 函数和变量名要有描述性
- 添加必要的注释
- 遵循ESLint规则

## 提交消息规范

使用以下格式：

```
type: 简短描述

详细描述（可选）

Closes #issue-number
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `test`: 添加测试
- `chore`: 维护工作

## 开发环境设置

1. **系统要求**
   - Node.js >= 14.0.0
   - MongoDB >= 4.0
   - npm 或 yarn

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **运行测试**
   ```bash
   npm test
   ```

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

## 问题和建议

如果你有任何问题或建议，可以通过以下方式联系：

- 创建 GitHub Issue
- 发邮件到 feiyuanzhong@outlook.com

## 行为准则

请遵守我们的行为准则：

- 友善对待所有贡献者
- 尊重不同观点
- 接受建设性批评
- 专注于对社区最有益的事情

感谢你的贡献！ 