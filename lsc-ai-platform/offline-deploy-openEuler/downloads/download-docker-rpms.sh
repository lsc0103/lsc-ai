#!/bin/bash
###############################################################################
# Docker RPM 包批量下载脚本
###############################################################################

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Docker RPM 包下载工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 设置版本号（可以修改为最新版本）
DOCKER_VERSION="${DOCKER_VERSION:-27.5.1}"
CONTAINERD_VERSION="${CONTAINERD_VERSION:-1.6.28-3.1}"
BUILDX_VERSION="${BUILDX_VERSION:-0.20.0}"
COMPOSE_VERSION="${COMPOSE_VERSION:-2.33.1}"

# 基础 URL（可以使用镜像源加速）
BASE_URL="https://download.docker.com/linux/centos/8/x86_64/stable/Packages"

# 使用国内镜像（可选）
# BASE_URL="https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/centos/8/x86_64/stable/Packages"
# BASE_URL="https://mirrors.aliyun.com/docker-ce/linux/centos/8/x86_64/stable/Packages"

echo -e "${BLUE}[INFO]${NC} Docker 版本: ${DOCKER_VERSION}"
echo -e "${BLUE}[INFO]${NC} Containerd 版本: ${CONTAINERD_VERSION}"
echo -e "${BLUE}[INFO]${NC} Docker Buildx 版本: ${BUILDX_VERSION}"
echo -e "${BLUE}[INFO]${NC} Docker Compose 版本: ${COMPOSE_VERSION}"
echo ""

# 文件列表
FILES=(
    "containerd.io-${CONTAINERD_VERSION}.el8.x86_64.rpm"
    "docker-ce-${DOCKER_VERSION}-1.el8.x86_64.rpm"
    "docker-ce-cli-${DOCKER_VERSION}-1.el8.x86_64.rpm"
    "docker-ce-rootless-extras-${DOCKER_VERSION}-1.el8.x86_64.rpm"
    "docker-buildx-plugin-${BUILDX_VERSION}-1.el8.x86_64.rpm"
    "docker-compose-plugin-${COMPOSE_VERSION}-1.el8.x86_64.rpm"
)

# 下载函数
download_file() {
    local file=$1
    local url="${BASE_URL}/${file}"

    if [ -f "$file" ]; then
        echo -e "${YELLOW}[SKIP]${NC} ${file} 已存在"
        return 0
    fi

    echo -e "${BLUE}[DOWN]${NC} 正在下载 ${file}..."

    if command -v wget &> /dev/null; then
        wget -q --show-progress "$url" -O "$file"
    elif command -v curl &> /dev/null; then
        curl -# -L "$url" -o "$file"
    else
        echo -e "${YELLOW}[ERROR]${NC} 未找到 wget 或 curl，请手动安装"
        exit 1
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[SUCCESS]${NC} ${file} 下载完成"
    else
        echo -e "${YELLOW}[ERROR]${NC} ${file} 下载失败"
        rm -f "$file"
        return 1
    fi
}

# 下载所有文件
echo -e "${BLUE}[INFO]${NC} 开始下载 Docker RPM 包..."
echo ""

FAILED_FILES=()

for file in "${FILES[@]}"; do
    download_file "$file" || FAILED_FILES+=("$file")
done

echo ""
echo -e "${BLUE}========================================${NC}"

# 检查下载结果
if [ ${#FAILED_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}[SUCCESS]${NC} 所有文件下载完成！"
    echo ""
    echo "已下载的文件："
    ls -lh *.rpm | awk '{print "  " $9 " (" $5 ")"}'

    echo ""
    echo "总大小："
    du -sh *.rpm | awk '{print "  " $1}'

    echo ""
    echo -e "${GREEN}下一步:${NC}"
    echo "  1. 返回上级目录: cd .."
    echo "  2. 运行部署脚本: bash scripts/deploy.sh"
else
    echo -e "${YELLOW}[WARNING]${NC} 以下文件下载失败："
    for file in "${FAILED_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "请检查网络连接或版本号是否正确"
    echo "或手动从以下地址下载："
    echo "  ${BASE_URL}"
fi

echo -e "${BLUE}========================================${NC}"
