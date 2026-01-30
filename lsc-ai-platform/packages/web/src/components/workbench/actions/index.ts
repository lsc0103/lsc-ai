/**
 * Workbench Actions 模块
 *
 * 统一导出 ActionHandler 系统的所有组件
 */

// 核心模块
export { ActionHandler, useActionHandler } from './ActionHandler';

// 类型定义
export type {
  ActionContext,
  ActionResult,
  IActionHandler,
  ChatActionParams,
  ExportActionParams,
  ApiActionParams,
  UpdateActionParams,
  NavigateActionParams,
  CustomActionParams,
} from './types';

// 模板解析器
export { parseTemplate, parseObjectTemplates, hasTemplateVariables, extractVariableNames } from './templateParser';

// 各类型处理器（用于扩展或自定义）
export { chatHandler } from './handlers/chatHandler';
export { exportHandler } from './handlers/exportHandler';
export { apiHandler } from './handlers/apiHandler';
export { updateHandler } from './handlers/updateHandler';
export { navigateHandler } from './handlers/navigateHandler';
export { customHandler, type CustomHandlerFunction } from './handlers/customHandler';
export { shellHandler } from './handlers/shellHandler';
