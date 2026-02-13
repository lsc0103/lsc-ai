import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service.js';

@Processor('idp-processing')
export class IdpProcessor extends WorkerHost {
  private readonly logger = new Logger(IdpProcessor.name);

  constructor(
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { jobId } = job.data;
    this.logger.log(`开始处理 IDP 批量任务: ${jobId}`);

    await this.prisma.idpJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    try {
      const idpJob = await this.prisma.idpJob.findUnique({ where: { id: jobId } });
      if (!idpJob) throw new Error('任务不存在');

      const results: any[] = [];
      const documentIds = idpJob.documentIds as string[];
      let completed = 0;
      let failed = 0;

      for (const docId of documentIds) {
        try {
          // TODO: 实际场景中应从 MinIO 读取文件
          completed++;
          await this.prisma.idpJob.update({
            where: { id: jobId },
            data: { completedDocuments: completed },
          });
        } catch (error) {
          failed++;
          await this.prisma.idpJob.update({
            where: { id: jobId },
            data: { failedDocuments: failed },
          });
          this.logger.error(`文档处理失败: ${docId}`, (error as Error).stack);
        }
      }

      await this.prisma.idpJob.update({
        where: { id: jobId },
        data: {
          status: failed === documentIds.length ? 'failed' : 'completed',
          completedAt: new Date(),
          results: results as any,
        },
      });

      return { jobId, completed, failed };
    } catch (error) {
      await this.prisma.idpJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: (error as Error).message, completedAt: new Date() },
      });
      throw error;
    }
  }
}
