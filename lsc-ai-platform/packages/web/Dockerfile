# LSC-AI Platform - Frontend Dockerfile
# Multi-stage build for optimized production image

# ============== Build Stage ==============
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Copy package.json files
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY packages/web ./packages/web/
COPY tsconfig.base.json ./

# Build the application
WORKDIR /app/packages/web

# Build with production API URL (will be replaced by nginx)
ENV VITE_API_URL=/api
RUN pnpm run build

# ============== Production Stage ==============
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Create non-root user for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
