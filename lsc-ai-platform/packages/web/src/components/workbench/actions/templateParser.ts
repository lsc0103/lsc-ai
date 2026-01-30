/**
 * 模板变量解析器
 *
 * 解析动作参数中的模板变量，如 ${selectedRows}、${formValues}
 */

import type { ActionContext } from './types';

// ============================================================================
// 模板变量正则
// ============================================================================

/** 匹配 ${variableName} 格式的变量 */
const TEMPLATE_VAR_REGEX = /\$\{([^}]+)\}/g;

// ============================================================================
// 解析函数
// ============================================================================

/**
 * 解析模板字符串中的变量
 *
 * @param template 模板字符串，如 "分析这些数据: ${selectedRows}"
 * @param context 动作上下文，包含可用的变量值
 * @returns 解析后的字符串
 */
export function parseTemplate(
  template: string,
  context: ActionContext
): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(TEMPLATE_VAR_REGEX, (match, varPath) => {
    const value = resolveVariable(varPath, context);
    if (value === undefined) {
      console.warn(`[TemplateParser] 未找到变量: ${varPath}`);
      return match; // 保留原始模板
    }
    // 如果是对象/数组，序列化为 JSON
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  });
}

/**
 * 解析对象中所有字符串属性的模板变量
 *
 * @param obj 要解析的对象
 * @param context 动作上下文
 * @returns 解析后的对象（深拷贝）
 */
export function parseObjectTemplates<T extends Record<string, unknown>>(
  obj: T,
  context: ActionContext
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = parseTemplate(value, context);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? parseTemplate(item, context)
          : typeof item === 'object' && item !== null
          ? parseObjectTemplates(item as Record<string, unknown>, context)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = parseObjectTemplates(
        value as Record<string, unknown>,
        context
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================================
// 变量解析
// ============================================================================

/**
 * 解析变量路径，获取值
 *
 * 支持的变量格式：
 * - selectedRows / selectedRow - 选中的行数据
 * - formValues - 表单值
 * - data.xxx - 上下文数据中的属性
 * - componentData.xxx - 组件数据
 *
 * @param varPath 变量路径，如 "selectedRows" 或 "data.name"
 * @param context 动作上下文
 * @returns 变量值
 */
function resolveVariable(
  varPath: string,
  context: ActionContext
): unknown {
  const path = varPath.trim();

  // 内置变量
  switch (path) {
    case 'selectedRows':
      return context.data?.selectedRows;
    case 'selectedRow':
      const rows = context.data?.selectedRows as unknown[] | undefined;
      return rows?.[0];
    case 'formValues':
      return context.data?.formValues;
    case 'currentTab':
      return context.data?.currentTab;
    case 'sessionId':
      return context.sessionId;
    case 'sourceComponentId':
      return context.sourceComponentId;
  }

  // 路径解析（如 data.name 或 componentData.chart-1）
  if (path.includes('.')) {
    const parts = path.split('.');
    const root = parts[0];
    const subPath = parts.slice(1);

    let value: unknown;

    if (root === 'data') {
      value = context.data;
    } else if (root === 'componentData') {
      // 从 WorkbenchStore 获取组件数据
      // 这里需要在实际使用时注入
      value = (context as any).componentData;
    } else {
      value = context.data?.[root];
    }

    // 沿路径取值
    for (const key of subPath) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }

    return value;
  }

  // 直接从 data 中查找
  return context.data?.[path];
}

// ============================================================================
// 导出工具函数
// ============================================================================

/**
 * 检查字符串是否包含模板变量
 */
export function hasTemplateVariables(str: string): boolean {
  return TEMPLATE_VAR_REGEX.test(str);
}

/**
 * 提取字符串中的所有模板变量名
 */
export function extractVariableNames(str: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;

  // 重置正则状态
  TEMPLATE_VAR_REGEX.lastIndex = 0;

  while ((match = TEMPLATE_VAR_REGEX.exec(str)) !== null) {
    names.push(match[1]);
  }

  return names;
}
