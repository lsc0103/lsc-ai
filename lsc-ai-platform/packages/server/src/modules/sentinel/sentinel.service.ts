import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../notification/email.service.js';
import axios from 'axios';

/** Condition evaluator for alert rules */
function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'neq': return value !== threshold;
    default: return false;
  }
}

function conditionLabel(condition: string): string {
  const map: Record<string, string> = {
    gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', neq: '!=',
  };
  return map[condition] || condition;
}

@Injectable()
export class SentinelService {
  private readonly logger = new Logger(SentinelService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  // =====================================================================
  // Agent CRUD (existing)
  // =====================================================================

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

  async list() {
    return this.prisma.sentinelAgent.findMany({
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async getById(id: string) {
    return this.prisma.sentinelAgent.findUnique({
      where: { id },
    });
  }

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

  async remove(id: string) {
    return this.prisma.sentinelAgent.delete({
      where: { id },
    });
  }

  async updateHeartbeat(id: string) {
    return this.prisma.sentinelAgent.update({
      where: { id },
      data: {
        lastSeenAt: new Date(),
        status: 'online',
      },
    });
  }

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

  // =====================================================================
  // Metrics
  // =====================================================================

  /**
   * Report metrics from a Sentinel Agent
   */
  async reportMetrics(
    agentId: string,
    metrics: Array<{ name: string; value: number; unit?: string; tags?: Record<string, string> }>,
  ) {
    const data = metrics.map((m) => ({
      agentId,
      name: m.name,
      value: m.value,
      unit: m.unit || null,
      tags: m.tags || {},
    }));

    const created = await this.prisma.sentinelMetric.createMany({ data });
    this.logger.log(`[Metrics] Received ${created.count} metrics from agent ${agentId}`);

    // Also update heartbeat
    await this.prisma.sentinelAgent.update({
      where: { id: agentId },
      data: { lastSeenAt: new Date(), status: 'online' },
    }).catch(() => { /* agent may not exist */ });

    // Evaluate alert rules against reported metrics
    for (const m of metrics) {
      await this.evaluateAlertRules(agentId, m.name, m.value);
    }

    return { received: created.count };
  }

  /**
   * Get metrics history for a specific agent and metric name
   */
  async getMetricsHistory(
    agentId: string,
    metricName?: string,
    timeRange?: { start: Date; end: Date },
    limit = 500,
  ) {
    const where: any = { agentId };
    if (metricName) {
      where.name = metricName;
    }
    if (timeRange) {
      where.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    return this.prisma.sentinelMetric.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get latest metric values for an agent (one per metric name)
   */
  async getLatestMetrics(agentId: string) {
    // Get distinct metric names for this agent
    const names = await this.prisma.sentinelMetric.findMany({
      where: { agentId },
      distinct: ['name'],
      select: { name: true },
    });

    const latest = await Promise.all(
      names.map(async ({ name }) => {
        const metric = await this.prisma.sentinelMetric.findFirst({
          where: { agentId, name },
          orderBy: { createdAt: 'desc' },
        });
        return metric;
      }),
    );

    return latest.filter(Boolean);
  }

  // =====================================================================
  // Alert Rules
  // =====================================================================

  /**
   * Create a new alert rule
   */
  async createAlertRule(data: {
    name: string;
    description?: string;
    metricName: string;
    condition: string;
    threshold: number;
    duration?: number;
    severity?: string;
    enabled?: boolean;
    actions?: any[];
    cooldown?: number;
  }) {
    return this.prisma.alertRule.create({
      data: {
        name: data.name,
        description: data.description,
        metricName: data.metricName,
        condition: data.condition,
        threshold: data.threshold,
        duration: data.duration ?? 0,
        severity: data.severity ?? 'warning',
        enabled: data.enabled ?? true,
        actions: data.actions ?? [],
        cooldown: data.cooldown ?? 300,
      },
    });
  }

  /**
   * List all alert rules
   */
  async listAlertRules() {
    return this.prisma.alertRule.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { alertHistory: true } } },
    });
  }

  /**
   * Get a single alert rule
   */
  async getAlertRule(id: string) {
    return this.prisma.alertRule.findUnique({
      where: { id },
      include: { _count: { select: { alertHistory: true } } },
    });
  }

  /**
   * Update an alert rule
   */
  async updateAlertRule(id: string, data: {
    name?: string;
    description?: string;
    metricName?: string;
    condition?: string;
    threshold?: number;
    duration?: number;
    severity?: string;
    enabled?: boolean;
    actions?: any[];
    cooldown?: number;
  }) {
    return this.prisma.alertRule.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete an alert rule
   */
  async deleteAlertRule(id: string) {
    return this.prisma.alertRule.delete({
      where: { id },
    });
  }

  // =====================================================================
  // Alert Evaluation & Triggering
  // =====================================================================

  /**
   * Evaluate all enabled alert rules against a reported metric
   */
  private async evaluateAlertRules(agentId: string, metricName: string, metricValue: number) {
    const rules = await this.prisma.alertRule.findMany({
      where: {
        metricName,
        enabled: true,
      },
    });

    for (const rule of rules) {
      const triggered = evaluateCondition(metricValue, rule.condition, rule.threshold);
      if (!triggered) continue;

      // Check cooldown
      if (rule.lastFiredAt) {
        const elapsed = (Date.now() - rule.lastFiredAt.getTime()) / 1000;
        if (elapsed < rule.cooldown) {
          this.logger.debug(`[Alert] Rule "${rule.name}" skipped (cooldown: ${Math.round(rule.cooldown - elapsed)}s remaining)`);
          continue;
        }
      }

      await this.triggerAlert(rule, agentId, metricName, metricValue);
    }
  }

  /**
   * Trigger an alert: create history record + execute actions
   */
  private async triggerAlert(
    rule: any,
    agentId: string,
    metricName: string,
    metricValue: number,
  ) {
    const message = `[${rule.severity.toUpperCase()}] "${rule.name}": ${metricName} = ${metricValue} ${conditionLabel(rule.condition)} ${rule.threshold}`;
    this.logger.warn(`[Alert] ${message} (agent: ${agentId})`);

    // Create alert history
    const alert = await this.prisma.alertHistory.create({
      data: {
        ruleId: rule.id,
        agentId,
        severity: rule.severity,
        metricName,
        metricValue,
        threshold: rule.threshold,
        condition: rule.condition,
        message,
        status: 'firing',
      },
    });

    // Update rule lastFiredAt
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastFiredAt: new Date() },
    });

    // Execute alert actions
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    for (const action of actions) {
      await this.executeAlertAction(action, rule, alert, agentId, metricName, metricValue);
    }
  }

