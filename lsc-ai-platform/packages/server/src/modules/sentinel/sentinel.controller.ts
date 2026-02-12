import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SentinelService } from './sentinel.service.js';

@ApiTags('Sentinel Agent')
@Controller('sentinel-agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class SentinelController {
  constructor(private readonly sentinelService: SentinelService) {}

  // =====================================================================
  // Agent CRUD
  // =====================================================================

  @Post()
  @ApiOperation({ summary: 'Register a Sentinel Agent' })
  async register(
    @Body() body: {
      name: string;
      hostname: string;
      ipAddress: string;
      platform: string;
      agentVersion: string;
      capabilities?: any;
    },
  ) {
    return this.sentinelService.register(body);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get Sentinel Agents health overview' })
  async getHealthOverview() {
    return this.sentinelService.getHealthOverview();
  }

  @Get()
  @ApiOperation({ summary: 'List all Sentinel Agents' })
  async list() {
    return this.sentinelService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Sentinel Agent detail' })
  async getById(@Param('id') id: string) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }
    return agent;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a Sentinel Agent' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; capabilities?: any; status?: string },
  ) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }
    return this.sentinelService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Sentinel Agent' })
  async remove(@Param('id') id: string) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }
    return this.sentinelService.remove(id);
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Update Sentinel Agent heartbeat' })
  async heartbeat(@Param('id') id: string) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }
    return this.sentinelService.updateHeartbeat(id);
  }

  // =====================================================================
  // Metrics
  // =====================================================================

  @Post(':id/metrics')
  @ApiOperation({ summary: 'Report metrics from a Sentinel Agent' })
  async reportMetrics(
    @Param('id') id: string,
    @Body() body: {
      metrics: Array<{
        name: string;
        value: number;
        unit?: string;
        tags?: Record<string, string>;
      }>;
    },
  ) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }
    if (!body.metrics || !Array.isArray(body.metrics) || body.metrics.length === 0) {
      throw new BadRequestException('metrics array is required and must not be empty');
    }
    return this.sentinelService.reportMetrics(id, body.metrics);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get metrics history for a Sentinel Agent' })
  async getMetrics(
    @Param('id') id: string,
    @Query('name') metricName?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }

    const timeRange = start && end
      ? { start: new Date(start), end: new Date(end) }
      : undefined;

    return this.sentinelService.getMetricsHistory(
      id,
      metricName,
      timeRange,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id/metrics/latest')
  @ApiOperation({ summary: 'Get latest metric values for a Sentinel Agent' })
  async getLatestMetrics(@Param('id') id: string) {
    const agent = await this.sentinelService.getById(id);
    if (!agent) {
      throw new NotFoundException(`Sentinel Agent not found: ${id}`);
    }
    return this.sentinelService.getLatestMetrics(id);
  }

  // =====================================================================
  // Alert Rules
  // =====================================================================

  @Post('alert-rules')
  @ApiOperation({ summary: 'Create an alert rule' })
  async createAlertRule(
    @Body() body: {
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
    },
  ) {
    if (!body.name || !body.metricName || !body.condition || body.threshold === undefined) {
      throw new BadRequestException('name, metricName, condition, and threshold are required');
    }
    const validConditions = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
    if (!validConditions.includes(body.condition)) {
      throw new BadRequestException(`condition must be one of: ${validConditions.join(', ')}`);
    }
    return this.sentinelService.createAlertRule(body);
  }

  @Get('alert-rules')
  @ApiOperation({ summary: 'List all alert rules' })
  async listAlertRules() {
    return this.sentinelService.listAlertRules();
  }

  @Get('alert-rules/:ruleId')
  @ApiOperation({ summary: 'Get an alert rule by ID' })
  async getAlertRule(@Param('ruleId') ruleId: string) {
    const rule = await this.sentinelService.getAlertRule(ruleId);
    if (!rule) {
      throw new NotFoundException(`Alert rule not found: ${ruleId}`);
    }
    return rule;
  }

  @Patch('alert-rules/:ruleId')
  @ApiOperation({ summary: 'Update an alert rule' })
  async updateAlertRule(
    @Param('ruleId') ruleId: string,
    @Body() body: {
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
    },
  ) {
    const rule = await this.sentinelService.getAlertRule(ruleId);
    if (!rule) {
      throw new NotFoundException(`Alert rule not found: ${ruleId}`);
    }
    if (body.condition) {
      const validConditions = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
      if (!validConditions.includes(body.condition)) {
        throw new BadRequestException(`condition must be one of: ${validConditions.join(', ')}`);
      }
    }
    return this.sentinelService.updateAlertRule(ruleId, body);
  }

  @Delete('alert-rules/:ruleId')
  @ApiOperation({ summary: 'Delete an alert rule' })
  async deleteAlertRule(@Param('ruleId') ruleId: string) {
    const rule = await this.sentinelService.getAlertRule(ruleId);
    if (!rule) {
      throw new NotFoundException(`Alert rule not found: ${ruleId}`);
    }
    return this.sentinelService.deleteAlertRule(ruleId);
  }

  // =====================================================================
  // Alert History
  // =====================================================================

  @Get('alerts')
  @ApiOperation({ summary: 'List alert history' })
  async listAlerts(
    @Query('agentId') agentId?: string,
    @Query('ruleId') ruleId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sentinelService.listAlertHistory({
      agentId,
      ruleId,
      severity,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Patch('alerts/:alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledgeAlert(@Param('alertId') alertId: string) {
    return this.sentinelService.acknowledgeAlert(alertId);
  }

  @Patch('alerts/:alertId/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  async resolveAlert(@Param('alertId') alertId: string) {
    return this.sentinelService.resolveAlert(alertId);
  }
}
