/**
 * Hook 管理器实现
 * 管理和执行用户定义的 Hooks
 */

import { exec, type ChildProcess } from 'child_process';
import type {
  HookDefinition,
  HookContext,
  HookResult,
  HookConfig,
  HookEvent,
  IHookManager,
} from './types.js';

/**
 * Hook 管理器
 */
export class HookManager implements IHookManager {
  private hooks: Map<string, HookDefinition> = new Map();
  private enabled: boolean = true;
  private defaultTimeout: number = 30000;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  /**
   * 注册 Hook
   */
  register(hook: HookDefinition): void {
    if (!hook.name) {
      throw new Error('Hook 必须有名称');
    }
    if (!hook.event) {
      throw new Error('Hook 必须指定事件类型');
    }
    if (!hook.command) {
      throw new Error('Hook 必须指定命令');
    }

    this.hooks.set(hook.name, {
      enabled: true,
      timeout: this.defaultTimeout,
      background: false,
      ...hook,
    });
  }

  /**
   * 批量注册 Hooks
   */
  registerMany(hooks: HookDefinition[]): void {
    for (const hook of hooks) {
      this.register(hook);
    }
  }

  /**
   * 注销 Hook
   */
  unregister(name: string): void {
    this.hooks.delete(name);
  }

  /**
   * 获取指定事件的 Hooks
   */
  getHooksForEvent(event: HookEvent): HookDefinition[] {
    if (!this.enabled) return [];

    return Array.from(this.hooks.values()).filter(
      hook => hook.enabled !== false && hook.event === event
    );
  }

  /**
   * 触发事件
   */
  async trigger(context: HookContext): Promise<HookResult[]> {
    if (!this.enabled) return [];

    const hooks = this.getHooksForEvent(context.event);
    if (hooks.length === 0) return [];

    // 过滤工具特定的 Hooks
    const filteredHooks = hooks.filter(hook => {
      if (hook.toolFilter && hook.toolFilter.length > 0) {
        const toolName = context.data.toolName as string | undefined;
        if (!toolName) return false;
        return hook.toolFilter.includes(toolName);
      }
      return true;
    });

    if (filteredHooks.length === 0) return [];

    const results: HookResult[] = [];

    for (const hook of filteredHooks) {
      const result = await this.executeHook(hook, context);
      results.push(result);

      // 如果 Hook 执行失败且返回了 blocked，停止后续 Hooks
      if (result.blocked) {
        break;
      }
    }

    return results;
  }

  /**
   * 执行单个 Hook
   */
  private async executeHook(hook: HookDefinition, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    // 准备环境变量
    const env: Record<string, string | undefined> = {
      ...process.env,
      HOOK_EVENT: context.event,
      HOOK_NAME: hook.name,
      HOOK_TIMESTAMP: context.timestamp.toString(),
      HOOK_CWD: context.cwd,
      // 事件数据作为 JSON
      HOOK_DATA: JSON.stringify(context.data),
    };

    // 为工具事件添加额外变量
    if (context.event.startsWith('tool:')) {
      env.HOOK_TOOL_NAME = (context.data.toolName as string) || '';
      env.HOOK_TOOL_ARGS = JSON.stringify(context.data.args || {});
      if (context.data.result !== undefined) {
        env.HOOK_TOOL_RESULT = JSON.stringify(context.data.result);
      }
    }

    // 为消息事件添加额外变量
    if (context.event.startsWith('message:')) {
      env.HOOK_MESSAGE_ROLE = (context.data.role as string) || '';
      env.HOOK_MESSAGE_CONTENT = (context.data.content as string) || '';
    }

    return new Promise<HookResult>((resolve) => {
      const timeout = hook.timeout || this.defaultTimeout;
      const cwd = hook.cwd || context.cwd;

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = exec(hook.command, {
        cwd,
        env,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
      });

      this.runningProcesses.set(hook.name, child);

      child.stdout?.on('data', (data) => {
        stdout += data;
      });

      child.stderr?.on('data', (data) => {
        stderr += data;
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        this.runningProcesses.delete(hook.name);

        const duration = Date.now() - startTime;

        // 检查是否是阻塞信号
        // 约定：退出码 42 表示阻塞，stderr 包含阻塞消息
        const blocked = code === 42;
        const blockMessage = blocked ? stderr.trim() : undefined;

        resolve({
          name: hook.name,
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          blocked,
          blockMessage,
          duration,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        this.runningProcesses.delete(hook.name);

        resolve({
          name: hook.name,
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: null,
          duration: Date.now() - startTime,
        });
      });

      // 后台运行：不等待完成
      if (hook.background) {
        child.unref();
        resolve({
          name: hook.name,
          success: true,
          stdout: '[后台运行]',
          stderr: '',
          exitCode: null,
          duration: 0,
        });
      }
    });
  }

  /**
   * 加载配置
   */
  loadConfig(config: HookConfig): void {
    this.enabled = config.enabled;
    if (config.defaultTimeout) {
      this.defaultTimeout = config.defaultTimeout;
    }

    // 清空现有 Hooks
    this.hooks.clear();

    // 注册新 Hooks
    for (const hook of config.hooks) {
      this.register(hook);
    }
  }

  /**
   * 启用/禁用 Hook
   */
  setEnabled(name: string, enabled: boolean): void {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = enabled;
    }
  }

  /**
   * 启用/禁用整个 Hook 系统
   */
  setGlobalEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 获取所有 Hooks
   */
  list(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }

  /**
   * 获取指定 Hook
   */
  get(name: string): HookDefinition | undefined {
    return this.hooks.get(name);
  }

  /**
   * 取消所有正在运行的 Hooks
   */
  cancelAll(): void {
    for (const [name, process] of this.runningProcesses) {
      process.kill('SIGTERM');
      this.runningProcesses.delete(name);
    }
  }

  /**
   * 获取正在运行的 Hooks
   */
  getRunning(): string[] {
    return Array.from(this.runningProcesses.keys());
  }
}

// 全局 Hook 管理器实例
export const hookManager = new HookManager();

/**
 * 创建 Hook 上下文
 */
export function createHookContext(
  event: HookEvent,
  data: Record<string, unknown>,
  cwd?: string
): HookContext {
  return {
    event,
    data,
    cwd: cwd || process.cwd(),
    timestamp: Date.now(),
  };
}
