/**
 * LSC-AI Workbench Schema 校验器
 *
 * 对 AI 输出的 Schema 进行安全校验，防止恶意内容注入
 */

import type {
  WorkbenchSchema,
  ComponentSchema,
  ComponentType,
  WorkbenchTab,
} from './types';

// ============================================================================
// 校验结果类型
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitizedSchema?: WorkbenchSchema;
}

export interface ValidationError {
  path: string;
  message: string;
  code: 'INVALID_TYPE' | 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'SECURITY_RISK';
}

// ============================================================================
// 允许的组件类型白名单
// ============================================================================

const ALLOWED_COMPONENT_TYPES: Set<ComponentType> = new Set([
  // 布局组件
  'Container', 'Row', 'Col', 'Tabs', 'Collapse',
  // 代码相关
  'CodeEditor', 'CodeDiff', 'Terminal', 'SQLEditor',
  // 数据展示
  'DataTable', 'Statistic', 'Card', 'Timeline', 'List', 'Citation',
  // 图表
  'BarChart', 'LineChart', 'PieChart', 'AreaChart', 'ScatterChart', 'Gantt',
  // 文件预览（新版 - 基于 filePath）
  'FileViewer', 'FileBrowser',
  // 文件预览（旧版）
  'FilePreview', 'ImagePreview', 'PdfPreview', 'VideoPreview', 'AudioPreview', 'MarkdownView',
  // Office 文档预览
  'WordPreview', 'ExcelPreview', 'PPTPreview',
  // 表单
  'Form', 'Button', 'Input', 'Select', 'DatePicker',
  // 其他
  'Alert', 'Progress', 'Empty',
]);

// ============================================================================
// 校验工具函数
// ============================================================================

/**
 * 检查是否为有效的组件类型
 */
function isValidComponentType(type: string): type is ComponentType {
  return ALLOWED_COMPONENT_TYPES.has(type as ComponentType);
}

/**
 * 清理 HTML 标签（防止 XSS）
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * 检查 URL 是否安全
 */
function isSafeUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, window.location.origin);
    // 只允许 http, https, data（用于内联图片）
    return ['http:', 'https:', 'data:'].includes(parsed.protocol);
  } catch {
    // 允许相对路径
    return !url.includes('javascript:') && !url.includes('data:text/html');
  }
}

/**
 * 深度清理对象中的字符串
 */
function deepSanitize<T>(obj: T, path: string = ''): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      deepSanitize(item, `${path}[${index}]`)
    ) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepSanitize(value, `${path}.${key}`);
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// 组件校验器
// ============================================================================

/**
 * 校验单个组件
 */
