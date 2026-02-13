#!/bin/bash
###############################################################################
# LSC-AI Platform - Transactional Deployment Script
# Purpose: Deploy with automatic rollback on any error
# Behavior: Either complete success or full rollback (no traces left)
###############################################################################

set -e  # Exit immediately on error
set -E  # Inherit ERR trap in functions

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$ROOT_DIR/docker"
CONFIG_DIR="$ROOT_DIR/config"
DOWNLOADS_DIR="$ROOT_DIR/downloads"
LOG_FILE="$ROOT_DIR/deployment.log"
STATE_FILE="$ROOT_DIR/.deployment_state"

# Deployment state tracking
DOCKER_INSTALLED=false
DOCKER_WAS_RUNNING=false
IMAGES_LOADED=false
CONFIG_CREATED=false
CONTAINERS_STARTED=false
VOLUMES_CREATED=false

# Initialize
initialize() {
    # Check if Docker was already installed
    if command -v docker &> /dev/null; then
        DOCKER_WAS_RUNNING=true
    fi

    # Initialize log file
    echo "=== LSC-AI Platform Deployment Log ===" > "$LOG_FILE"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"

    # Initialize state file
    > "$STATE_FILE"
}

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $1" >> "$LOG_FILE"
    echo "Error occurred at: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
}

# Save state
save_state() {
    local step=$1
    echo "$step" >> "$STATE_FILE"
    log_info "State saved: $step"
}

# Rollback function - automatically called on error
rollback() {
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        return  # Normal exit, no rollback needed
    fi

    echo ""
    echo "========================================"
    echo -e "${RED}  DEPLOYMENT FAILED - ROLLING BACK${NC}"
    echo "========================================"
    echo "" | tee -a "$LOG_FILE"

    log_error "Deployment failed with exit code $exit_code"
    log_info "Initiating automatic rollback..."
    echo "" | tee -a "$LOG_FILE"

    # Rollback in reverse order of installation

    # Step 1: Stop and remove containers
    if [ "$CONTAINERS_STARTED" = true ]; then
        log_info "Rollback: Stopping and removing containers..."
        cd "$DOCKER_DIR" 2>/dev/null && docker compose down -v 2>/dev/null || true
        log_success "Containers removed"
    fi

    # Step 2: Remove Docker volumes
    if [ "$VOLUMES_CREATED" = true ] || [ "$CONTAINERS_STARTED" = true ]; then
        log_info "Rollback: Removing Docker volumes..."
        docker volume rm lscai-postgres-data 2>/dev/null || true
        docker volume rm lscai-redis-data 2>/dev/null || true
        docker volume rm lscai-minio-data 2>/dev/null || true
        docker volume rm lscai-libsql-data 2>/dev/null || true
        log_success "Volumes removed"
    fi

    # Step 3: Remove loaded images (only if we loaded them)
    if [ "$IMAGES_LOADED" = true ]; then
        log_info "Rollback: Removing loaded Docker images..."
        docker rmi lscai/server:latest 2>/dev/null || true
        docker rmi lscai/web:latest 2>/dev/null || true
        docker rmi postgres:15-alpine 2>/dev/null || true
        docker rmi redis:7-alpine 2>/dev/null || true
        docker rmi minio/minio:latest 2>/dev/null || true
        log_success "Images removed"
    fi

    # Step 4: Remove Docker network
    log_info "Rollback: Removing Docker network..."
    docker network rm lscai-network 2>/dev/null || true

    # Step 5: Uninstall Docker (only if we installed it)
    if [ "$DOCKER_INSTALLED" = true ] && [ "$DOCKER_WAS_RUNNING" = false ]; then
        log_info "Rollback: Uninstalling Docker (we installed it)..."
        systemctl stop docker 2>/dev/null || true
        systemctl disable docker 2>/dev/null || true
        yum remove -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin 2>/dev/null || true
        rm -rf /var/lib/docker 2>/dev/null || true
        rm -rf /var/lib/containerd 2>/dev/null || true
        log_success "Docker uninstalled"
    fi

    # Step 6: Remove generated configuration files
    if [ "$CONFIG_CREATED" = true ]; then
        log_info "Rollback: Removing generated configuration..."
        rm -f "$CONFIG_DIR/.env" 2>/dev/null || true
        rm -f "$DOCKER_DIR/.env" 2>/dev/null || true
        rm -f "$CONFIG_DIR"/CREDENTIALS_*.txt 2>/dev/null || true
        log_success "Configuration removed"
    fi

    # Step 7: Remove state and log files
    log_info "Rollback: Cleaning up deployment artifacts..."
    rm -f "$STATE_FILE" 2>/dev/null || true

    # Save rollback completion to log before removing it
    echo "" >> "$LOG_FILE"
    echo "=== ROLLBACK COMPLETED ===" >> "$LOG_FILE"
    echo "System restored to pre-deployment state" >> "$LOG_FILE"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"

    # Show final message
    echo ""
    echo "========================================"
    echo -e "${GREEN}  ROLLBACK COMPLETE${NC}"
    echo "========================================"
    echo ""
    echo "All deployment changes have been reverted."
    echo "System is restored to its original state."
    echo ""
    echo "Rollback log saved to: $LOG_FILE"
    echo ""
    echo "To retry deployment:"
    echo "  sudo bash scripts/deploy.sh"
    echo ""
    echo "To investigate the error:"
    echo "  cat $LOG_FILE"
    echo ""

    exit $exit_code
}

