/**
 * 工具国际化支持
 * 为各种工具提供多语言界面和提示
 */

import { t, format, createTranslationContext } from './utils.js';
import type { AskUserOption, AskUserQuestion } from '../tools/askUser.js';

/**
 * 国际化工具上下文
 */
export const toolsI18n = createTranslationContext('tools');

/**
 * 国际化AskUser工具
 */
export function createI18nAskUserQuestion(
  question: string,
  options?: {
    header?: string;
    options?: AskUserOption[];
    multiSelect?: boolean;
    allowFreeText?: boolean;
    params?: Record<string, string | number>;
  }
): AskUserQuestion {
  const {
    header,
    options: rawOptions = [],
    multiSelect = false,
    allowFreeText = true,
    params = {},
  } = options || {};

  // 国际化问题文本
  const i18nQuestion = format(question, params);

  // 国际化选项
  const i18nOptions = rawOptions.map(opt => ({
    ...opt,
    label: t(opt.label, { defaultValue: opt.label, params }),
    description: opt.description ? t(opt.description, { defaultValue: opt.description, params }) : undefined,
  }));

  return {
    question: i18nQuestion,
    header: header ? t(header, { defaultValue: header, params }) : undefined,
    options: i18nOptions.length > 0 ? i18nOptions : undefined,
    multiSelect,
    allowFreeText,
  };
}

/**
 * 工具错误消息国际化
 */
export function i18nToolError(toolName: string, error: string, params?: Record<string, string | number>): string {
  const key = `errors.${toolName}_${error.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, { ...params, tool: toolName });
  }

  // 回退到通用错误消息
  return t('errors.unknown_error', {
    defaultValue: `工具 ${toolName} 执行失败: ${error}`,
    params: { tool: toolName, error, ...params },
  });
}

/**
 * 工具确认消息国际化
 */
export function i18nToolConfirmation(
  toolName: string,
  action: string,
  details?: Record<string, string | number>
): string {
  const key = `tools.confirm_${toolName}_${action.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, details || {});
  }

  // 通用确认消息
  return t('prompts.confirm_action', {
    defaultValue: `确定要执行 ${toolName}: ${action} 吗？`,
    params: { tool: toolName, action, ...details },
  });
}

/**
 * 工具成功消息国际化
 */
export function i18nToolSuccess(
  toolName: string,
  action: string,
  details?: Record<string, string | number>
): string {
  const key = `tools.success_${toolName}_${action.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, details || {});
  }

  // 通用成功消息
  return t('prompts.operation_completed', {
    defaultValue: `${toolName}: ${action} 操作完成`,
    params: { tool: toolName, action, ...details },
  });
}

/**
 * 文件操作国际化
 */
export const fileI18n = {
  read: (filePath: string) => t('tools.read_file', { params: { file: filePath } }),
  write: (filePath: string) => t('tools.write_file', { params: { file: filePath } }),
  edit: (filePath: string) => t('tools.edit_file', { params: { file: filePath } }),
  create: (filePath: string) => t('tools.create_file', { params: { file: filePath } }),
  delete: (filePath: string) => t('tools.delete_file', { params: { file: filePath } }),
  search: (pattern: string) => t('tools.search_files', { params: { pattern } }),
};

/**
 * 命令执行国际化
 */
export const commandI18n = {
  execute: (command: string) => t('tools.execute_command', { params: { command } }),
  running: (command: string) => t('agent.processing', { params: { command } }),
  completed: (command: string, exitCode: number) =>
    t('prompts.operation_completed', {
      params: { command, exitCode },
      defaultValue: `命令执行完成: ${command} (退出码: ${exitCode})`,
    }),
  failed: (command: string, error: string) =>
    t('errors.command_failed', {
      params: { command, error },
      defaultValue: `命令执行失败: ${command} - ${error}`,
    }),
};

/**
 * Git操作国际化
 */
export const gitI18n = {
  status: () => t('tools.git_operations', { params: { operation: 'status' } }),
  diff: () => t('tools.git_operations', { params: { operation: 'diff' } }),
  log: () => t('tools.git_operations', { params: { operation: 'log' } }),
  add: (files: string[]) => t('tools.git_operations', {
    params: { operation: 'add', files: files.join(', ') },
  }),
  commit: (message: string) => t('tools.git_operations', {
    params: { operation: 'commit', message },
  }),
  branch: (name: string) => t('tools.git_operations', {
    params: { operation: 'branch', name },
  }),
};

/**
 * 数据库操作国际化
 */
export const databaseI18n = {
  query: (sql: string) => t('tools.database_operations', { params: { operation: 'query', sql } }),
  config: () => t('tools.database_operations', { params: { operation: 'config' } }),
  connect: (database: string) => t('tools.database_operations', {
    params: { operation: 'connect', database },
  }),
};

/**
 * 网络操作国际化
 */
export const networkI18n = {
  search: (query: string) => t('tools.network_operations', { params: { operation: 'search', query } }),
  fetch: (url: string) => t('tools.network_operations', { params: { operation: 'fetch', url } }),
};

/**
 * 权限相关国际化
 */
export const permissionI18n = {
  required: (tool: string) => t('tools.permission_required', { params: { tool } }),
  granted: (tool: string) => t('tools.permission_granted', { params: { tool } }),
  denied: (tool: string) => t('tools.permission_denied', { params: { tool } }),
  confirm: (tool: string, action: string) => i18nToolConfirmation(tool, action),
};

/**
 * 工具帮助文本国际化
 */
export function i18nToolHelp(toolName: string): string {
  const key = `tools.help_${toolName}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.t(key);
  }

  // 通用帮助文本
  return t('tools.help_general', {
    defaultValue: `使用 ${toolName} 工具执行相关操作`,
    params: { tool: toolName },
  });
}

