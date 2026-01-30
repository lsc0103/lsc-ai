/**
 * Shell 动作处理器
 *
 * 处理 type: 'shell' 的动作
 * 通过 Client Agent 执行 shell 命令
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import { parseTemplate } from '../templateParser';
import { useAgentStore } from '../../../../stores/agent';
import { agentApi } from '../../../../services/api';
import { useChatStore } from '../../../../stores/chat';
import { useTerminalStore } from '../../context/TerminalStore';
import { message } from 'antd';

/**
 * Shell 动作处理器
 */
export class ShellActionHandler implements IActionHandler {
  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'shell') {
      return {
        success: false,
        error: '动作类型不是 shell',
      };
    }

    // 验证命令
    const command = (action as any).command;
    if (!command) {
      return {
        success: false,
        error: 'shell 动作缺少 command 参数',
      };
    }

    // 解析命令中的模板变量
    const parsedCommand = parseTemplate(command, context);

    console.log('[ShellHandler] 执行命令:', parsedCommand);

    try {
      // 获取当前连接的 Agent
      const { currentDeviceId, workDir, isConnected } = useAgentStore.getState();

      if (!currentDeviceId) {
        message.warning('未连接 Client Agent，无法执行命令');
        return {
          success: false,
          error: '未连接 Client Agent',
        };
      }

      if (!isConnected) {
        message.warning('Client Agent 离线，无法执行命令');
        return {
          success: false,
          error: 'Client Agent 离线',
        };
      }

      // 获取当前会话 ID
      const { currentSessionId } = useChatStore.getState();

      // 通过 API 下发命令到 Client Agent
      const response = await agentApi.dispatch({
        deviceId: currentDeviceId,
        type: 'execute',
        command: parsedCommand,
        workDir: workDir || undefined,
        sessionId: currentSessionId || undefined,
      });

      if (response.data.status === 'dispatched' || response.data.status === 'pending') {
        const taskId = response.data.taskId;

        // 添加命令到终端 store（用 taskId 作为 ID）
        useTerminalStore.getState().addCommand(taskId, parsedCommand);

        message.success(`命令已下发: ${parsedCommand}`);
        return {
          success: true,
          data: {
            taskId,
            command: parsedCommand,
          },
        };
      } else {
        return {
          success: false,
          error: `命令下发失败: ${response.data.status}`,
        };
      }
    } catch (error) {
      console.error('[ShellHandler] 执行命令失败:', error);
      const errorMessage = (error as Error).message || '执行命令失败';
      message.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

/**
 * 创建 Shell 处理器实例
 */
export const shellHandler = new ShellActionHandler();
