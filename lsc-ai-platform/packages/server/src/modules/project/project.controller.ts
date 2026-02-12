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
    @Body() body: { name: string; description?: string; workingDir?: string },
  ) {
    return this.projectService.create(req.user.id, body.name, body.description, body.workingDir);
  }

  @Get()
  @ApiOperation({ summary: '获取用户项目列表' })
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.projectService.findByUser(req.user.id, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.projectService.findById(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新项目' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { name?: string; description?: string; workingDir?: string },
  ) {
    return this.projectService.update(id, req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.projectService.delete(id, req.user.id);
  }
}
