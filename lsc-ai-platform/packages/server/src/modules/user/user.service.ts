import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Fields to select when returning user data (excludes password) */
const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  avatar: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        userRoles: {
          include: { role: true },
        },
      },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findAll(options?: { search?: string; page?: number; pageSize?: number }) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (options?.search) {
      where.OR = [
        { username: { contains: options.search, mode: 'insensitive' } },
        { displayName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_SELECT,
          userRoles: {
            include: { role: true },
          },
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(data: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
    status?: string;
    roleIds?: string[];
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        email: data.email,
        displayName: data.displayName,
        status: data.status ?? 'active',
        ...(data.roleIds?.length
          ? {
              userRoles: {
                create: data.roleIds.map((roleId) => ({ roleId })),
              },
            }
          : {}),
      },
      select: {
        ...USER_SELECT,
        userRoles: {
          include: { role: true },
        },
      },
    });

    return user;
  }

  async update(
    id: string,
    data: {
      displayName?: string;
      email?: string;
      status?: string;
      password?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updateData: any = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        ...USER_SELECT,
        userRoles: {
          include: { role: true },
        },
      },
    });
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: '用户已删除' };
  }

  async assignRoles(userId: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // Delete existing roles, then create new ones
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      ...roleIds.map((roleId) =>
        this.prisma.userRole.create({
          data: { userId, roleId },
        }),
      ),
    ]);

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SELECT,
        userRoles: {
          include: { role: true },
        },
      },
    });
  }
}
