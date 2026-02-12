import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'accessToken', 'refreshToken', 'apiKey'];

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = '***';
      } else {
        result[key] = sanitize(value);
      }
    }
    return result;
  }
  return obj;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    userId?: string;
    username?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: unknown;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId ?? null,
          username: data.username ?? null,
          action: data.action,
          resourceType: data.resourceType ?? null,
          resourceId: data.resourceId ?? null,
          details: data.details ? (sanitize(data.details) as Prisma.InputJsonValue) : undefined,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ? data.userAgent.slice(0, 500) : null,
          success: data.success ?? true,
          errorMessage: data.errorMessage ?? null,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async list(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getStats(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byAction, byResourceType, totalCount] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
      days,
      totalCount,
      byAction: byAction.map((r) => ({ action: r.action, count: r._count.id })),
      byResourceType: byResourceType.map((r) => ({ resourceType: r.resourceType, count: r._count.id })),
    };
  }

  async exportLogs(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
  }
}
