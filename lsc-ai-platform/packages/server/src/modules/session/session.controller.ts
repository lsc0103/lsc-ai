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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SessionService } from './session.service.js';

@ApiTags('Session')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @ApiOperation({ summary: '创建新会话' })
  async create(
    @Request() req: any,
    @Body() body: { title?: string; projectId?: string },
  ) {
    return this.sessionService.create(req.user.id, body.title, body.projectId);
  }

  @Get()
  @ApiOperation({ summary: '获取用户会话列表' })
  async findAll(@Request() req: any) {
    return this.sessionService.findByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取会话详情' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.sessionService.findById(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新会话标题' })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: { title: string }) {
    return this.sessionService.updateTitle(id, req.user.id, body.title);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除会话' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.sessionService.delete(id, req.user.id);
  }

  @Get(':id/workbench')
  @ApiOperation({ summary: '获取会话的 Workbench 状态' })
  async getWorkbenchState(@Param('id') id: string, @Request() req: any) {
    return this.sessionService.getWorkbenchState(id, req.user.id);
  }

  @Patch(':id/workbench')
  @ApiOperation({ summary: '保存会话的 Workbench 状态' })
  async saveWorkbenchState(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { workbenchState: any },
  ) {
    return this.sessionService.saveWorkbenchState(id, req.user.id, body.workbenchState);
  }
}
