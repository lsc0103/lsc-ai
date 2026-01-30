import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string, description?: string) {
    return this.prisma.project.create({
      data: {
        userId,
        name,
        description,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async update(id: string, data: { name?: string; description?: string }) {
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
