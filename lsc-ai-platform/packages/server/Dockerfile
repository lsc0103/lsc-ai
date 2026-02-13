# LSC-AI Platform - Backend Dockerfile
# Build from parent directory: docker build -t lscai/server:latest -f lsc-ai-platform/packages/server/Dockerfile .

# ============== Build Stage ==============
FROM node:20-slim AS builder

WORKDIR /workspace

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Configure pnpm to use hoisted node_modules (no symlinks)
RUN pnpm config set node-linker hoisted

# Copy @lsc-ai/core package first (workspace dependency)
COPY localAI/packages/core /workspace/localAI/packages/core/

# Copy lsc-ai-platform workspace files
COPY lsc-ai-platform/package.json lsc-ai-platform/pnpm-workspace.yaml /workspace/lsc-ai-platform/
COPY lsc-ai-platform/pnpm-lock.yaml* /workspace/lsc-ai-platform/
COPY lsc-ai-platform/packages/server/package.json /workspace/lsc-ai-platform/packages/server/
COPY lsc-ai-platform/prisma /workspace/lsc-ai-platform/prisma/

# Create combined workspace config
WORKDIR /workspace/lsc-ai-platform
RUN echo "packages:" > pnpm-workspace.yaml && \
    echo "  - 'packages/*'" >> pnpm-workspace.yaml && \
    echo "  - '../localAI/packages/*'" >> pnpm-workspace.yaml

# Install all dependencies
RUN pnpm install || pnpm install --no-frozen-lockfile

# Build @lsc-ai/core
RUN npx tsc --project ../localAI/packages/core/tsconfig.json || true

# Copy server source code and tsconfig files
COPY lsc-ai-platform/packages/server/src /workspace/lsc-ai-platform/packages/server/src/
COPY lsc-ai-platform/packages/server/tsconfig.json /workspace/lsc-ai-platform/packages/server/
COPY lsc-ai-platform/packages/server/nest-cli.json /workspace/lsc-ai-platform/packages/server/
COPY lsc-ai-platform/tsconfig.base.json /workspace/lsc-ai-platform/

# Build server
WORKDIR /workspace/lsc-ai-platform/packages/server
RUN pnpm run build

# ============== Production Stage ==============
FROM node:20-slim AS production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nestjs

# Copy node_modules from builder
COPY --from=builder /workspace/lsc-ai-platform/node_modules ./node_modules

# Copy @lsc-ai/core into node_modules
COPY --from=builder /workspace/localAI/packages/core ./node_modules/@lsc-ai/core

# Copy server built code
COPY --from=builder /workspace/lsc-ai-platform/packages/server/dist ./dist
COPY --from=builder /workspace/lsc-ai-platform/packages/server/package.json ./package.json

# Copy prisma schema
COPY --from=builder /workspace/lsc-ai-platform/prisma ./prisma

# Create data directory for LibSQL
RUN mkdir -p /app/data

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
