import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AgentService } from './agent.service.js';

/**
 * 下发任务请求 DTO
 */
class DispatchTaskDto {
  @ApiProperty({ description: '目标设备 ID' })
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiProperty({ description: '任务类型', enum: ['chat', 'execute', 'file_operation'] })
  @IsString()
  @IsIn(['chat', 'execute', 'file_operation'])
  type!: 'chat' | 'execute' | 'file_operation';

  @ApiProperty({ description: '消息内容', required: false })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({ description: '命令', required: false })
  @IsString()
  @IsOptional()
  command?: string;

  @ApiProperty({ description: '工作目录', required: false })
  @IsString()
  @IsOptional()
  workDir?: string;

  @ApiProperty({ description: '会话 ID', required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

@ApiTags('Agent')
@Controller('agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('pairing-code')
  @ApiOperation({ summary: '生成配对码' })
  async generatePairingCode(@Request() req: any) {
    const code = this.agentService.generatePairingCode(req.user.id);
    return { code, expiresIn: 300 }; // 5分钟
  }

  @Get()
  @ApiOperation({ summary: '获取用户的 Agent 列表' })
  async getAgents(@Request() req: any) {
    return this.agentService.getUserAgents(req.user.id);
  }

  @Post('confirm-pairing')
  @ApiOperation({ summary: '确认配对（用户在浏览器输入配对码）' })
  async confirmPairing(@Request() req: any, @Body() dto: { code: string }) {
    const result = await this.agentService.confirmAgentPairing(dto.code, req.user.id);
    if (!result.success) {
      throw new BadRequestException(result.error);
    }
    return result;
  }

  @Post('dispatch')
  @ApiOperation({ summary: '向 Client Agent 下发任务' })
  @ApiBody({ type: DispatchTaskDto })
  async dispatchTask(@Request() req: any, @Body() dto: DispatchTaskDto) {
    const userId = req.user.id;

    // 验证设备属于当前用户
    const agents = await this.agentService.getUserAgents(userId);
    const targetAgent = agents.find(a => a.deviceId === dto.deviceId);
    if (!targetAgent) {
      throw new BadRequestException('设备未找到或不属于当前用户');
    }

    // 生成任务 ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 构建任务
    const task = {
      taskId,
      sessionId: dto.sessionId || `session_${Date.now()}`,
      userId,
      type: dto.type,
      payload: {
        message: dto.message,
        command: dto.command,
        workDir: dto.workDir,
      },
    };

    // 通过 AgentService 分发任务
    const success = await this.agentService.dispatchTaskToAgent(dto.deviceId, task);

    if (!success) {
      throw new BadRequestException('Agent 不在线或任务下发失败');
    }

    return { taskId, status: 'dispatched' };
  }

  @Delete(':deviceId')
  @ApiOperation({ summary: '解绑 Agent 设备' })
  async unbindAgent(@Request() req: any, @Param('deviceId') deviceId: string) {
    const result = await this.agentService.unbindAgent(deviceId, req.user.id);
    if (!result.success) {
      throw new BadRequestException(result.error);
    }
    return { success: true, message: '设备已解绑' };
  }
}
