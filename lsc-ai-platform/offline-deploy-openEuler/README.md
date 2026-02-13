# LSC-AI 平台 - 离线部署指南

> 完全离线、零配置、一键部署
> 部署失败自动回滚，零痕迹，可立即重试

---

## 一、部署三步走

### 步骤 1：打包并上传到服务器

```bash
# 在本地 Windows 上打包（使用 Git Bash 或 7-Zip）
cd D:\u3d-projects\lscmade7\lsc-ai-platform
tar -czf offline-deploy-openEuler.tar.gz offline-deploy-openEuler/

# 方式1：U盘拷贝（推荐，完全离线）
# 将 offline-deploy-openEuler.tar.gz 拷贝到U盘，插入服务器

# 方式2：内网传输（如果有网络连接）
scp offline-deploy-openEuler.tar.gz root@<服务器IP>:/opt/
```

### 步骤 2：解压并授权

```bash
# SSH 登录服务器
ssh root@<服务器IP>

# 解压
cd /opt
tar -xzf offline-deploy-openEuler.tar.gz
cd offline-deploy-openEuler

# 授权脚本
chmod +x scripts/*.sh
```

### 步骤 3：一键部署

```bash
sudo bash scripts/deploy.sh
```

**就这么简单！** 脚本会自动：
- ✅ 检测服务器 IP
- ✅ 生成所有密码（24-64位随机强密码）
- ✅ 安装 Docker（从离线 RPM 包）
- ✅ 加载 Docker 镜像
- ✅ 启动所有服务
- ✅ 初始化数据库（创建管理员账号）
- ✅ 等待服务就绪

---

## 二、部署成功输出

```
========================================
  DEPLOYMENT SUCCESSFUL!
========================================

Access URLs:
  Web Frontend:  http://10.18.55.100:5173
  API Service:   http://10.18.55.100:3000
  API Docs:      http://10.18.55.100:3000/api
  MinIO Console: http://10.18.55.100:9001

Default Admin Account:
  Username: admin
  Password: Admin@123

Credentials saved to:
  config/CREDENTIALS_20260203_143015.txt

Container Status:
NAME              STATUS
lscai-web         Up (healthy)
lscai-server      Up (healthy)
lscai-postgres    Up (healthy)
lscai-redis       Up (healthy)
lscai-minio       Up (healthy)
```

**所有密码都保存在 `config/CREDENTIALS_*.txt`**，请妥善保管！

---

## 三、快速验证

### 1. 检查容器状态

```bash
cd /opt/offline-deploy-openEuler/docker
docker compose ps
```

所有容器应该是 `Up` 或 `healthy` 状态。

### 2. 测试 API

```bash
curl http://localhost:3000/api/health
```

应该返回：`{"status":"ok"}`

### 3. 浏览器访问

打开浏览器访问：`http://<服务器IP>:5173`
使用账号：`admin` / `Admin@123` 登录

---

## 四、服务端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| **前端** | 5173 | Web 界面 |
| **后端 API** | 3000 | REST API |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存 |
| MinIO | 9000 | 文件存储 API |
| MinIO Console | 9001 | 文件存储管理界面 |

---

## 五、日常管理

部署成功后，使用以下命令管理服务：

```bash
cd /opt/offline-deploy-openEuler/docker

# 启动服务
docker compose start

# 停止服务
docker compose stop

# 重启服务
docker compose restart

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f          # 所有服务
docker compose logs -f server   # 仅后端
docker compose logs -f web      # 仅前端
```

---

## 六、如果部署失败？

**不用担心！脚本会自动回滚，零痕迹。**

### 失败输出示例

```
========================================
  DEPLOYMENT FAILED - ROLLING BACK
========================================

[ERROR] Container lscai-server failed to start
[INFO] Initiating automatic rollback...

[INFO] Rollback: Stopping and removing containers...
[SUCCESS] Containers removed

[INFO] Rollback: Removing Docker volumes...
[SUCCESS] Volumes removed

[INFO] Rollback: Removing loaded Docker images...
[SUCCESS] Images removed

========================================
  ROLLBACK COMPLETE
========================================

All deployment changes have been reverted.
System is restored to its original state.

To retry deployment:
  sudo bash scripts/deploy.sh
```

### 处理流程

1. **查看错误日志**
   ```bash
   cat /opt/offline-deploy-openEuler/deployment.log
   ```

2. **根据错误类型修复**
   - 端口被占用 → 停止冲突的服务
   - 磁盘空间不足 → 清理磁盘
   - Docker 启动失败 → 查看 Docker 日志

3. **重新部署**
   ```bash
   sudo bash scripts/deploy.sh
   ```

**详细的错误解决方案，请查看《故障排查手册.md》**

---

