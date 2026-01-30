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
import { ProjectService } from './project.service.js';

@ApiTags('Project')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: '创建项目' })
  async create(
    @Request() req: any,
    @Body() body: { name: string; description?: string },
  ) {
    return this.projectService.create(req.user.id, body.name, body.description);
  }

  @Get()
  @ApiOperation({ summary: '获取用户项目列表' })
  async findAll(@Request() req: any) {
    return this.projectService.findByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  async findOne(@Param('id') id: string) {
    return this.projectService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新项目' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.projectService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  async remove(@Param('id') id: string) {
    return this.projectService.delete(id);
  }
}
