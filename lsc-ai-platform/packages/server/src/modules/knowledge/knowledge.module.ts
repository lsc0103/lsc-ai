import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeSearchController } from './knowledge-search.controller.js';
import { RagService } from '../../services/rag.service.js';
import { DocumentPipelineService } from '../../services/document-pipeline.service.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [ChatModule], // 导入 ChatModule 以使用 MastraAgentService（RagService 依赖）
  controllers: [KnowledgeController, KnowledgeSearchController],
  providers: [KnowledgeService, RagService, DocumentPipelineService],
  exports: [KnowledgeService, RagService, DocumentPipelineService],
})
export class KnowledgeModule {}
