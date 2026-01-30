/**
 * Custom 动作处理器
 *
 * 处理 type: 'custom' 的动作
 * 支持注册自定义处理函数
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import { parseObjectTemplates } from '../templateParser';

/**
 * 自定义处理函数类型
 */
export type CustomHandlerFunction = (
  params: Record<string, unknown>,
  context: ActionContext
) => Promise<ActionResult> | ActionResult;

/**
 * Custom 动作处理器
 */
export class CustomActionHandler implements IActionHandler {
  /** 已注册的自定义处理器 */
  private handlers: Map<string, CustomHandlerFunction> = new Map();

  /**
   * 注册自定义处理器
   * @param name 处理器名称
   * @param handler 处理函数
   */
  register(name: string, handler: CustomHandlerFunction): void {
    this.handlers.set(name, handler);
    console.log(`[CustomHandler] 注册处理器: ${name}`);
  }

  /**
   * 取消注册处理器
   * @param name 处理器名称
   */
  unregister(name: string): void {
    this.handlers.delete(name);
  }

  /**
   * 检查处理器是否已注册
   * @param name 处理器名称
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * 获取所有已注册的处理器名称
   */
  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'custom') {
      return {
        success: false,
        error: '动作类型不是 custom',
      };
    }

    // 验证处理器名称
    if (!action.handler) {
      return {
        success: false,
        error: 'custom 动作缺少 handler 参数',
      };
    }

    const handlerName = action.handler;
    const handler = this.handlers.get(handlerName);

    if (!handler) {
      return {
        success: false,
        error: `未找到自定义处理器: ${handlerName}。已注册: ${this.getRegisteredHandlers().join(', ')}`,
      };
    }

    console.log('[CustomHandler] 执行自定义处理器:', handlerName);

    try {
      // 解析参数中的模板变量
      const params = action.params
        ? parseObjectTemplates(action.params as Record<string, unknown>, context)
        : {};

      // 执行自定义处理器
      const result = await handler(params, context);
      return result;
    } catch (error) {
      console.error('[CustomHandler] 执行失败:', error);
      return {
        success: false,
        error: `自定义处理器执行失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 创建 Custom 处理器实例（单例）
 */
export const customHandler = new CustomActionHandler();

// ============================================================================
// 预置的自定义处理器
// ============================================================================

/**
 * 复制到剪贴板
 */
customHandler.register('copyToClipboard', async (params) => {
  const text = params.text as string;
  if (!text) {
    return { success: false, error: '缺少 text 参数' };
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true, data: { copied: text.slice(0, 100) } };
  } catch (error) {
    return { success: false, error: '复制失败' };
  }
});

/**
 * 显示通知
 */
customHandler.register('showNotification', async (params) => {
  const { message, type = 'info' } = params as { message: string; type?: string };

  if (!message) {
    return { success: false, error: '缺少 message 参数' };
  }

  // 使用 antd 的 message 组件（如果可用）
  try {
    const { message: antdMessage } = await import('antd');
    switch (type) {
      case 'success':
        antdMessage.success(message);
        break;
      case 'error':
        antdMessage.error(message);
        break;
      case 'warning':
        antdMessage.warning(message);
        break;
      default:
        antdMessage.info(message);
    }
    return { success: true };
  } catch {
    // 降级为 alert
    alert(message);
    return { success: true };
  }
});

/**
 * 打印内容
 */
customHandler.register('print', async () => {
  window.print();
  return { success: true };
});

/**
 * 刷新 Workbench
 */
customHandler.register('refreshWorkbench', async (params) => {
  // 触发 Workbench 刷新
  const event = new CustomEvent('workbench:refresh', { detail: params });
  window.dispatchEvent(event);
  return { success: true, shouldRefresh: true };
});
