# 部署指南

本文档说明如何在不同环境中部署 LSC-AI Platform。

## 开发环境部署

### 方式一：自动化脚本

#### PowerShell（推荐）

```powershell
# 以管理员身份运行 PowerShell
cd D:\u3d-projects\lscmade7\lsc-ai-platform
.\scripts\setup-windows.ps1
```

#### CMD

```cmd
cd D:\u3d-projects\lscmade7\lsc-ai-platform
scripts\setup.bat
```

### 方式二：手动部署

#### 步骤 1：安装必要软件

1. **Node.js 18+**
   - 下载: https://nodejs.org/
   - 验证: `node --version`

2. **pnpm**
   ```bash
   npm install -g pnpm
   ```

3. **Docker Desktop**
   - 下载: https://www.docker.com/products/docker-desktop/
   - 安装后启动 Docker Desktop

4. **Git**
   - 下载: https://git-scm.com/

#### 步骤 2：获取项目代码

确保项目目录结构正确：

```
lscmade7/
├── lsc-ai-platform/    # 主平台
└── localAI/            # LSC-AI Core
    └── packages/
        └── core/
```

#### 步骤 3：安装依赖

```bash
cd lsc-ai-platform
pnpm install
```

#### 步骤 4：配置环境变量

```bash
# 复制环境变量模板
copy .env.example .env

# 编辑 .env 文件
notepad .env
```

主要配置项：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | postgresql://lscai:lscai123@localhost:5432/lscai |
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| JWT_SECRET | JWT 密钥 | 开发环境可用默认值，生产必须更改 |
| JWT_EXPIRES_IN | Token 有效期 | 1d |

#### 步骤 5：启动数据库

```bash
# 启动 Docker 容器
pnpm docker:dev

# 查看容器状态
docker ps

# 查看日志（如有问题）
pnpm docker:logs
```

容器说明：

| 容器 | 端口 | 用途 |
|------|------|------|
| lscai-postgres | 5432 | PostgreSQL 数据库 |
| lscai-redis | 6379 | Redis 缓存 |
| lscai-minio | 9000/9001 | MinIO 对象存储 |
| lscai-redis-commander | 8081 | Redis 管理界面 |

#### 步骤 6：初始化数据库

```bash
# 运行数据库迁移
pnpm db:migrate

# 填充初始数据
pnpm db:seed
```

#### 步骤 7：启动应用

```bash
# 启动前后端开发服务器
pnpm dev
```

访问地址：
- 前端: http://localhost:5173
- 后端: http://localhost:3000
- API 文档: http://localhost:3000/api

## 公司电脑部署

### 准备工作

1. 将以下文件夹复制到目标电脑：
   - `lsc-ai-platform/`
   - `localAI/`

2. 保持目录结构：
   ```
   某个目录/
   ├── lsc-ai-platform/
   └── localAI/
   ```

### 网络注意事项

如果公司网络有限制：

1. **npm 镜像**：设置淘宝镜像
   ```bash
   pnpm config set registry https://registry.npmmirror.com
   ```

2. **Docker 镜像**：配置 Docker 镜像加速器
   - 在 Docker Desktop 设置中添加镜像源

### 离线部署

如果目标机器无法联网：

1. 在有网络的机器上：
   ```bash
   # 导出 Docker 镜像
   docker save postgres:15 redis:7 minio/minio -o docker-images.tar

   # 打包 node_modules
   # 先运行 pnpm install，然后打包整个项目
   ```

2. 复制到目标机器后：
   ```bash
   # 导入 Docker 镜像
   docker load -i docker-images.tar
   ```

## 常见问题

### 端口被占用

修改 `.env` 和 `docker/docker-compose.dev.yml` 中的端口配置。

### 数据库连接失败

1. 确认 Docker 容器正在运行
   ```bash
   docker ps
   ```

2. 检查数据库日志
   ```bash
   docker logs lscai-postgres
   ```

3. 验证连接字符串格式

### 依赖安装失败

1. 清理缓存
   ```bash
   pnpm store prune
   ```

2. 删除 node_modules 重新安装
   ```bash
   pnpm clean
   pnpm install
   ```

### Docker Desktop 启动失败

1. 确认 Windows 功能已启用：
   - Hyper-V
   - Windows Subsystem for Linux

2. 以管理员身份重启 Docker Desktop

## 生产环境部署

生产环境建议使用 Docker Compose 或 Kubernetes。详细配置将在后续版本提供。

### 安全注意事项

- 必须更改 JWT_SECRET
- 使用强密码配置数据库
- 配置 HTTPS
- 限制 API 访问来源