  /**
   * Execute a single alert action
   */
  private async executeAlertAction(
    action: any,
    rule: any,
    alert: any,
    agentId: string,
    metricName: string,
    metricValue: number,
  ) {
    try {
      switch (action.type) {
        case 'email':
          if (this.emailService && action.to) {
            await this.emailService.sendAlertNotification(
              action.to,
              rule.severity,
              alert.message,
              {
                ruleName: rule.name,
                agentId,
                metricName,
                metricValue,
                threshold: rule.threshold,
                condition: conditionLabel(rule.condition),
              },
            );
            this.logger.log(`[Alert Action] Email sent to ${action.to}`);
          }
          break;

        case 'webhook':
          if (action.url) {
            await axios.post(action.url, {
              alertId: alert.id,
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              agentId,
              metricName,
              metricValue,
              threshold: rule.threshold,
              message: alert.message,
              timestamp: new Date().toISOString(),
            }, { timeout: 10000 }).catch((err: Error) => {
              this.logger.warn(`[Alert Action] Webhook failed: ${err.message}`);
            });
            this.logger.log(`[Alert Action] Webhook sent to ${action.url}`);
          }
          break;

        default:
          this.logger.warn(`[Alert Action] Unknown action type: ${action.type}`);
      }
    } catch (error) {
      this.logger.error(`[Alert Action] Failed: ${(error as Error).message}`);
    }
  }

  // =====================================================================
  // Alert History
  // =====================================================================

  /**
   * List alert history with pagination
   */
  async listAlertHistory(params?: {
    agentId?: string;
    ruleId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params?.agentId) where.agentId = params.agentId;
    if (params?.ruleId) where.ruleId = params.ruleId;
    if (params?.severity) where.severity = params.severity;
    if (params?.status) where.status = params.status;

    const [items, total] = await Promise.all([
      this.prisma.alertHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit ?? 50,
        skip: params?.offset ?? 0,
        include: {
          rule: { select: { name: true } },
          agent: { select: { name: true, hostname: true } },
        },
      }),
      this.prisma.alertHistory.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(id: string) {
    return this.prisma.alertHistory.update({
      where: { id },
      data: { status: 'acknowledged' },
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(id: string) {
    return this.prisma.alertHistory.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }
}
