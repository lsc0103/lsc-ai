import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RoleService } from './role.service.js';

@ApiTags('角色管理')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: '角色列表' })
  async findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '角色详情' })
  async findOne(@Param('id') id: string) {
    return this.roleService.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '创建角色（管理员）' })
  async create(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
      permissions?: string[];
    },
  ) {
    return this.roleService.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新角色（管理员）' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      permissions?: string[];
    },
  ) {
    return this.roleService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: '删除角色（管理员）' })
  async remove(@Param('id') id: string) {
    return this.roleService.delete(id);
  }
}
