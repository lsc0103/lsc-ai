/**
 * Chat 动作处理器
 *
 * 处理 type: 'chat' 的动作
 * 将消息发送到 AI 对话，触发新一轮响应
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import { parseTemplate } from '../templateParser';
import { useChatStore } from '@/stores/chat';

/**
 * Chat 动作处理器
 */
export class ChatActionHandler implements IActionHandler {
  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'chat') {
      return {
        success: false,
        error: '动作类型不是 chat',
      };
    }

    // 验证消息内容
    if (!action.message) {
      return {
        success: false,
        error: 'chat 动作缺少 message 参数',
      };
    }

    try {
      // 解析消息模板
      const message = parseTemplate(action.message, context);

      console.log('[ChatHandler] 发送消息:', message);

      // 获取 chat store
      const chatStore = useChatStore.getState();

      // 检查是否正在加载中
      if (chatStore.isLoading) {
        return {
          success: false,
          error: 'AI 正在响应中，请稍后再试',
        };
      }

      // 使用 setPendingMessage 触发消息发送
      // ChatInput 组件会监听这个值并自动发送
      chatStore.setPendingMessage(message);

      return {
        success: true,
        data: { messageSent: message },
        shouldRefresh: true, // 可能需要刷新 Workbench
      };
    } catch (error) {
      console.error('[ChatHandler] 发送消息失败:', error);
      return {
        success: false,
        error: `发送消息失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 创建 Chat 处理器实例
 */
export const chatHandler = new ChatActionHandler();
