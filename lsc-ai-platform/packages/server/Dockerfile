# LSC-AI Platform - Backend Dockerfile
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
COPY packages/server/package.json ./packages/server/
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY packages/server ./packages/server/
COPY tsconfig.base.json ./

# Generate Prisma client
RUN pnpm exec prisma generate --schema=prisma/schema.prisma

# Build the application
WORKDIR /app/packages/server
RUN pnpm run build

# ============== Production Stage ==============
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy necessary files from builder
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.pnpm/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
RUN pnpm install --prod --ignore-scripts

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
