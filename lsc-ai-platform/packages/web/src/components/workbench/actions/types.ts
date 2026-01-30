/**
 * Workbench Action 类型定义
 *
 * 定义所有可执行的动作类型和参数
 */

import type { WorkbenchAction } from '../schema/types';

// ============================================================================
// 动作执行上下文
// ============================================================================

/**
 * 动作执行上下文
 * 包含执行动作所需的所有信息
 */
export interface ActionContext {
  /** 触发动作的组件 ID */
  sourceComponentId?: string;
  /** 触发动作的组件类型 */
  sourceComponentType?: string;
  /** 动态数据（如选中的行数据） */
  data?: Record<string, unknown>;
  /** 当前会话 ID */
  sessionId?: string;
  /** 组件数据映射（用于模板变量解析） */
  componentData?: Record<string, unknown>;
  /** 当前 Schema */
  schema?: unknown;
}

// ============================================================================
// 动作执行结果
// ============================================================================

/**
 * 动作执行结果
 */
export interface ActionResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
  /** 是否需要刷新 Workbench */
  shouldRefresh?: boolean;
}

// ============================================================================
// 各类型动作的详细参数
// ============================================================================

/**
 * Chat 动作参数
 * 发送消息到 AI 对话
 */
export interface ChatActionParams {
  /** 发送的消息内容（支持模板变量） */
  message: string;
  /** 是否等待 AI 响应完成 */
  waitForResponse?: boolean;
}

/**
 * API 动作参数
 * 调用后端 API
 */
export interface ApiActionParams {
  /** API 端点 */
  endpoint: string;
  /** 请求方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 请求参数 */
  params?: Record<string, unknown>;
  /** 请求头 */
  headers?: Record<string, string>;
}

/**
 * Export 动作参数
 * 导出文件
 */
export interface ExportActionParams {
  /** 导出格式 */
  format: 'excel' | 'csv' | 'pdf' | 'json' | 'png' | 'svg';
  /** 文件名（不含扩展名） */
  filename: string;
  /** 要导出的数据 */
  data?: unknown;
  /** 数据源组件 ID（从该组件获取数据） */
  dataSourceId?: string;
}

/**
 * Update 动作参数
 * 更新组件数据
 */
export interface UpdateActionParams {
  /** 目标组件 ID */
  targetId: string;
  /** 更新的数据 */
  data: unknown;
  /** 是否合并数据（默认替换） */
  merge?: boolean;
}

/**
 * Navigate 动作参数
 * 页面导航
 */
export interface NavigateActionParams {
  /** 目标路径 */
  path: string;
  /** 是否在新窗口打开 */
  newWindow?: boolean;
  /** URL 参数 */
  query?: Record<string, string>;
}

/**
 * Custom 动作参数
 * 自定义动作
 */
export interface CustomActionParams {
  /** 处理器名称 */
  handler: string;
  /** 自定义参数 */
  params?: Record<string, unknown>;
}

// ============================================================================
// 动作处理器接口
// ============================================================================

/**
 * 动作处理器接口
 */
export interface IActionHandler {
  /** 处理动作 */
  handle(action: WorkbenchAction, context: ActionContext): Promise<ActionResult>;
}

/**
 * 动作处理器注册表
 */
export type ActionHandlerRegistry = {
  chat: IActionHandler;
  api: IActionHandler;
  export: IActionHandler;
  update: IActionHandler;
  navigate: IActionHandler;
  custom: IActionHandler;
};

// ============================================================================
// 模板变量解析
// ============================================================================

/**
 * 模板变量定义
 * 用于在动作参数中引用动态数据
 *
 * 示例：
 * - ${selectedRows} - 表格选中的行数据
 * - ${formValues} - 表单当前值
 * - ${componentData.chart-1} - 指定组件的数据
 */
export type TemplateVariable =
  | '${selectedRows}'
  | '${selectedRow}'
  | '${formValues}'
  | '${currentTab}'
  | `\${componentData.${string}}`;
