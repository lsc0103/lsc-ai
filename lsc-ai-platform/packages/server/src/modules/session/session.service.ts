import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MastraAgentService } from '../../services/mastra-agent.service.js';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastraAgentService: MastraAgentService,
  ) {}

  async create(userId: string, title?: string, projectId?: string) {
    return this.prisma.session.create({
      data: {
        userId,
        title: title || '新对话',
        projectId,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async findById(id: string, userId: string) {
    // 获取会话元数据（不包含消息）
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return null;
    }

    // 从 Mastra Memory 加载消息历史
    const messages = await this.mastraAgentService.getThreadMessages(id, userId);

    // 返回包含消息的会话对象（兼容原有结构）
    return {
      ...session,
      messages: messages.map((msg: any) => ({
        id: msg.id,
        sessionId: id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        updatedAt: msg.createdAt,
      })),
    };
  }

  async updateTitle(id: string, title: string) {
    return this.prisma.session.update({
      where: { id },
      data: { title },
    });
  }

  async delete(id: string) {
    // 同步清理 Mastra Memory 中的线程数据
    await this.mastraAgentService.deleteThread(id);

    return this.prisma.session.delete({
      where: { id },
    });
  }

  /**
   * 保存 Workbench 状态到会话
   */
  async saveWorkbenchState(id: string, workbenchState: any) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { extraData: true, updatedAt: true },
    });

    if (!session) return null;

    const extraData = (session.extraData as Record<string, any>) || {};
    extraData.workbenchState = workbenchState;

    // 使用 $executeRawUnsafe 绕过 Prisma 的 @updatedAt 自动更新
    // 保存 Workbench 状态不应改变会话的排序时间
    await this.prisma.$executeRawUnsafe(
      `UPDATE "sessions" SET "extra_data" = $1::jsonb WHERE "id" = $2`,
      JSON.stringify(extraData),
      id,
    );

    return this.prisma.session.findUnique({ where: { id } });
  }

  /**
   * 获取会话的 Workbench 状态
   */
  async getWorkbenchState(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { extraData: true },
    });

    const extraData = (session?.extraData as Record<string, any>) || {};
    return extraData.workbenchState || null;
  }
}
