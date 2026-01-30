/**
 * Update 动作处理器
 *
 * 处理 type: 'update' 的动作
 * 更新 Workbench 中指定组件的数据
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import { parseObjectTemplates } from '../templateParser';
import { useWorkbenchStore } from '../../context';

/**
 * Update 动作处理器
 */
export class UpdateActionHandler implements IActionHandler {
  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'update') {
      return {
        success: false,
        error: '动作类型不是 update',
      };
    }

    // 验证目标组件 ID
    if (!action.targetId) {
      return {
        success: false,
        error: 'update 动作缺少 targetId 参数',
      };
    }

    // 验证数据
    if (action.data === undefined) {
      return {
        success: false,
        error: 'update 动作缺少 data 参数',
      };
    }

    const targetId = action.targetId;

    // 解析数据中的模板变量
    let data = action.data;
    if (typeof data === 'string') {
      // 如果是字符串引用（如 "${selectedRows}"），需要解析
      const { parseTemplate } = await import('../templateParser');
      const parsed = parseTemplate(data, context);
      try {
        data = JSON.parse(parsed);
      } catch {
        data = parsed;
      }
    } else if (typeof data === 'object' && data !== null) {
      data = parseObjectTemplates(data as Record<string, unknown>, context);
    }

    console.log('[UpdateHandler] 更新组件:', { targetId, data });

    try {
      // 获取 Workbench store
      const workbenchStore = useWorkbenchStore.getState();

      // 更新组件数据
      workbenchStore.updateComponentData(targetId, data);

      return {
        success: true,
        data: { targetId, updated: true },
        shouldRefresh: false, // 数据已直接更新，不需要刷新整个 Workbench
      };
    } catch (error) {
      console.error('[UpdateHandler] 更新组件失败:', error);
      return {
        success: false,
        error: `更新组件失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 创建 Update 处理器实例
 */
export const updateHandler = new UpdateActionHandler();
