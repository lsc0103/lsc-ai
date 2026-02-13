#!/bin/bash
###############################################################################
# LSC-AI Platform - Start Script
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")/docker"

echo "Starting LSC-AI Platform..."

cd "$DOCKER_DIR"
docker compose start

echo ""
echo "Service Status:"
docker compose ps

echo ""
echo "Access URL: http://$(hostname -I | awk '{print $1}')"
