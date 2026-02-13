#!/bin/bash
###############################################################################
# LSC-AI Platform - Manual Cleanup Script
# Purpose: Manually clean up a SUCCESSFUL deployment or for complete uninstall
#
# NOTE: If deployment FAILED, automatic rollback already cleaned up.
#       This script is for cleaning up SUCCESSFUL deployments.
#
# Use cases:
#   - Uninstall LSC-AI Platform completely
#   - Clean up before fresh reinstall
#   - Remove all data and start over
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$ROOT_DIR/docker"
CONFIG_DIR="$ROOT_DIR/config"

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

print_header() {
    echo ""
    echo "========================================"
    echo "  LSC-AI Platform Cleanup"
    echo "========================================"
    echo ""
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        log_info "Please use: sudo bash $0"
        exit 1
    fi
}

# Stop and remove all containers
cleanup_containers() {
    log_info "Stopping and removing containers..."

    cd "$DOCKER_DIR" 2>/dev/null || {
        log_warning "Docker directory not found, skipping container cleanup"
        return 0
    }

    if [ -f "docker-compose.yml" ]; then
        # Stop all services
        docker compose stop 2>/dev/null || true

        # Remove all containers
        docker compose down 2>/dev/null || true

        log_success "Containers cleaned up"
    else
        log_warning "docker-compose.yml not found"
    fi
}

# Remove Docker volumes
cleanup_volumes() {
    log_warning "Do you want to remove data volumes? This will DELETE ALL DATA!"
    read -p "Remove volumes? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        log_info "Removing Docker volumes..."
        docker volume rm lscai-postgres-data 2>/dev/null || true
        docker volume rm lscai-redis-data 2>/dev/null || true
        docker volume rm lscai-minio-data 2>/dev/null || true
        log_success "Volumes removed"
    else
        log_info "Volumes preserved"
    fi
}

# Remove generated configuration files
cleanup_config() {
    log_info "Cleaning up generated configuration files..."

    # Backup existing config
    if [ -f "$CONFIG_DIR/.env" ]; then
        BACKUP_FILE="$CONFIG_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CONFIG_DIR/.env" "$BACKUP_FILE"
        log_info "Backed up .env to: $BACKUP_FILE"
    fi

    # Remove generated files
    rm -f "$CONFIG_DIR/.env" 2>/dev/null || true
    rm -f "$DOCKER_DIR/.env" 2>/dev/null || true

    log_success "Configuration files cleaned up"
}

# Uninstall Docker (optional)
uninstall_docker() {
    log_warning "Do you want to UNINSTALL Docker?"
    read -p "Uninstall Docker? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        log_info "Uninstalling Docker..."

        # Stop Docker service
        systemctl stop docker 2>/dev/null || true
        systemctl disable docker 2>/dev/null || true

        # Remove Docker packages
        yum remove -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin 2>/dev/null || true

        # Remove Docker data
        rm -rf /var/lib/docker 2>/dev/null || true
        rm -rf /var/lib/containerd 2>/dev/null || true

        log_success "Docker uninstalled"
    else
        log_info "Docker preserved"
    fi
}

# Show cleanup summary
show_summary() {
    echo ""
    echo "========================================"
    echo "  Cleanup Complete!"
    echo "========================================"
    echo ""
    echo "You can now:"
    echo "  1. Fix any issues"
    echo "  2. Re-run deployment: sudo bash scripts/deploy.sh"
    echo "  3. Check logs for errors"
    echo ""
    log_info "Preserved files:"
    echo "  - Docker images (in docker-images.tar)"
    echo "  - Deployment scripts"
    echo "  - Configuration backups"
    echo ""
}

# Main cleanup flow
main() {
    print_header
    check_root

    log_warning "This will clean up the LSC-AI deployment"
    log_warning "Containers will be stopped and removed"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Cleanup cancelled"
        exit 0
    fi

    cleanup_containers
    cleanup_volumes
    cleanup_config
    uninstall_docker
    show_summary
}

main
