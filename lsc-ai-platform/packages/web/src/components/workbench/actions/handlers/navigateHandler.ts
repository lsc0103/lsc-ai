/**
 * Navigate 动作处理器
 *
 * 处理 type: 'navigate' 的动作
 * 页面导航
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import { parseTemplate } from '../templateParser';

/**
 * Navigate 动作处理器
 */
export class NavigateActionHandler implements IActionHandler {
  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'navigate') {
      return {
        success: false,
        error: '动作类型不是 navigate',
      };
    }

    // 验证路径
    if (!action.path) {
      return {
        success: false,
        error: 'navigate 动作缺少 path 参数',
      };
    }

    // 解析路径中的模板变量
    const path = parseTemplate(action.path, context);

    console.log('[NavigateHandler] 导航到:', path);

    try {
      // 判断是内部路由还是外部链接
      const isExternal = path.startsWith('http://') || path.startsWith('https://');

      if (isExternal) {
        // 外部链接：在新窗口打开
        window.open(path, '_blank', 'noopener,noreferrer');
      } else {
        // 内部路由：使用 history API
        // 注意：这里使用简单的 pushState，实际项目中应该使用 React Router
        window.history.pushState(null, '', path);
        // 触发 popstate 事件以便 React Router 响应
        window.dispatchEvent(new PopStateEvent('popstate'));
      }

      return {
        success: true,
        data: { path, isExternal },
      };
    } catch (error) {
      console.error('[NavigateHandler] 导航失败:', error);
      return {
        success: false,
        error: `导航失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 创建 Navigate 处理器实例
 */
export const navigateHandler = new NavigateActionHandler();