/**
 * 工具参数验证国际化
 */
export function i18nToolValidation(
  toolName: string,
  field: string,
  error: string,
  value?: string
): string {
  const key = `tools.validation_${toolName}_${field}_${error.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, { field, value: value || '', error });
  }

  // 通用验证错误
  return t('errors.validation_error', {
    defaultValue: `${toolName} 参数验证失败: ${field} - ${error}`,
    params: { tool: toolName, field, error, value: value || '' },
  });
}

/**
 * 工具进度国际化
 */
export function i18nToolProgress(
  toolName: string,
  action: string,
  progress: number,
  total: number
): string {
  const percentage = Math.round((progress / total) * 100);
  const key = `tools.progress_${toolName}_${action.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, { progress, total, percentage, action });
  }

  // 通用进度消息
  return t('agent.processing', {
    defaultValue: `${toolName}: ${action} 进行中... (${progress}/${total}, ${percentage}%)`,
    params: { tool: toolName, action, progress, total, percentage },
  });
}

/**
 * 批量工具操作国际化
 */
export function i18nBatchOperation(
  toolName: string,
  action: string,
  items: string[],
  current: number
): string {
  const key = `tools.batch_${toolName}_${action.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, {
      current,
      total: items.length,
      item: items[current - 1],
      items: items.join(', '),
    });
  }

  // 通用批量操作消息
  return t('agent.processing', {
    defaultValue: `${toolName}: ${action} ${items[current - 1]} (${current}/${items.length})`,
    params: {
      tool: toolName,
      action,
      current,
      total: items.length,
      item: items[current - 1],
    },
  });
}

/**
 * 工具结果格式化国际化
 */
export function i18nToolResult(
  toolName: string,
  action: string,
  result: any,
  format: 'text' | 'json' | 'table' = 'text'
): string {
  const key = `tools.result_${toolName}_${action.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${format}`;
  
  if (toolsI18n.has(key)) {
    return toolsI18n.format(key, { result: JSON.stringify(result) });
  }

  // 通用结果格式化
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    case 'table':
      // 简单表格格式化
      if (Array.isArray(result) && result.length > 0) {
        const headers = Object.keys(result[0]);
        const rows = result.map(row => headers.map(h => String(row[h] || '')).join(' | '));
        return `${headers.join(' | ')}\n${'-'.repeat(headers.join('').length + headers.length * 3)}\n${rows.join('\n')}`;
      }
      return String(result);
    default:
      return String(result);
  }
}

/**
 * 工具选择器国际化
 */
export function i18nToolSelector(
  availableTools: string[],
  prompt?: string
): AskUserQuestion {
  const options = availableTools.map(tool => ({
    label: t(`tools.${tool}`, { defaultValue: tool }),
    value: tool,
    description: i18nToolHelp(tool),
  }));

  return createI18nAskUserQuestion(
    prompt || 'prompts.select_option',
    {
      header: 'tools.title',
      options,
      allowFreeText: false,
    }
  );
}

/**
 * 工具参数输入国际化
 */
export function i18nToolParamInput(
  toolName: string,
  paramName: string,
  defaultValue?: string
): AskUserQuestion {
  return createI18nAskUserQuestion(
    'prompts.provide_input',
    {
      header: 'tools.title',
      params: { tool: toolName, param: paramName },
      allowFreeText: true,
      options: defaultValue ? [{
        label: 'common.use_default',
        value: defaultValue,
        description: t('common.default_value', { params: { value: defaultValue } }),
      }] : undefined,
    }
  );
}