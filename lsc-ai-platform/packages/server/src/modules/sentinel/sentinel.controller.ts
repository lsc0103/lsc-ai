import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
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
}
