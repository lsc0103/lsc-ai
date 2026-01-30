import type { ToolDefinition } from '../llm/types.js';

/**
 * 图片数据
 */
export interface ImageData {
  base64: string;
  mimeType: string;
}

/**
 * Diff 预览信息
 * 用于在执行文件修改前向用户展示变更预览
 */
export interface DiffPreview {
  /** 文件路径 */
  filePath: string;
  /** 操作类型 */
  operation: 'create' | 'edit' | 'delete';
  /** 原始内容（编辑/删除时） */
  beforeContent?: string;
  /** 新内容（创建/编辑时） */
  afterContent?: string;
  /** 格式化的 diff 输出 */
  diffOutput: string;
  /** 变更行数统计 */
  stats?: {
    additions: number;
    deletions: number;
  };
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  /** 图片数据（用于多模态） */
  image?: ImageData;
  /** Diff 预览（用于确认流程） */
  preview?: DiffPreview;
}

/**
 * 工具接口
 */
export interface Tool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
  /**
   * 获取执行预览（可选）
   * 用于在实际执行前生成预览信息，供用户确认
   * 类似 Claude Code 的 Diff 预览确认机制
   */
  getPreview?(args: Record<string, unknown>): Promise<DiffPreview | null>;
}
