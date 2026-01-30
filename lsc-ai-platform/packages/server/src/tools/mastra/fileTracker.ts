import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Errors } from './errors.js';

/**
 * 文件状态信息
 */
export interface FileState {
  /** 文件路径 */
  path: string;
  /** 内容 hash (SHA-256) */
  hash: string;
  /** 最后修改时间 */
  mtime: number;
  /** 文件大小 */
  size: number;
  /** 记录时间 */
  recordedAt: number;
  /** 最后读取时的内容（用于 diff） */
  content?: string;
}

/**
 * 文件修改记录
 */
export interface FileModification {
  /** 文件路径 */
  path: string;
  /** 修改类型 */
  type: 'create' | 'edit' | 'delete';
  /** 修改前的状态 */
  beforeState?: FileState;
  /** 修改后的状态 */
  afterState?: FileState;
  /** 修改前的内容 */
  beforeContent?: string;
  /** 修改后的内容 */
  afterContent?: string;
  /** 修改时间 */
  timestamp: number;
  /** 工具调用 ID */
  toolCallId?: string;
}

/**
 * 冲突检测结果
 */
export interface ConflictCheckResult {
  /** 是否有冲突 */
  hasConflict: boolean;
  /** 冲突类型 */
  conflictType?: 'modified' | 'deleted' | 'created';
  /** 冲突描述 */
  description?: string;
  /** 当前文件状态 */
  currentState?: FileState;
  /** 记录的文件状态 */
  recordedState?: FileState;
}

/**
 * 计算文件内容的 hash
 */
export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 文件追踪器 - 追踪文件状态，检测冲突
 */
export class FileTracker {
  /** 文件状态缓存 */
  private fileStates: Map<string, FileState> = new Map();
  /** 修改历史 */
  private modifications: FileModification[] = [];
  /** 最大历史记录数 */
  private maxHistorySize: number;
  /** 是否保留内容用于 diff */
  private keepContent: boolean;

  constructor(options: {
    maxHistorySize?: number;
    keepContent?: boolean;
  } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 100;
    this.keepContent = options.keepContent ?? true;
  }

  /**
   * 获取文件的当前状态
   */
  async getFileState(filePath: string, includeContent: boolean = false): Promise<FileState | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = calculateHash(content);

