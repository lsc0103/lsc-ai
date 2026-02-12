import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SentinelService {
  private readonly logger = new Logger(SentinelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new Sentinel Agent
   */
  async register(data: {
    name: string;
    hostname: string;
    ipAddress: string;
    platform: string;
    agentVersion: string;
    capabilities?: any;
  }) {
    const agent = await this.prisma.sentinelAgent.create({
      data: {
        name: data.name,
        hostname: data.hostname,
        ipAddress: data.ipAddress,
        platform: data.platform,
        agentVersion: data.agentVersion,
        capabilities: data.capabilities ?? [],
        status: 'online',
        lastSeenAt: new Date(),
      },
    });
    this.logger.log(`Sentinel Agent registered: ${agent.name} (${agent.id})`);
    return agent;
  }

  /**
   * List all Sentinel Agents, ordered by lastSeenAt desc
   */
  async list() {
    return this.prisma.sentinelAgent.findMany({
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /**
   * Get a single Sentinel Agent by ID
   */
  async getById(id: string) {
    return this.prisma.sentinelAgent.findUnique({
      where: { id },
    });
  }

  /**
   * Update a Sentinel Agent
   */
  async update(id: string, data: {
    name?: string;
    capabilities?: any;
    status?: string;
  }) {
    return this.prisma.sentinelAgent.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.capabilities !== undefined && { capabilities: data.capabilities }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  /**
   * Delete a Sentinel Agent
   */
  async remove(id: string) {
    return this.prisma.sentinelAgent.delete({
      where: { id },
    });
  }

  /**
   * Update heartbeat: set lastSeenAt to now and status to online
   */
  async updateHeartbeat(id: string) {
    return this.prisma.sentinelAgent.update({
      where: { id },
      data: {
        lastSeenAt: new Date(),
        status: 'online',
      },
    });
  }

  /**
   * Get health overview: total, online, offline counts
   */
  async getHealthOverview() {
    const [total, online] = await Promise.all([
      this.prisma.sentinelAgent.count(),
      this.prisma.sentinelAgent.count({ where: { status: 'online' } }),
    ]);
    return {
      total,
      online,
      offline: total - online,
    };
  }

  /**
   * Mark agents as offline if no heartbeat in 5 minutes
   * Runs every minute via @Cron
   */
  @Cron('*/1 * * * *')
  async markOfflineAgents() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await this.prisma.sentinelAgent.updateMany({
      where: {
        status: 'online',
        lastSeenAt: { lt: fiveMinutesAgo },
      },
      data: { status: 'offline' },
    });
    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} sentinel agent(s) as offline (no heartbeat in 5min)`);
    }
  }
}
