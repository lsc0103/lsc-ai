/**
 * Hooks 系统类型定义
 * 允许用户在特定事件发生时执行自定义命令
 */

/**
 * Hook 事件类型
 */
export type HookEvent =
  | 'agent:start'       // Agent 开始处理
  | 'agent:end'         // Agent 完成处理
  | 'agent:error'       // Agent 发生错误
  | 'tool:before'       // 工具调用前
  | 'tool:after'        // 工具调用后
  | 'tool:error'        // 工具调用错误
  | 'message:user'      // 用户消息
  | 'message:assistant' // 助手消息
  | 'session:start'     // 会话开始
  | 'session:end'       // 会话结束
  | 'prompt:submit';    // 用户提交输入

/**
 * Hook 定义
 */
export interface HookDefinition {
  /** Hook 名称 */
  name: string;
  /** 触发事件 */
  event: HookEvent;
  /** 要执行的 Shell 命令 */
  command: string;
  /** 工作目录（可选） */
  cwd?: string;
  /** 超时时间（毫秒，默认 30000） */
  timeout?: number;
  /** 是否在后台运行（不阻塞） */
  background?: boolean;
  /** 过滤条件：只对特定工具触发（event 为 tool:* 时有效） */
  toolFilter?: string[];
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * Hook 执行上下文
 */
export interface HookContext {
  /** 事件类型 */
  event: HookEvent;
  /** 事件数据 */
  data: Record<string, unknown>;
  /** 工作目录 */
  cwd: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * Hook 执行结果
 */
export interface HookResult {
  /** Hook 名称 */
  name: string;
  /** 是否成功 */
  success: boolean;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number | null;
  /** 是否被用户中断 */
  blocked?: boolean;
  /** 中断消息 */
  blockMessage?: string;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * Hook 配置
 */
export interface HookConfig {
  /** 是否启用 Hooks */
  enabled: boolean;
  /** Hook 定义列表 */
  hooks: HookDefinition[];
  /** 全局超时时间（毫秒） */
  defaultTimeout?: number;
}

/**
 * Hook 管理器接口
 */
export interface IHookManager {
  /** 注册 Hook */
  register(hook: HookDefinition): void;
  /** 注销 Hook */
  unregister(name: string): void;
  /** 触发事件 */
  trigger(context: HookContext): Promise<HookResult[]>;
  /** 获取指定事件的 Hooks */
  getHooksForEvent(event: HookEvent): HookDefinition[];
  /** 加载配置 */
  loadConfig(config: HookConfig): void;
  /** 启用/禁用 Hook */
  setEnabled(name: string, enabled: boolean): void;
}