# Set up trap for automatic rollback on error
trap rollback ERR EXIT

# Print header
print_header() {
    echo ""
    echo "========================================"
    echo "  LSC-AI Platform Deployment"
    echo "  Mode: Transactional (Auto-Rollback)"
    echo "========================================"
    echo ""
}

# Check root privileges
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        echo "Please use: sudo bash $0"
        exit 1
    fi
}

# Check system requirements
check_system() {
    log_info "Checking system requirements..."

    # Check OS
    if [ -f /etc/openEuler-release ]; then
        OS_VERSION=$(cat /etc/openEuler-release)
        log_success "OS: $OS_VERSION"
    else
        log_warning "openEuler not detected, but will continue"
    fi

    # Check memory
    TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 8 ]; then
        log_warning "Memory less than 8GB (current: ${TOTAL_MEM}GB)"
    else
        log_success "Memory: ${TOTAL_MEM}GB"
    fi

    # Check disk space
    AVAILABLE_SPACE=$(df -BG "$ROOT_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 30 ]; then
        log_error "Insufficient disk space: ${AVAILABLE_SPACE}GB (need 30GB)"
        exit 1
    else
        log_success "Available disk space: ${AVAILABLE_SPACE}GB"
    fi

    save_state "system_check_passed"
}

# Install Docker
install_docker() {
    log_info "Checking Docker installation..."

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log_success "Docker already installed: $DOCKER_VERSION"
        return 0
    fi

    log_info "Installing Docker..."

    if [ -d "$DOWNLOADS_DIR" ] && [ "$(ls -A $DOWNLOADS_DIR/*.rpm 2>/dev/null)" ]; then
        log_info "Installing from offline RPM packages..."
        cd "$DOWNLOADS_DIR"
        yum localinstall -y --disablerepo=* *.rpm
    else
        log_error "Docker RPM packages not found in $DOWNLOADS_DIR"
        exit 1
    fi

    # Start Docker service
    log_info "Starting Docker service..."
    systemctl start docker
    systemctl enable docker

    # Verify Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker failed to start"
        exit 1
    fi

    DOCKER_INSTALLED=true
    save_state "docker_installed"
    log_success "Docker installation complete"
}

# Check Docker Compose
check_docker_compose() {
    log_info "Checking Docker Compose..."

    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        log_success "Docker Compose installed: $COMPOSE_VERSION"
        return 0
    fi

    log_error "Docker Compose not available"
    exit 1
}

