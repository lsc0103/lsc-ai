# Docker 离线安装包下载指南

## 需要下载的文件

### 1. Docker Engine（openEuler/CentOS 8 x86_64）

**下载地址**：https://download.docker.com/linux/centos/8/x86_64/stable/Packages/

需要下载的 RPM 包（选择最新版本）：

```bash
# 示例版本号（请下载最新版本）
containerd.io-1.6.28-3.1.el8.x86_64.rpm
docker-ce-27.5.1-1.el8.x86_64.rpm
docker-ce-cli-27.5.1-1.el8.x86_64.rpm
docker-ce-rootless-extras-27.5.1-1.el8.x86_64.rpm
docker-buildx-plugin-0.20.0-1.el8.x86_64.rpm
docker-compose-plugin-2.33.1-1.el8.x86_64.rpm
```

#### 方法一：浏览器手动下载
1. 访问：https://download.docker.com/linux/centos/8/x86_64/stable/Packages/
2. 找到以下文件（选择最新版本）：
   - `containerd.io-*.el8.x86_64.rpm`
   - `docker-ce-*.el8.x86_64.rpm`
   - `docker-ce-cli-*.el8.x86_64.rpm`
   - `docker-ce-rootless-extras-*.el8.x86_64.rpm`
   - `docker-buildx-plugin-*.el8.x86_64.rpm`
   - `docker-compose-plugin-*.el8.x86_64.rpm`
3. 下载到当前目录

#### 方法二：wget 批量下载（推荐）

```bash
# 设置版本号
DOCKER_VERSION="27.5.1"
CONTAINERD_VERSION="1.6.28-3.1"
BUILDX_VERSION="0.20.0"
COMPOSE_VERSION="2.33.1"

# 下载
wget https://download.docker.com/linux/centos/8/x86_64/stable/Packages/containerd.io-${CONTAINERD_VERSION}.el8.x86_64.rpm
wget https://download.docker.com/linux/centos/8/x86_64/stable/Packages/docker-ce-${DOCKER_VERSION}-1.el8.x86_64.rpm
wget https://download.docker.com/linux/centos/8/x86_64/stable/Packages/docker-ce-cli-${DOCKER_VERSION}-1.el8.x86_64.rpm
wget https://download.docker.com/linux/centos/8/x86_64/stable/Packages/docker-ce-rootless-extras-${DOCKER_VERSION}-1.el8.x86_64.rpm
wget https://download.docker.com/linux/centos/8/x86_64/stable/Packages/docker-buildx-plugin-${BUILDX_VERSION}-1.el8.x86_64.rpm
wget https://download.docker.com/linux/centos/8/x86_64/stable/Packages/docker-compose-plugin-${COMPOSE_VERSION}-1.el8.x86_64.rpm
```

#### 方法三：使用提供的下载脚本

```bash
bash download-docker-rpms.sh
```

### 2. Docker Compose（独立二进制，备用）

如果 docker-compose-plugin 不可用，可以下载独立的 docker-compose 二进制文件。

**下载地址**：https://github.com/docker/compose/releases

```bash
# 下载最新版本 (v2.33.1 示例)
COMPOSE_VERSION="v2.33.1"
wget https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64 -O docker-compose
chmod +x docker-compose
```

## 验证下载

下载完成后，验证文件：

```bash
# 列出所有 RPM 包
ls -lh *.rpm

# 验证 RPM 包完整性
rpm -K *.rpm

# 检查 docker-compose
./docker-compose version  # 如果下载了独立二进制
```

期望输出：
- 至少 6 个 .rpm 文件
- 文件大小合理（总共约 100-150MB）

## 常见问题

### Q: openEuler 能用 CentOS 8 的 RPM 包吗？
A: 可以。openEuler 与 CentOS 8 兼容性很好，Docker 官方推荐使用 CentOS 8 的包。

### Q: 版本号不匹配怎么办？
A: 只要大版本一致即可。例如 Docker 27.x 系列都可以互相兼容。

### Q: 下载速度慢怎么办？
A: 可以使用国内镜像：
```bash
# 清华大学镜像
https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/centos/8/x86_64/stable/Packages/

# 阿里云镜像
https://mirrors.aliyun.com/docker-ce/linux/centos/8/x86_64/stable/Packages/
```

### Q: 需要依赖包吗？
A: openEuler 通常已包含必要的依赖（如 device-mapper, libseccomp 等）。如果安装时提示缺少依赖，部署脚本会尝试在线安装。

## 下载完成后

将所有 .rpm 文件和 docker-compose 二进制文件放在当前目录（`downloads/`），然后运行：

```bash
cd ..
bash scripts/deploy.sh
```

部署脚本会自动检测并使用这些离线包。
