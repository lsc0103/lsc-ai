import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MastraWorkflowService } from '../../services/mastra-workflow.service.js';

@ApiTags('Workflow')
@Controller('workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: MastraWorkflowService,
  ) {}

  // ==================== RPA 流程 ====================

  @Post('rpa')
  @ApiOperation({ summary: '创建 RPA 流程' })
  async createRpaFlow(
    @Request() req: any,
    @Body() body: { name: string; description?: string; flowData: any },
  ) {
    return this.prisma.rpaFlow.create({
      data: {
        userId: req.user.id,
        name: body.name,
        description: body.description,
        flowData: body.flowData,
      },
    });
  }

  @Get('rpa')
  @ApiOperation({ summary: '获取用户 RPA 流程列表' })
  async listRpaFlows(@Request() req: any) {
    return this.prisma.rpaFlow.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('rpa/:id')
  @ApiOperation({ summary: '获取 RPA 流程详情' })
  async getRpaFlow(@Param('id') id: string, @Request() req: any) {
    const flow = await this.prisma.rpaFlow.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!flow) {
      throw new NotFoundException(`RPA flow not found: ${id}`);
    }
    return flow;
  }

  @Patch('rpa/:id')
  @ApiOperation({ summary: '更新 RPA 流程' })
  async updateRpaFlow(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { name?: string; description?: string; flowData?: any; status?: string },
  ) {
    const flow = await this.prisma.rpaFlow.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!flow) {
      throw new NotFoundException(`RPA flow not found: ${id}`);
    }

    return this.prisma.rpaFlow.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.flowData && { flowData: body.flowData }),
        ...(body.status && { status: body.status }),
      },
    });
  }

  @Delete('rpa/:id')
  @ApiOperation({ summary: '删除 RPA 流程' })
  async deleteRpaFlow(@Param('id') id: string, @Request() req: any) {
    const flow = await this.prisma.rpaFlow.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!flow) {
      throw new NotFoundException(`RPA flow not found: ${id}`);
    }

    return this.prisma.rpaFlow.delete({ where: { id } });
  }

  @Post('rpa/:id/execute')
  @ApiOperation({ summary: '执行 RPA 流程' })
  async executeRpaFlow(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body?: { inputData?: Record<string, any> },
  ) {
    return this.workflowService.executeRpaFlow(id, req.user.id, body?.inputData);
  }

  // ==================== 定时任务 ====================

  @Post('tasks')
  @ApiOperation({ summary: '创建定时任务' })
  async createScheduledTask(
    @Request() req: any,
    @Body() body: {
      name: string;
      description?: string;
      cronExpr: string;
      taskType: string;
      taskConfig: any;
    },
  ) {
    if (body.cronExpr.trim().split(/\s+/).length !== 5) {
      throw new BadRequestException('Invalid cron expression: must have exactly 5 fields');
    }

    return this.prisma.scheduledTask.create({
      data: {
        userId: req.user.id,
        name: body.name,
        description: body.description,
        cronExpr: body.cronExpr,
        taskType: body.taskType,
        taskConfig: body.taskConfig,
      },
    });
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取用户定时任务列表' })
  async listScheduledTasks(@Request() req: any) {
    return this.prisma.scheduledTask.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: '获取定时任务详情' })
  async getScheduledTask(@Param('id') id: string, @Request() req: any) {
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, userId: req.user.id },
      include: { taskLogs: { orderBy: { startedAt: 'desc' }, take: 20 } },
    });
    if (!task) {
      throw new NotFoundException(`Scheduled task not found: ${id}`);
    }
    return task;
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: '更新定时任务' })
  async updateScheduledTask(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      name?: string;
      description?: string;
      cronExpr?: string;
      taskConfig?: any;
      status?: string;
    },
  ) {
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!task) {
      throw new NotFoundException(`Scheduled task not found: ${id}`);
    }

    return this.prisma.scheduledTask.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.cronExpr && { cronExpr: body.cronExpr }),
        ...(body.taskConfig && { taskConfig: body.taskConfig }),
        ...(body.status && { status: body.status }),
      },
    });
  }

  @Delete('tasks/:id')
  @ApiOperation({ summary: '删除定时任务' })
  async deleteScheduledTask(@Param('id') id: string, @Request() req: any) {
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!task) {
      throw new NotFoundException(`Scheduled task not found: ${id}`);
    }

    return this.prisma.scheduledTask.delete({ where: { id } });
  }

  @Post('tasks/:id/execute')
  @ApiOperation({ summary: '手动执行定时任务' })
  async executeScheduledTask(@Param('id') id: string) {
    return this.workflowService.executeScheduledTask(id);
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: '取消正在执行的定时任务' })
  async cancelScheduledTask(@Param('id') id: string, @Request() req: any) {
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!task) {
      throw new NotFoundException(`Scheduled task not found: ${id}`);
    }

    const runningLog = await this.prisma.taskLog.findFirst({
      where: { taskId: id, status: 'running' },
      orderBy: { startedAt: 'desc' },
    });

    if (!runningLog) {
      return { message: '没有正在运行的任务' };
    }

    await this.prisma.taskLog.update({
      where: { id: runningLog.id },
      data: {
        status: 'cancelled',
        endedAt: new Date(),
      },
    });

    return { message: '任务已取消', logId: runningLog.id };
  }

  @Get('tasks/:id/logs')
  @ApiOperation({ summary: '获取任务执行日志' })
  async getTaskLogs(@Param('id') id: string, @Request() req: any) {
    // 验证所有权
    const task = await this.prisma.scheduledTask.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!task) return [];

    return this.prisma.taskLog.findMany({
      where: { taskId: id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
}
