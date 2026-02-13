# 配置说明

## 环境变量配置

### 1. 创建 .env 文件

```bash
cp .env.example .env
vi .env
```

### 2. 必须修改的配置项（⚠️ 重要）

以下配置项使用默认值会有安全风险，**生产环境必须修改**：

#### 数据库密码
```bash
DB_PASSWORD=lscai123    # 修改为强密码
```

#### Redis 密码
```bash
REDIS_PASSWORD=redis123    # 修改为强密码
```

#### MinIO 密码
```bash
MINIO_PASSWORD=minioadmin123    # 修改为强密码
```

#### JWT 密钥
```bash
# 生成强随机密钥
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
```

#### 凭据加密密钥
```bash
# 用于加密存储用户凭据（如 API 密钥、密码等）
CREDENTIAL_SALT=$(openssl rand -base64 24)      # 必须是 32 字符
CREDENTIAL_KEY=$(openssl rand -base64 32)
```

#### DeepSeek API 密钥
```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx    # 从 DeepSeek 官网获取
```

### 3. 可选配置项

```bash
# 日志级别
LOG_LEVEL=info    # debug | info | warn | error

# Web 端口
WEB_PORT=80       # 默认 80 端口
```

## Client Agent 下载配置

### 当前状态

前端界面会引导用户下载 Client Agent，下载链接为：

- Windows: `/downloads/lsc-ai-client-win.exe`
- macOS: `/downloads/lsc-ai-client-mac.dmg`
- Linux: `/downloads/lsc-ai-client-linux.deb`

### 配置步骤

#### 方法一：使用预构建的安装包（推荐）

1. 确保 `downloads/client-agent/windows/LSC-AI-Client-Agent-Setup.exe` 存在
2. Web 容器会自动映射此目录到 `/downloads`

#### 方法二：从项目构建

如果需要最新版本的 Client Agent：

```bash
# 在有网络的开发机器上
cd lsc-ai-platform/packages/client-agent
pnpm build:win    # 构建 Windows 版本

# 将生成的安装包复制到部署目录
cp dist/LSC-AI-Client-Agent-Setup.exe \
   offline-deploy-openEuler/downloads/client-agent/windows/
```

### 版本检查机制

#### 当前实现状态

**⚠️ 注意：版本检查功能尚未完整实现**

前端界面（`packages/web/src/components/agent/AgentInstallGuide.tsx`）目前使用硬编码的下载链接：
- Windows: 版本号写死为 1.0.0
- 下载路径: `/downloads/lsc-ai-client-win.exe`

#### 待实现功能

需要添加以下功能以支持自动版本检查：

1. **后端 API**：
   - `GET /api/client-agent/latest-version` - 返回最新版本信息
   - 响应格式：
     ```json
     {
       "version": "1.2.0",
       "releaseDate": "2024-01-15",
       "downloadUrls": {
         "windows": "/downloads/lsc-ai-client-1.2.0-win.exe",
         "macos": "/downloads/lsc-ai-client-1.2.0-mac.dmg",
         "linux": "/downloads/lsc-ai-client-1.2.0-linux.deb"
       },
       "changelog": "修复了若干 bug，提升了稳定性"
     }
     ```

2. **前端增强**：
   - 启动时调用版本检查 API
   - 如果本地 Agent 版本低于服务器最新版本，提示用户更新
   - 在设置页面显示当前版本和最新版本对比

3. **版本文件**：
   在 `downloads/client-agent/` 目录下维护 `version.json`：
   ```json
   {
     "latestVersion": "1.2.0",
     "minSupportedVersion": "1.0.0",
     "updateRequired": false
   }
   ```

#### 临时解决方案

在版本检查功能实现之前：

1. 手动维护 Client Agent 安装包文件名，包含版本号
2. 在 README.md 中记录当前版本
3. 通知用户手动检查和更新

### 部署后验证

部署完成后，验证 Client Agent 下载功能：

```bash
# 1. 检查下载文件是否存在
ls -lh downloads/client-agent/windows/

# 2. 检查文件大小（应该 > 50MB）
du -h downloads/client-agent/windows/LSC-AI-Client-Agent-Setup.exe

# 3. 在浏览器访问
curl -I http://<服务器IP>/downloads/lsc-ai-client-win.exe

# 4. 前端验证
# 登录系统 → 点击侧边栏"本地模式" → 查看下载按钮是否正常
```

## Nginx 静态文件配置（生产环境）

如果使用 Nginx 作为反向代理，需要配置静态文件服务：

```nginx
server {
    listen 80;
    server_name your-server.com;

    # Client Agent 下载目录
    location /downloads/ {
        alias /path/to/offline-deploy-openEuler/downloads/client-agent/;
        autoindex off;

        # 设置正确的 MIME 类型
        types {
            application/octet-stream exe;
            application/x-apple-diskimage dmg;
            application/vnd.debian.binary-package deb;
        }

        # 启用下载
        add_header Content-Disposition 'attachment';
    }

    # 前端静态文件
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 配置验证清单

部署前请确认：

- [ ] 已修改所有默认密码
- [ ] JWT_SECRET 和 JWT_REFRESH_SECRET 使用强随机密钥
- [ ] CREDENTIAL_SALT 和 CREDENTIAL_KEY 已设置
- [ ] DEEPSEEK_API_KEY 已填写
- [ ] Client Agent 安装包已放置在 downloads 目录
- [ ] 已测试 Client Agent 下载链接可访问
- [ ] 防火墙已开放必要端口 (80, 3000)
- [ ] 已备份 .env 文件到安全位置

## 故障排查

### Client Agent 下载失败

1. **404 错误**：
   - 检查文件路径：`ls downloads/client-agent/windows/`
   - 检查 Web 容器是否正常运行：`docker ps | grep lscai-web`

2. **下载速度慢**：
   - 安装包通常 > 50MB，下载需要时间
   - 考虑使用局域网文件共享分发

3. **安装包损坏**：
   - 验证文件完整性：`md5sum LSC-AI-Client-Agent-Setup.exe`
   - 重新生成或下载安装包

### 版本不匹配

如果遇到版本兼容性问题：

1. 确认服务器版本：`docker exec lscai-server cat package.json | grep version`
2. 确认 Client Agent 版本：在 Agent 窗口查看
3. 如果版本差异过大，重新构建并分发 Client Agent

## 安全建议

1. **定期更新密钥**：建议每季度更新一次 JWT 密钥和凭据加密密钥
2. **限制访问**：仅允许公司内网访问，使用防火墙规则限制外部访问
3. **启用 HTTPS**：生产环境必须使用 SSL/TLS 加密
4. **审计日志**：定期检查系统审计日志，发现异常访问
5. **备份配置**：将 .env 文件加密备份到安全位置
