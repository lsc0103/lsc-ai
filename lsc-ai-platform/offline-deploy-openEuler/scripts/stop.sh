#!/bin/bash
###############################################################################
# LSC-AI Platform - Stop Script
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(dirname "$SCRIPT_DIR")/docker"

echo "Stopping LSC-AI Platform..."

cd "$DOCKER_DIR"
docker compose stop

echo ""
echo "Services stopped"
echo "To completely remove containers, run: docker compose down"