function validateComponent(
  component: unknown,
  path: string,
  errors: ValidationError[]
): ComponentSchema | null {
  if (!component || typeof component !== 'object') {
    errors.push({
      path,
      message: '组件必须是对象',
      code: 'INVALID_TYPE',
    });
    return null;
  }

  const comp = component as Record<string, unknown>;

  // 检查类型
  if (!comp.type || typeof comp.type !== 'string') {
    errors.push({
      path: `${path}.type`,
      message: '组件缺少 type 字段',
      code: 'MISSING_REQUIRED',
    });
    return null;
  }

  if (!isValidComponentType(comp.type)) {
    errors.push({
      path: `${path}.type`,
      message: `不支持的组件类型: ${comp.type}`,
      code: 'INVALID_TYPE',
    });
    return null;
  }

  // 检查 URL 类字段的安全性
  const urlFields = ['url', 'src', 'cover', 'image'];
  for (const field of urlFields) {
    if (comp[field] && typeof comp[field] === 'string') {
      if (!isSafeUrl(comp[field] as string)) {
        errors.push({
          path: `${path}.${field}`,
          message: `不安全的 URL: ${comp[field]}`,
          code: 'SECURITY_RISK',
        });
        // 清除不安全的 URL
        comp[field] = '';
      }
    }
  }

  // 递归校验子组件
  if (comp.children && Array.isArray(comp.children)) {
    comp.children = comp.children
      .map((child, index) =>
        validateComponent(child, `${path}.children[${index}]`, errors)
      )
      .filter(Boolean) as ComponentSchema[];
  }

  // 校验特定组件的必填字段
  const validationRules: Record<string, string[]> = {
    CodeEditor: ['code', 'language'],
    CodeDiff: ['original', 'modified', 'language'],
    Terminal: ['content'],
    DataTable: ['columns', 'data'],
    Statistic: ['title', 'value'],
    BarChart: ['xAxis', 'series'],
    LineChart: ['xAxis', 'series'],
    PieChart: ['data'],
    MarkdownView: ['content'],
    Alert: ['alertType', 'message'],
    Progress: ['percent'],
    Button: ['text'],
    // 新增组件校验规则
    FileViewer: ['filePath'],
    // FileBrowser 不需要必填字段，rootPath 可选
    // Office 文档至少需要 filePath 或 url
  };

  // 特殊校验：Office 文档需要 filePath 或 url
  if (['WordPreview', 'ExcelPreview', 'PPTPreview'].includes(comp.type as string)) {
    if (!comp.filePath && !comp.url) {
      errors.push({
        path: `${path}`,
        message: `${comp.type} 组件需要 filePath 或 url`,
        code: 'MISSING_REQUIRED',
      });
    }
  }

  const requiredFields = validationRules[comp.type];
  if (requiredFields) {
    for (const field of requiredFields) {
      if (comp[field] === undefined || comp[field] === null) {
        errors.push({
          path: `${path}.${field}`,
          message: `${comp.type} 组件缺少必填字段: ${field}`,
          code: 'MISSING_REQUIRED',
        });
      }
    }
  }

  return deepSanitize(comp) as unknown as ComponentSchema;
}

/**
 * 校验标签页
 */
function validateTab(
  tab: unknown,
  path: string,
  errors: ValidationError[]
): WorkbenchTab | null {
  if (!tab || typeof tab !== 'object') {
    errors.push({
      path,
      message: '标签页必须是对象',
      code: 'INVALID_TYPE',
    });
    return null;
  }

  const t = tab as Record<string, unknown>;

  // 检查必填字段
  if (!t.key || typeof t.key !== 'string') {
    errors.push({
      path: `${path}.key`,
      message: '标签页缺少 key 字段',
      code: 'MISSING_REQUIRED',
    });
    return null;
  }

  if (!t.title || typeof t.title !== 'string') {
    errors.push({
      path: `${path}.title`,
      message: '标签页缺少 title 字段',
      code: 'MISSING_REQUIRED',
    });
    return null;
  }

  // 校验组件
  const components: ComponentSchema[] = [];
  if (t.components && Array.isArray(t.components)) {
    for (let i = 0; i < t.components.length; i++) {
      const comp = validateComponent(
        t.components[i],
        `${path}.components[${i}]`,
        errors
      );
      if (comp) {
        components.push(comp);
      }
    }
  }

  return {
    key: sanitizeString(t.key as string),
    title: sanitizeString(t.title as string),
    icon: t.icon ? sanitizeString(t.icon as string) : undefined,
    closable: typeof t.closable === 'boolean' ? t.closable : true,
    components,
  };
}

// ============================================================================
// 主校验函数
// ============================================================================

/**
 * 校验 Workbench Schema
 *
 * @param schema - AI 输出的原始 Schema
 * @returns 校验结果，包含错误列表和清理后的 Schema
 */
