import { Injectable } from '@nestjs/common';

/**
 * @deprecated 已迁移到 Mastra Agent，通过 WebSocket chat:message 处理
 * 消息存储由 Mastra Memory 自动管理，无需手动保存到 PostgreSQL
 */
@Injectable()
export class ChatService {
  async chat(_sessionId: string, _message: string, _userId: string) {
    return { response: '请使用 WebSocket 接口进行对话' };
  }
}
