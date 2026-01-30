# LSC-AI Platform

企业级 AI 协作平台，基于 LSC-AI Core 构建。

## 技术栈

- **后端**: NestJS, Prisma, PostgreSQL, Redis, Socket.io
- **前端**: React 18, Vite, Ant Design 5, TailwindCSS, Framer Motion
- **基础设施**: Docker, pnpm workspace, Turborepo

## 系统要求

- Node.js 18+
- pnpm 9+
- Docker Desktop (用于开发环境数据库)
- Git

## 快速开始

### 1. 克隆项目

```bash
# 确保同时拥有 lsc-ai-platform 和 localAI 项目
# 目录结构应为:
# lscmade7/
#   ├── lsc-ai-platform/
#   └── localAI/
```

### 2. 安装依赖

```bash
cd lsc-ai-platform
pnpm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
copy .env.example .env

# 编辑 .env 文件，填入必要的配置
# 主要需要配置:
# - DATABASE_URL: PostgreSQL 连接字符串
# - JWT_SECRET: JWT 密钥（生产环境请使用强密码）
# - LLM 相关配置（如有）
```

### 4. 启动开发环境

```bash
# 启动 Docker 容器（PostgreSQL, Redis, MinIO）
pnpm docker:dev

# 等待数据库启动后，运行数据库迁移
pnpm db:migrate

# 填充初始数据（创建管理员账号）
pnpm db:seed

# 启动开发服务器
pnpm dev
```

### 5. 访问应用

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3000
- **API 文档**: http://localhost:3000/api
- **Redis Commander**: http://localhost:8081

### 默认账号

- 用户名: `admin`
- 密码: `Admin@123`

## 项目结构

```
lsc-ai-platform/
├── packages/
│   ├── server/          # NestJS 后端
│   │   ├── src/
│   │   │   ├── modules/  # 业务模块
│   │   │   ├── gateway/  # WebSocket 网关
│   │   │   ├── prisma/   # 数据库服务
│   │   │   └── common/   # 公共模块
│   │   └── prisma/       # Prisma Schema
│   └── web/             # React 前端
│       ├── src/
│       │   ├── components/ # UI 组件
│       │   ├── pages/      # 页面
│       │   ├── stores/     # 状态管理
│       │   ├── services/   # API 服务
│       │   └── styles/     # 设计系统
│       └── public/
├── docker/              # Docker 配置
├── scripts/             # 部署脚本
└── docs/                # 文档
```

## 常用命令

```bash
# 开发
pnpm dev                 # 启动前后端开发服务器
pnpm dev:server          # 仅启动后端
pnpm dev:web             # 仅启动前端

# Docker
pnpm docker:dev          # 启动开发环境容器
pnpm docker:down         # 停止容器

# 数据库
pnpm db:migrate          # 运行迁移
pnpm db:seed             # 填充数据
pnpm db:studio           # 打开 Prisma Studio

# 构建
pnpm build               # 构建所有包
pnpm build:server        # 构建后端
pnpm build:web           # 构建前端

# 代码质量
pnpm lint                # 代码检查
pnpm format              # 代码格式化
```

## 部署到其他机器

### Windows 环境部署

1. 确保目标机器安装了必要软件:
   - Node.js 18+
   - pnpm (`npm install -g pnpm`)
   - Docker Desktop
   - Git

2. 运行部署脚本:
   ```powershell
   # 以管理员身份运行 PowerShell
   .\scripts\setup-windows.ps1
   ```

3. 或手动执行:
   ```bash
   # 安装依赖
   pnpm install

   # 复制并编辑环境变量
   copy .env.example .env

   # 启动 Docker 容器
   pnpm docker:dev

   # 等待 30 秒让数据库完全启动
   timeout /t 30

   # 运行数据库迁移
   pnpm db:migrate

   # 填充初始数据
   pnpm db:seed

   # 启动应用
   pnpm dev
   ```

### 生产环境部署

参见 `docs/deployment.md` 获取详细的生产环境部署指南。

## 开发指南

### 添加新模块

1. 在 `packages/server/src/modules/` 创建新目录
2. 创建 controller, service, module 文件
3. 在 `app.module.ts` 中导入新模块

### 添加新页面

1. 在 `packages/web/src/pages/` 创建新组件
2. 在 `App.tsx` 中添加路由
3. 在 `Sidebar.tsx` 中添加导航项（如需要）

### 设计系统

项目使用自定义设计系统，主要文件:

- `src/styles/design-tokens.ts` - 设计令牌（颜色、间距等）
- `src/styles/theme.ts` - Ant Design 主题配置
- `src/styles/global.css` - 全局样式

颜色主题基于米白色（Cream），主品牌色为温暖的棕色。

## 故障排除

### 数据库连接失败

1. 确保 Docker Desktop 正在运行
2. 检查 `.env` 中的 `DATABASE_URL` 配置
3. 运行 `pnpm docker:dev` 启动数据库容器

### 依赖安装失败

1. 删除 `node_modules` 和 `pnpm-lock.yaml`
2. 确保 localAI 项目存在于 `../localAI`
3. 重新运行 `pnpm install`

### 端口被占用

修改 `.env` 中的端口配置，或停止占用端口的程序。

## 许可证

私有项目，保留所有权利。
