import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    return role;
  }

  async create(data: {
    code: string;
    name: string;
    description?: string;
    permissions?: string[];
  }) {
    const existing = await this.prisma.role.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException('角色编码已存在');
    }

    return this.prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        permissions: data.permissions ?? [],
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      permissions?: string[];
    },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;

    return this.prisma.role.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    if (role.isSystem) {
      throw new BadRequestException('系统角色不可删除');
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: '角色已删除' };
  }
}
