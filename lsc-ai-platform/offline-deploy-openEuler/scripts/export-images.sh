#!/bin/bash
###############################################################################
# LSC-AI Platform - Docker 镜像导出脚本
# 用途：在有网络的机器上构建并导出所有 Docker 镜像，生成离线部署包
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# 输出目录
OUTPUT_DIR="$ROOT_DIR"
IMAGES_TAR="$OUTPUT_DIR/docker-images.tar"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印标题
print_header() {
    echo ""
    echo "========================================"
    echo "  LSC-AI Platform 镜像导出工具"
    echo "========================================"
    echo ""
}

# 检查 Docker
check_docker() {
    log_info "检查 Docker 环境..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker 未运行，请启动 Docker 服务"
        exit 1
    fi

    DOCKER_VERSION=$(docker --version)
    log_success "Docker 已就绪: $DOCKER_VERSION"
}

# 构建应用镜像
build_images() {
    log_info "开始构建应用镜像..."

    cd "$PROJECT_ROOT"

    # 构建 Server 镜像
    log_info "构建 Server 镜像（可能需要 5-10 分钟）..."
    docker build -f packages/server/Dockerfile -t lscai/server:latest .
    log_success "Server 镜像构建完成"

    # 构建 Web 镜像
    log_info "构建 Web 镜像（可能需要 5-10 分钟）..."
    docker build -f packages/web/Dockerfile -t lscai/web:latest .
    log_success "Web 镜像构建完成"
}

# 拉取基础镜像
pull_base_images() {
    log_info "拉取基础镜像..."

    docker pull postgres:15-alpine
    docker pull redis:7-alpine
    docker pull minio/minio:latest

    log_success "基础镜像拉取完成"
}

# 导出所有镜像
export_images() {
    log_info "导出 Docker 镜像..."

    # 删除旧的镜像文件
    if [ -f "$IMAGES_TAR" ]; then
        log_warning "删除旧的镜像文件: $IMAGES_TAR"
        rm -f "$IMAGES_TAR"
    fi

    # 导出所有镜像到一个 tar 文件
    log_info "正在导出镜像（可能需要几分钟）..."
    docker save \
        lscai/server:latest \
        lscai/web:latest \
        postgres:15-alpine \
        redis:7-alpine \
        minio/minio:latest \
        -o "$IMAGES_TAR"

    # 检查文件大小
    IMAGE_SIZE=$(du -h "$IMAGES_TAR" | cut -f1)
    log_success "镜像导出完成: $IMAGES_TAR ($IMAGE_SIZE)"
}

# 显示镜像列表
show_images() {
    log_info "LSC-AI 相关镜像:"
    docker images | grep -E "lscai|postgres|redis|minio" || log_warning "未找到镜像"
}

# 下载 Docker 离线安装包
download_docker_packages() {
    log_info "准备 Docker 离线安装包..."

    DOWNLOADS_DIR="$OUTPUT_DIR/downloads"
    mkdir -p "$DOWNLOADS_DIR"

    log_warning "注意: 需要手动下载以下文件到 $DOWNLOADS_DIR 目录:"
    echo "  1. Docker CE RPM 包（openEuler）"
    echo "     - docker-ce-*.rpm"
    echo "     - docker-ce-cli-*.rpm"
    echo "     - containerd.io-*.rpm"
    echo "     下载地址: https://download.docker.com/linux/centos/8/x86_64/stable/Packages/"
    echo ""
    echo "  2. Docker Compose 二进制文件"
    echo "     - docker-compose"
    echo "     下载地址: https://github.com/docker/compose/releases"
    echo ""
}

# 准备 Client Agent 安装包
prepare_client_agent() {
    log_info "准备 Client Agent 安装包..."

    CLIENT_AGENT_DIR="$OUTPUT_DIR/downloads/client-agent/windows"
    mkdir -p "$CLIENT_AGENT_DIR"

    # 查找 Client Agent 安装包
    CLIENT_AGENT_BUILD="$PROJECT_ROOT/packages/client-agent/dist"

    if [ -f "$CLIENT_AGENT_BUILD/LSC-AI-Client-Agent-Setup.exe" ]; then
        log_info "复制 Client Agent 安装包..."
        cp "$CLIENT_AGENT_BUILD/LSC-AI-Client-Agent-Setup.exe" "$CLIENT_AGENT_DIR/"
        log_success "Client Agent 安装包已准备"
    else
        log_warning "未找到 Client Agent 安装包"
        log_info "请先构建 Client Agent: cd packages/client-agent && pnpm build:win"
    fi
}

# 生成部署包信息
generate_info() {
    log_info "生成部署包信息..."

    INFO_FILE="$OUTPUT_DIR/DEPLOYMENT_INFO.txt"

    cat > "$INFO_FILE" <<EOF
LSC-AI Platform 离线部署包
生成时间: $(date '+%Y-%m-%d %H:%M:%S')

包含的 Docker 镜像:
- lscai/server:latest
- lscai/web:latest
- postgres:15-alpine
- redis:7-alpine
- minio/minio:latest

文件清单:
- docker-images.tar          Docker 镜像包
- README.md                  部署说明
- scripts/deploy.sh          一键部署脚本
- scripts/start.sh           启动脚本
- scripts/stop.sh            停止脚本
- docker/docker-compose.yml  生产环境配置
- config/.env.example        环境变量模板
- downloads/                 离线安装包目录
  - docker-*.rpm            Docker RPM 包（需手动下载）
  - docker-compose          Docker Compose 二进制（需手动下载）
  - client-agent/windows/   Client Agent 安装包

部署步骤:
1. 将整个 offline-deploy-openEuler 目录复制到目标服务器
2. 运行: sudo bash scripts/deploy.sh
3. 访问: http://<服务器IP>

详细说明请参考 README.md
EOF

    log_success "部署包信息已生成: $INFO_FILE"
}

# 打包完整离线部署包
create_deployment_package() {
    log_info "创建完整离线部署包..."

    PACKAGE_NAME="lscai-offline-deploy-openeuler-$(date '+%Y%m%d-%H%M%S').tar.gz"
    PACKAGE_PATH="$PROJECT_ROOT/$PACKAGE_NAME"

    cd "$PROJECT_ROOT"
    tar czf "$PACKAGE_PATH" \
        -C "$(dirname "$OUTPUT_DIR")" \
        "$(basename "$OUTPUT_DIR")"

    PACKAGE_SIZE=$(du -h "$PACKAGE_PATH" | cut -f1)
    log_success "离线部署包已创建: $PACKAGE_PATH ($PACKAGE_SIZE)"
}

# 显示完成信息
show_completion() {
    echo ""
    echo "========================================"
    echo "  镜像导出完成！"
    echo "========================================"
    echo ""
    echo "生成的文件:"
    echo "  镜像文件: $IMAGES_TAR"
    echo "  部署目录: $OUTPUT_DIR"
    echo ""
    echo "下一步:"
    echo "  1. 手动下载 Docker RPM 包到 $OUTPUT_DIR/downloads/"
    echo "  2. 手动下载 docker-compose 到 $OUTPUT_DIR/downloads/"
    echo "  3. 确保 Client Agent 安装包在 $OUTPUT_DIR/downloads/client-agent/windows/"
    echo "  4. 将整个 offline-deploy-openEuler 目录复制到目标服务器"
    echo "  5. 在服务器上运行: sudo bash scripts/deploy.sh"
    echo ""
}

# 主函数
main() {
    print_header
    check_docker
    build_images
    pull_base_images
    export_images
    show_images
    download_docker_packages
    prepare_client_agent
    generate_info
    show_completion
}

# 执行主函数
main