      return {
        path: filePath,
        hash,
        mtime: stats.mtimeMs,
        size: stats.size,
        recordedAt: Date.now(),
        content: includeContent ? content : undefined,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 记录文件状态（在读取文件时调用）
   */
  async recordFileState(filePath: string, content?: string): Promise<FileState> {
    let state: FileState;

    if (content !== undefined) {
      // 如果已有内容，直接计算 hash
      const hash = calculateHash(content);
      try {
        const stats = await fs.stat(filePath);
        state = {
          path: filePath,
          hash,
          mtime: stats.mtimeMs,
          size: stats.size,
          recordedAt: Date.now(),
          content: this.keepContent ? content : undefined,
        };
      } catch {
        // 文件不存在时的情况（新文件）
        state = {
          path: filePath,
          hash,
          mtime: 0,
          size: content.length,
          recordedAt: Date.now(),
          content: this.keepContent ? content : undefined,
        };
      }
    } else {
      // 读取文件获取状态
      const fileState = await this.getFileState(filePath, this.keepContent);
      if (!fileState) {
        throw Errors.notFound(`文件不存在: ${filePath}`, filePath);
      }
      state = fileState;
    }

    this.fileStates.set(filePath, state);
    return state;
  }

  /**
   * 获取记录的文件状态
   */
  getRecordedState(filePath: string): FileState | undefined {
    return this.fileStates.get(filePath);
  }

  /**
   * 检查文件是否有冲突（被外部修改）
   */
  async checkConflict(filePath: string): Promise<ConflictCheckResult> {
    const recordedState = this.fileStates.get(filePath);

    // 没有记录的状态，无法检测冲突
    if (!recordedState) {
      return { hasConflict: false };
    }

    const currentState = await this.getFileState(filePath, false);

    // 文件被删除
    if (!currentState) {
      return {
        hasConflict: true,
        conflictType: 'deleted',
        description: '文件已被外部删除',
        recordedState,
      };
    }

    // 检查 hash 是否变化
    if (currentState.hash !== recordedState.hash) {
      return {
        hasConflict: true,
        conflictType: 'modified',
        description: '文件已被外部修改',
        currentState,
        recordedState,
      };
    }

    return {
      hasConflict: false,
      currentState,
      recordedState,
    };
  }

  /**
   * 检查冲突并抛出错误（用于编辑前验证）
   */
  async assertNoConflict(filePath: string): Promise<void> {
    const result = await this.checkConflict(filePath);

    if (result.hasConflict) {
      throw Errors.conflict(
        `文件冲突: ${result.description}`,
        {
          path: filePath,
          expected: result.recordedState?.hash.substring(0, 8),
          actual: result.currentState?.hash.substring(0, 8),
        }
      );
    }
  }

  /**
   * 记录文件修改
   */
  async recordModification(
    filePath: string,
    type: 'create' | 'edit' | 'delete',
    options: {
      beforeContent?: string;
      afterContent?: string;
      toolCallId?: string;
    } = {}
  ): Promise<FileModification> {
    const beforeState = this.fileStates.get(filePath);

    // 获取修改后的状态
    let afterState: FileState | undefined;
    if (type !== 'delete' && options.afterContent !== undefined) {
      afterState = await this.recordFileState(filePath, options.afterContent);
    } else if (type !== 'delete') {
      afterState = await this.getFileState(filePath, this.keepContent) ?? undefined;
      if (afterState) {
        this.fileStates.set(filePath, afterState);
      }
    }

    const modification: FileModification = {
      path: filePath,
      type,
      beforeState,
      afterState,
      beforeContent: this.keepContent ? options.beforeContent : undefined,
      afterContent: this.keepContent ? options.afterContent : undefined,
      timestamp: Date.now(),
      toolCallId: options.toolCallId,
    };

    this.modifications.push(modification);

    // 限制历史记录大小
    if (this.modifications.length > this.maxHistorySize) {
      this.modifications.shift();
    }

    return modification;
  }

  /**
   * 获取文件的修改历史
   */
  getModificationHistory(filePath?: string): FileModification[] {
    if (filePath) {
      return this.modifications.filter(m => m.path === filePath);
    }
    return [...this.modifications];
  }

  /**
   * 获取最近的修改
   */
  getLastModification(filePath?: string): FileModification | undefined {
    if (filePath) {
      for (let i = this.modifications.length - 1; i >= 0; i--) {
        const mod = this.modifications[i];
        if (mod && mod.path === filePath) {
          return mod;
        }
      }
      return undefined;
    }
    return this.modifications[this.modifications.length - 1];
  }

  /**
   * 检查是否可以撤销最后的修改
   */
  canUndo(filePath?: string): boolean {
    const lastMod = this.getLastModification(filePath);
    if (!lastMod) return false;

    // 只有 edit 和 create 可以撤销
    if (lastMod.type === 'delete') return false;

    // 需要有修改前的内容
    return lastMod.beforeContent !== undefined || lastMod.beforeState !== undefined;
  }

  /**
   * 撤销最后的修改（返回撤销操作需要的信息）
   */
  getUndoInfo(filePath?: string): {
    canUndo: boolean;
    modification?: FileModification;
    restoreContent?: string;
  } {
    const lastMod = this.getLastModification(filePath);

    if (!lastMod || lastMod.type === 'delete') {
      return { canUndo: false };
    }

    if (lastMod.type === 'create') {
      // 创建的文件撤销 = 删除
      return {
        canUndo: true,
        modification: lastMod,
        restoreContent: undefined, // 删除文件
      };
    }

    // 编辑的文件撤销 = 恢复原内容
    return {
      canUndo: !!lastMod.beforeContent,
      modification: lastMod,
      restoreContent: lastMod.beforeContent,
    };
  }

  /**
   * 清除指定文件的状态记录
   */
  clearFileState(filePath: string): void {
    this.fileStates.delete(filePath);
  }

  /**
   * 清除所有状态和历史
   */
  clear(): void {
    this.fileStates.clear();
    this.modifications = [];
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    trackedFiles: number;
    totalModifications: number;
    modificationsByType: Record<string, number>;
  } {
    const modificationsByType: Record<string, number> = {
      create: 0,
      edit: 0,
      delete: 0,
    };

    for (const mod of this.modifications) {
      const type = mod.type as keyof typeof modificationsByType;
      modificationsByType[type] = (modificationsByType[type] || 0) + 1;
    }

    return {
      trackedFiles: this.fileStates.size,
      totalModifications: this.modifications.length,
      modificationsByType,
    };
  }
}

/**
 * 全局文件追踪器实例
 */
export const fileTracker = new FileTracker();

/**
 * 创建新的文件追踪器实例
 */
export function createFileTracker(options?: {
  maxHistorySize?: number;
  keepContent?: boolean;
}): FileTracker {
  return new FileTracker(options);
}
