import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string, description?: string, workingDir?: string) {
    return this.prisma.project.create({
      data: {
        userId,
        name,
        description,
        workingDir,
      },
    });
  }

  async findByUser(
    userId: string,
    options?: { search?: string; page?: number; pageSize?: number },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (options?.search) {
      where.name = { contains: options.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: {
              sessions: true,
              knowledgeBases: true,
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        knowledgeBases: {
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: {
            sessions: true,
            knowledgeBases: true,
          },
        },
      },
    });
  }

  async update(id: string, data: { name?: string; description?: string; workingDir?: string }) {
    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.project.delete({
      where: { id },
    });
  }
}