export function validateWorkbenchSchema(schema: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // 基础类型检查
  if (!schema || typeof schema !== 'object') {
    return {
      valid: false,
      errors: [{
        path: '',
        message: 'Schema 必须是对象',
        code: 'INVALID_TYPE',
      }],
    };
  }

  const s = schema as Record<string, unknown>;

  // 检查类型标识
  if (s.type !== 'workbench') {
    return {
      valid: false,
      errors: [{
        path: 'type',
        message: 'Schema type 必须是 "workbench"',
        code: 'INVALID_VALUE',
      }],
    };
  }

  // 检查标签页
  if (!s.tabs || !Array.isArray(s.tabs) || s.tabs.length === 0) {
    return {
      valid: false,
      errors: [{
        path: 'tabs',
        message: 'Schema 必须包含至少一个标签页',
        code: 'MISSING_REQUIRED',
      }],
    };
  }

  // 校验每个标签页
  const tabs: WorkbenchTab[] = [];
  for (let i = 0; i < s.tabs.length; i++) {
    const tab = validateTab(s.tabs[i], `tabs[${i}]`, errors);
    if (tab) {
      tabs.push(tab);
    }
  }

  // 如果没有有效的标签页，返回失败
  if (tabs.length === 0) {
    errors.push({
      path: 'tabs',
      message: '没有有效的标签页',
      code: 'INVALID_VALUE',
    });
    return { valid: false, errors };
  }

  // 构建清理后的 Schema
  const sanitizedSchema: WorkbenchSchema = {
    type: 'workbench',
    title: s.title ? sanitizeString(s.title as string) : undefined,
    tabs,
    defaultActiveKey: s.defaultActiveKey
      ? sanitizeString(s.defaultActiveKey as string)
      : tabs[0].key,
    workbenchId: s.workbenchId
      ? sanitizeString(s.workbenchId as string)
      : undefined,
  };

  return {
    valid: errors.length === 0,
    errors,
    sanitizedSchema,
  };
}

/**
 * 快速检查是否为 Workbench Schema
 * 用于在消息流中快速识别
 */
export function isWorkbenchSchema(obj: unknown): obj is WorkbenchSchema {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return o.type === 'workbench' && Array.isArray(o.tabs);
}

/**
 * 从代码块中解析 Workbench Schema
 * 支持 ```workbench-schema 和 ```json 格式
 */
/**
 * 尝试修复 JSON 字符串中的常见问题
 * AI 输出的代码内容可能包含未转义的特殊字符
 */
function tryFixJson(jsonStr: string): string {
  // 尝试修复字符串值中的未转义换行符
  // 匹配 "key": "value 中间可能有未转义换行的情况
  let fixed = jsonStr;

  // 方法1: 尝试在 "code": " 后面的内容中转义换行符
  // 这是一个简化的处理，针对常见的代码字段
  try {
    // 处理 "code": "..." 字段中的换行符
    fixed = fixed.replace(
      /("code"\s*:\s*")([^"]*(?:\\.[^"]*)*)/g,
      (_match, prefix, content) => {
        // 转义内容中的实际换行符
        const escaped = content
          .replace(/\r\n/g, '\\n')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\n')
          .replace(/\t/g, '\\t');
        return prefix + escaped;
      }
    );
  } catch {
    // 如果正则处理失败，返回原始字符串
  }

  return fixed;
}

export function parseWorkbenchSchemaFromCodeBlock(
  codeBlock: string
): WorkbenchSchema | null {
  // 移除可能的代码块标记
  let content = codeBlock.trim();
  if (content.startsWith('```')) {
    const lines = content.split('\n');
    lines.shift(); // 移除开头的 ```xxx
    if (lines[lines.length - 1].trim() === '```') {
      lines.pop(); // 移除结尾的 ```
    }
    content = lines.join('\n');
  }

  // 尝试直接解析
  try {
    const parsed = JSON.parse(content);
    const result = validateWorkbenchSchema(parsed);

    if (result.sanitizedSchema) {
      if (result.errors.length > 0) {
        console.warn('Workbench Schema 有警告:', result.errors);
      }
      return result.sanitizedSchema;
    }

    console.warn('Workbench Schema 校验失败:', result.errors);
    return null;
  } catch (e) {
    console.warn('JSON 解析失败，尝试修复...', e);
  }

  // 尝试修复后再解析
  try {
    const fixedContent = tryFixJson(content);
    const parsed = JSON.parse(fixedContent);
    const result = validateWorkbenchSchema(parsed);

    if (result.sanitizedSchema) {
      console.log('JSON 修复成功');
      if (result.errors.length > 0) {
        console.warn('Workbench Schema 有警告:', result.errors);
      }
      return result.sanitizedSchema;
    }

    console.warn('修复后 Workbench Schema 校验失败:', result.errors);
    return null;
  } catch (e2) {
    console.error('修复后仍然解析失败:', e2);
    return null;
  }
}
