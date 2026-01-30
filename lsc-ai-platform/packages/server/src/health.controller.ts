import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '健康检查' })
  async check() {
    const checks: Record<string, { status: string; message?: string }> = {};

    // 检查数据库连接
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok' };
    } catch (error) {
      checks.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: checks,
    };
  }
}