## 七、常见问题 FAQ

### Q1: 需要手动配置吗？
**不需要！** 完全零配置，脚本自动检测 IP 和生成所有密码。

### Q2: 部署失败会留下垃圾文件吗？
**不会！** 失败时自动完全回滚，零痕迹，系统恢复到部署前的状态。

### Q3: 可以重复运行 deploy.sh 吗？
**可以！** 已完成的步骤会自动跳过，安全幂等。

### Q4: 部署需要多长时间？
约 **5-10 分钟**（取决于服务器性能）。

### Q5: 如何完全卸载？
```bash
cd /opt/offline-deploy-openEuler
sudo bash scripts/cleanup.sh
```
会询问是否删除数据卷和卸载 Docker。

### Q6: 密码在哪里？
所有密码保存在：`config/CREDENTIALS_*.txt`

### Q7: 如何修改配置？
编辑 `config/.env`，然后重启服务：
```bash
cd docker
docker compose restart
```

---

## 八、离线部署包内容

```
offline-deploy-openEuler/                    (~1.5 GB)
├── docker/
│   ├── docker-compose.yml                   # 服务编排
│   ├── init-data.sql                        # 数据库初始化（管理员账号）
│   └── .env                                 # 运行时配置（自动生成）
├── config/
│   └── CREDENTIALS_*.txt                    # 密码文件（自动生成）
├── downloads/
│   └── *.rpm                                # Docker RPM 包（8个，~100MB）
├── scripts/
│   └── deploy.sh                            # 一键部署脚本（核心）
├── docker-images.tar                        # Docker 镜像包（~1.3GB）
├── deployment.log                           # 部署日志（自动生成）
├── README.md                                # 本文件
└── 故障排查手册.md                           # 错误解决方案
```

---

## 九、系统要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| **操作系统** | openEuler 22.03 LTS | openEuler 22.03 LTS SP3 |
| **CPU** | 4 核 | 8 核 |
| **内存** | 8 GB | 16 GB |
| **磁盘** | 30 GB | 100 GB |
| **网络** | 无需联网 | - |

---

## 十、技术架构

```
┌─────────────────────────────────────────────────────┐
│  浏览器访问: http://<服务器IP>:5173                   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  lscai-web (React 前端 + Nginx)               :5173 │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  lscai-server (NestJS 后端)                   :3000 │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ PostgreSQL  │ │   Redis     │ │   MinIO     │
│   :5432     │ │   :6379     │ │ :9000/:9001 │
└─────────────┘ └─────────────┘ └─────────────┘
```

---

## 十一、安全说明

### 自动生成的密码
- **数据库密码**：24 位随机字符
- **Redis 密码**：24 位随机字符
- **MinIO 密码**：24 位随机字符
- **JWT Secret**：64 位随机字符
- **加密密钥**：32 位随机字符

### DeepSeek API
使用公司内网 API：
- **地址**：`http://10.18.55.233:30069/deepseek_v3/chi/v1`
- **API Key**：`your-internal-api-key-here`（请联系管理员获取实际 Key）

### 默认管理员账号
- **用户名**：`admin`
- **密码**：`Admin@123`

**首次登录后请立即修改默认密码！**

---

## 十二、事务性部署原理

部署采用 **事务性（Transactional）模式**：

- ✅ **成功**：所有步骤完成，系统正常运行
- ❌ **失败**：自动回滚，删除所有部署痕迹，系统恢复原状

### 自动回滚包括
1. 停止并删除所有容器
2. 删除所有数据卷
3. 删除加载的 Docker 镜像
4. 删除 Docker 网络
5. 删除生成的配置文件
6. 卸载 Docker（仅当是脚本安装的）

**回滚后可以立即重试，不会有任何冲突！**

---

## 十三、获取帮助

### 查看日志
```bash
# 部署日志
cat /opt/offline-deploy-openEuler/deployment.log

# 服务日志
cd /opt/offline-deploy-openEuler/docker
docker compose logs -f
```

### 常见错误
请查看 **《故障排查手册.md》**，包含：
- 端口冲突解决
- 磁盘空间不足
- Docker 启动失败
- 容器启动超时
- PostgreSQL 连接失败
- 等常见错误的详细解决方案

### 联系支持
遇到无法解决的问题，请联系系统管理员，并提供：
- `deployment.log` 文件
- `docker compose logs` 输出
- 服务器系统信息

---

## 开始部署吧！

现在就可以按照上面的 **"一、部署三步走"** 开始部署了。

**记住**：
- 🎯 完全自动，无需配置
- 🛡️ 失败自动回滚，零痕迹
- 🔄 可以反复重试，直到成功
- 📝 遇到问题查看《故障排查手册.md》

祝部署顺利！