# Load Docker images
load_docker_images() {
    log_info "Loading Docker images..."

    IMAGE_FILE="$ROOT_DIR/docker-images.tar"
    if [ ! -f "$IMAGE_FILE" ]; then
        log_error "Image file not found: $IMAGE_FILE"
        exit 1
    fi

    log_info "Importing images (may take several minutes)..."
    docker load -i "$IMAGE_FILE"

    # Verify images loaded
    if ! docker images | grep -q "lscai/server"; then
        log_error "Failed to load lscai/server image"
        exit 1
    fi

    IMAGES_LOADED=true
    save_state "images_loaded"
    log_success "Image import complete"
}

# Generate strong random secret
generate_secret() {
    local length=$1
    if command -v openssl &> /dev/null; then
        openssl rand -base64 $length | tr -d '\n'
    else
        tr -dc 'A-Za-z0-9' < /dev/urandom | head -c $length
    fi
}

# Setup environment
setup_environment() {
    log_info "Auto-configuring environment variables..."

    ENV_FILE="$CONFIG_DIR/.env"

    # Detect server IP
    log_info "Auto-detecting server IP..."
    SERVER_IP=$(hostname -I | awk '{print $1}')
    if [ -z "$SERVER_IP" ]; then
        SERVER_IP="localhost"
    fi
    log_success "Server IP: $SERVER_IP"

    # Auto-generate all secrets
    log_info "Auto-generating security keys..."
    DB_PASSWORD=$(generate_secret 24)
    REDIS_PASSWORD=$(generate_secret 24)
    MINIO_PASSWORD=$(generate_secret 24)
    JWT_SECRET=$(generate_secret 64)
    JWT_REFRESH_SECRET=$(generate_secret 64)
    CREDENTIAL_SALT=$(generate_secret 24)
    CREDENTIAL_KEY=$(generate_secret 32)

    # Create .env file
    log_info "Creating production configuration..."
    cat > "$ENV_FILE" <<EOF
###############################################################################
# LSC-AI Platform - Production Configuration (Auto-Generated)
# Generated at: $(date '+%Y-%m-%d %H:%M:%S')
# Server IP: $SERVER_IP
###############################################################################

# Database
DB_USER=lscai
DB_PASSWORD=$DB_PASSWORD
DB_NAME=lscai

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD

# MinIO
MINIO_USER=minioadmin
MINIO_PASSWORD=$MINIO_PASSWORD
MINIO_BUCKET=lscai

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=7d

# DeepSeek API (Company Internal)
DEEPSEEK_API_KEY=\${DEEPSEEK_API_KEY:-your-internal-api-key-here}
DEEPSEEK_BASE_URL=http://10.18.55.233:30069/deepseek_v3/chi/v1

# Credential Encryption
CREDENTIAL_SALT=$CREDENTIAL_SALT
CREDENTIAL_KEY=$CREDENTIAL_KEY

# Application
LOG_LEVEL=info
WEB_PORT=80
SERVER_IP=$SERVER_IP
EOF

    # Save credentials
    CREDENTIALS_FILE="$CONFIG_DIR/CREDENTIALS_$(date +%Y%m%d_%H%M%S).txt"
    cat > "$CREDENTIALS_FILE" <<EOF
LSC-AI Platform Deployment Credentials
Generated at: $(date '+%Y-%m-%d %H:%M:%S')
Server IP: $SERVER_IP

=== Admin Account ===
Username: admin
Password: Admin@123

=== Database ===
User: lscai
Password: $DB_PASSWORD
Port: 5432

=== Redis ===
Password: $REDIS_PASSWORD
Port: 6379

=== MinIO ===
User: minioadmin
Password: $MINIO_PASSWORD
Console: http://$SERVER_IP:9001

=== Access URLs ===
Web: http://$SERVER_IP
API: http://$SERVER_IP:3000
Docs: http://$SERVER_IP:3000/api
EOF

    chmod 600 "$CREDENTIALS_FILE"

    # Copy to docker directory
    cp "$ENV_FILE" "$DOCKER_DIR/.env"

    CONFIG_CREATED=true
    save_state "config_created"
    log_success "Configuration complete"
}

