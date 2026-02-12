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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserService } from './user.service.js';

@ApiTags('用户管理')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: '获取当前用户资料' })
  async getProfile(@Request() req: any) {
    return this.userService.findById(req.user.id);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '用户列表（管理员）' })
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.userService.findAll({
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Patch('change-password')
  @ApiOperation({ summary: '修改密码' })
  async changePassword(
    @Request() req: any,
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
    },
  ) {
    return this.userService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Get(':id')
  @ApiOperation({ summary: '用户详情' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user.roles?.includes('admin');
    if (!isAdmin && id !== req.user.id) {
      throw new ForbiddenException('无权查看该用户信息');
    }
    return this.userService.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '创建用户（管理员）' })
  async create(
    @Body()
    body: {
      username: string;
      password: string;
      email?: string;
      displayName?: string;
      status?: string;
      roleIds?: string[];
    },
  ) {
    return this.userService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: {
      displayName?: string;
      email?: string;
      status?: string;
      password?: string;
    },
  ) {
    const isAdmin = req.user.roles?.includes('admin');
    if (!isAdmin && id !== req.user.id) {
      throw new ForbiddenException('只能修改自己的信息');
    }
    // 非管理员不允许修改 status
    if (!isAdmin) {
      delete body.status;
    }
    return this.userService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: '删除用户（管理员）' })
  async remove(@Param('id') id: string, @Request() req: any) {
    if (req.user.id === id) {
      throw new ForbiddenException('不能删除自己');
    }
    return this.userService.delete(id);
  }

  @Patch(':id/roles')
  @Roles('admin')
  @ApiOperation({ summary: '分配角色（管理员）' })
  async assignRoles(
    @Param('id') id: string,
    @Body() body: { roleIds: string[] },
  ) {
    return this.userService.assignRoles(id, body.roleIds);
  }
}
