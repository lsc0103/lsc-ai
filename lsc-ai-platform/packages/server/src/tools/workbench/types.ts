/**
 * Workbench Schema 类型定义
 * 用于在前端展示代码、表格、图表等内容
 */

/**
 * 内容块类型
 */
export type ContentBlockType =
  | 'code'
  | 'table'
  | 'chart'
  | 'markdown'
  | 'json'
  | 'image'
  | 'file'
  | 'tabs';

/**
 * 代码块
 */
export interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

/**
 * 表格块
 */
export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: (string | number | boolean)[][];
  title?: string;
  sortable?: boolean;
  filterable?: boolean;
}

/**
 * 图表块（基于 ECharts）
 */
export interface ChartBlock {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | 'custom';
  option: Record<string, any>; // ECharts 配置
  title?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * Markdown 块
 */
export interface MarkdownBlock {
  type: 'markdown';
  content: string;
}

/**
 * JSON 块
 */
export interface JsonBlock {
  type: 'json';
  data: any;
  title?: string;
  collapsed?: boolean;
}

/**
 * 图片块
 */
export interface ImageBlock {
  type: 'image';
  url: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * 文件块
 */
export interface FileBlock {
  type: 'file';
  path: string;
  name: string;
  size?: number;
  downloadUrl?: string;
}

/**
 * 标签页块
 */
export interface TabsBlock {
  type: 'tabs';
  tabs: {
    label: string;
    content: ContentBlock;
  }[];
  defaultTab?: number;
}

/**
 * 内容块联合类型
 */
export type ContentBlock =
  | CodeBlock
  | TableBlock
  | ChartBlock
  | MarkdownBlock
  | JsonBlock
  | ImageBlock
  | FileBlock
  | TabsBlock;

/**
 * Workbench Schema
 */
export interface WorkbenchSchema {
  /**
   * Schema 版本
   */
  version: '1.0';

  /**
   * Workbench 标题
   */
  title?: string;

  /**
   * Workbench 描述
   */
  description?: string;

  /**
   * 内容块数组
   */
  blocks: ContentBlock[];

  /**
   * 元数据
   */
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * Workbench 工具返回类型
 */
export interface WorkbenchResult {
  success: boolean;
  schema?: WorkbenchSchema;
  message?: string;
  error?: string;
}