# Start services
start_services() {
    log_info "Starting LSC-AI services..."

    cd "$DOCKER_DIR"

    if [ ! -f "docker-compose.yml" ]; then
        log_error "docker-compose.yml not found"
        exit 1
    fi

    # Start all services
    log_info "Starting containers..."
    docker compose up -d

    CONTAINERS_STARTED=true
    VOLUMES_CREATED=true
    save_state "containers_started"
    log_success "Containers started"
}

# Wait for services
wait_for_services() {
    log_info "Waiting for services to be ready..."

    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U lscai &> /dev/null; then
            log_success "PostgreSQL ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL failed to start (timeout)"
            exit 1
        fi
        sleep 2
    done

    # Wait for Redis
    log_info "Waiting for Redis..."
    sleep 5
    if ! docker compose exec -T redis redis-cli ping &> /dev/null; then
        log_error "Redis failed to start"
        exit 1
    fi
    log_success "Redis ready"

    # Wait for Server API
    log_info "Waiting for Server API..."
    for i in {1..60}; do
        if curl -sf http://localhost:3000/api/health &> /dev/null; then
            log_success "Server API ready"
            break
        fi
        if [ $i -eq 60 ]; then
            log_error "Server API failed to start (timeout)"
            exit 1
        fi
        sleep 2
    done

    save_state "services_ready"
}

# Show deployment info
show_deployment_info() {
    ENV_FILE="$CONFIG_DIR/.env"
    SERVER_IP=$(grep "^SERVER_IP=" "$ENV_FILE" | cut -d'=' -f2)

    echo ""
    echo "========================================"
    echo "  DEPLOYMENT SUCCESSFUL!"
    echo "========================================"
    echo ""
    echo "Access URLs:"
    echo "  Web Frontend:  http://$SERVER_IP"
    echo "  API Service:   http://$SERVER_IP:3000"
    echo "  API Docs:      http://$SERVER_IP:3000/api"
    echo "  MinIO Console: http://$SERVER_IP:9001"
    echo ""
    echo "Default Admin Account:"
    echo "  Username: admin"
    echo "  Password: Admin@123"
    echo ""

    LATEST_CREDS=$(ls -t "$CONFIG_DIR"/CREDENTIALS_*.txt 2>/dev/null | head -1)
    if [ -n "$LATEST_CREDS" ]; then
        echo "Credentials saved to:"
        echo "  $LATEST_CREDS"
        echo ""
    fi

    echo "Container Status:"
    docker compose -f "$DOCKER_DIR/docker-compose.yml" ps
    echo ""

    echo "Management Commands:"
    echo "  Start:   cd $DOCKER_DIR && docker compose start"
    echo "  Stop:    cd $DOCKER_DIR && docker compose stop"
    echo "  Logs:    cd $DOCKER_DIR && docker compose logs -f"
    echo "  Restart: cd $DOCKER_DIR && docker compose restart"
    echo ""

    log_info "Deployment log: $LOG_FILE"
    echo ""
}

# Main function
main() {
    initialize
    print_header
    check_root
    check_system
    install_docker
    check_docker_compose
    load_docker_images
    setup_environment
    start_services
    wait_for_services
    show_deployment_info

    # Log successful completion
    echo "" >> "$LOG_FILE"
    echo "=== DEPLOYMENT COMPLETED SUCCESSFULLY ===" >> "$LOG_FILE"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"

    # Clean up state file on success
    rm -f "$STATE_FILE"

    # Disable trap on successful exit
    trap - ERR EXIT
}

# Execute
main
