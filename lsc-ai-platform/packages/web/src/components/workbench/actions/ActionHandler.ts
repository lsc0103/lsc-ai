/**
 * ActionHandler 核心模块
 *
 * Workbench 事件系统的统一入口
 * 处理所有类型的 WorkbenchAction
 */

import type { WorkbenchAction } from '../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from './types';

// 导入各类型处理器
import { chatHandler } from './handlers/chatHandler';
import { exportHandler } from './handlers/exportHandler';
import { apiHandler } from './handlers/apiHandler';
import { updateHandler } from './handlers/updateHandler';
import { navigateHandler } from './handlers/navigateHandler';
import { customHandler } from './handlers/customHandler';
import { shellHandler } from './handlers/shellHandler';

/**
 * ActionHandler 类
 *
 * 统一管理和分发所有 Workbench 动作
 */
class ActionHandlerClass {
  /** 处理器映射表 */
  private handlers: Map<string, IActionHandler> = new Map();

  /** 动作执行历史（用于调试） */
  private history: Array<{
    timestamp: number;
    action: WorkbenchAction;
    context: ActionContext;
    result: ActionResult;
  }> = [];

  /** 历史记录最大长度 */
  private readonly MAX_HISTORY_LENGTH = 100;

  constructor() {
    // 注册内置处理器
    this.registerHandler('chat', chatHandler);
    this.registerHandler('export', exportHandler);
    this.registerHandler('api', apiHandler);
    this.registerHandler('update', updateHandler);
    this.registerHandler('navigate', navigateHandler);
    this.registerHandler('custom', customHandler);
    this.registerHandler('shell', shellHandler);

    console.log('[ActionHandler] 初始化完成，已注册处理器:', this.getRegisteredTypes());
  }

  /**
   * 注册动作处理器
   */
  registerHandler(type: string, handler: IActionHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * 获取已注册的动作类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 执行动作
   *
   * @param action WorkbenchAction 动作定义
   * @param context 执行上下文
   * @returns 执行结果
   */
  async execute(
    action: WorkbenchAction,
    context: ActionContext = {}
  ): Promise<ActionResult> {
    const startTime = Date.now();

    console.log('[ActionHandler] 执行动作:', {
      type: action.type,
      action,
      context: {
        ...context,
        data: context.data ? '(有数据)' : '(无数据)',
      },
    });

    // 验证动作
    if (!action || !action.type) {
      const result: ActionResult = {
        success: false,
        error: '无效的动作：缺少 type 字段',
      };
      this.recordHistory(action, context, result);
      return result;
    }

    // 获取对应的处理器
    const handler = this.handlers.get(action.type);
    if (!handler) {
      const result: ActionResult = {
        success: false,
        error: `未知的动作类型: ${action.type}。支持的类型: ${this.getRegisteredTypes().join(', ')}`,
      };
      this.recordHistory(action, context, result);
      return result;
    }

    try {
      // 执行动作
      const result = await handler.handle(action, context);

      // 记录历史
      this.recordHistory(action, context, result);

      const duration = Date.now() - startTime;
      console.log(`[ActionHandler] 动作完成 (${duration}ms):`, {
        type: action.type,
        success: result.success,
        error: result.error,
      });

      return result;
    } catch (error) {
      const result: ActionResult = {
        success: false,
        error: `动作执行异常: ${(error as Error).message}`,
      };
      this.recordHistory(action, context, result);

      console.error('[ActionHandler] 动作执行异常:', error);
      return result;
    }
  }

  /**
   * 批量执行动作
   *
   * @param actions 动作列表
   * @param context 共享上下文
   * @param options 选项
   * @returns 所有结果
   */
  async executeAll(
    actions: WorkbenchAction[],
    context: ActionContext = {},
    options: { parallel?: boolean; stopOnError?: boolean } = {}
  ): Promise<ActionResult[]> {
    const { parallel = false, stopOnError = false } = options;

    if (parallel) {
      // 并行执行
      return Promise.all(actions.map((action) => this.execute(action, context)));
    }

    // 顺序执行
    const results: ActionResult[] = [];
    for (const action of actions) {
      const result = await this.execute(action, context);
      results.push(result);

      if (stopOnError && !result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * 记录执行历史
   */
  private recordHistory(
    action: WorkbenchAction,
    context: ActionContext,
    result: ActionResult
  ): void {
    this.history.push({
      timestamp: Date.now(),
      action,
      context,
      result,
    });

    // 限制历史长度
    if (this.history.length > this.MAX_HISTORY_LENGTH) {
      this.history = this.history.slice(-this.MAX_HISTORY_LENGTH);
    }
  }

  /**
   * 获取执行历史
   */
  getHistory(limit?: number): typeof this.history {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.history = [];
  }
}

/**
 * ActionHandler 单例实例
 */
export const ActionHandler = new ActionHandlerClass();

/**
 * React Hook: 使用 ActionHandler
 *
 * 提供便捷的动作执行方法
 */
export function useActionHandler() {
  /**
   * 执行动作
   */
  const execute = async (
    action: WorkbenchAction,
    context?: ActionContext
  ): Promise<ActionResult> => {
    return ActionHandler.execute(action, context);
  };

  /**
   * 发送消息到 AI
   */
  const sendToAI = async (
    message: string,
    data?: Record<string, unknown>
  ): Promise<ActionResult> => {
    return ActionHandler.execute(
      { type: 'chat', message },
      { data }
    );
  };

  /**
   * 导出数据
   */
  const exportData = async (
    format: 'excel' | 'csv' | 'json' | 'pdf',
    data: unknown,
    filename: string
  ): Promise<ActionResult> => {
    return ActionHandler.execute(
      { type: 'export', format, filename },
      { data: { exportData: data } }
    );
  };

  /**
   * 更新组件数据
   */
  const updateComponent = async (
    targetId: string,
    data: unknown
  ): Promise<ActionResult> => {
    return ActionHandler.execute(
      { type: 'update', targetId, data },
      {}
    );
  };

  return {
    execute,
    sendToAI,
    exportData,
    updateComponent,
    handler: ActionHandler,
  };
}

export default ActionHandler;
