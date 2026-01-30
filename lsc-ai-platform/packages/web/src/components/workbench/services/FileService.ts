/**
 * LSC-AI Workbench 文件服务
 *
 * 提供文件加载、类型检测等功能
 * 通过 Socket.IO 与 Client Agent 通信
 */

import type { FileType, FileTreeNode } from '../schema/types';
import { getSocket, connectSocket, isSocketConnected } from '../../../services/socket';
import { useAgentStore } from '../../../stores/agent';

// ============================================================================
// 类型定义
// ============================================================================

/** 文件内容响应 */
export interface FileContent {
  /** 文件路径 */
  filePath: string;
  /** 文件内容（文本文件） */
  content?: string;
  /** Base64 编码内容（二进制文件） */
  base64?: string;
  /** 文件类型 */
  fileType: FileType;
  /** 编程语言（代码文件） */
  language?: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件名 */
  filename: string;
  /** 是否为二进制文件 */
  isBinary: boolean;
  /** 错误信息 */
  error?: string;
}

/** 文件列表响应 */
export interface FileListResponse {
  /** 根路径 */
  rootPath: string;
  /** 文件树 */
  files: FileTreeNode[];
  /** 错误信息 */
  error?: string;
}

/** 文件写入响应 */
export interface FileWriteResponse {
  /** 文件路径 */
  filePath: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

// ============================================================================
// 文件类型检测
// ============================================================================

/** 文件扩展名到类型的映射 */
const extensionToType: Record<string, FileType> = {
  // 代码文件
  js: 'code', jsx: 'code', ts: 'code', tsx: 'code',
  py: 'code', rb: 'code', java: 'code', kt: 'code',
  go: 'code', rs: 'code', c: 'code', cpp: 'code', h: 'code', hpp: 'code',
  cs: 'code', swift: 'code', m: 'code', mm: 'code',
  php: 'code', pl: 'code', r: 'code', scala: 'code',
  sh: 'code', bash: 'code', zsh: 'code', ps1: 'code',
  sql: 'code', vue: 'code', svelte: 'code',
  html: 'code', htm: 'code', css: 'code', scss: 'code', sass: 'code', less: 'code',
  json: 'code', yaml: 'code', yml: 'code', toml: 'code', xml: 'code',

  // Markdown
  md: 'markdown', mdx: 'markdown',

  // 纯文本
  txt: 'text', log: 'text', ini: 'text', cfg: 'text', conf: 'text',
  env: 'text', gitignore: 'text', dockerignore: 'text',

  // 图片
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
  webp: 'image', svg: 'image', ico: 'image', bmp: 'image',

  // PDF
  pdf: 'pdf',

  // Office 文档
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel',
  ppt: 'ppt', pptx: 'ppt',

  // 视频
  mp4: 'video', webm: 'video', avi: 'video', mov: 'video', mkv: 'video',

  // 音频
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
};

/** 扩展名到编程语言的映射 */
const extensionToLanguage: Record<string, string> = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  go: 'go',
  rs: 'rust',
  c: 'c', h: 'c',
  cpp: 'cpp', hpp: 'cpp', cc: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  m: 'objective-c', mm: 'objective-c',
  php: 'php',
  pl: 'perl',
  r: 'r',
  scala: 'scala',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  vue: 'vue',
  svelte: 'svelte',
  html: 'html', htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  md: 'markdown', mdx: 'markdown',
};

/**
 * 从文件路径获取扩展名
 */
export function getExtension(filePath: string): string {
  const parts = filePath.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

/**
 * 从文件路径获取文件名
 */
export function getFilename(filePath: string): string {
  // 处理 Windows 和 Unix 路径
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * 检测文件类型
 */
export function detectFileType(filePath: string): FileType {
  const ext = getExtension(filePath);
  return extensionToType[ext] || 'unknown';
}

/**
 * 检测编程语言
 */
export function detectLanguage(filePath: string): string {
  const ext = getExtension(filePath);
  return extensionToLanguage[ext] || 'plaintext';
}

/**
 * 判断是否为二进制文件
 */
export function isBinaryFile(filePath: string): boolean {
  const type = detectFileType(filePath);
  return ['image', 'pdf', 'video', 'audio', 'word', 'excel', 'ppt', 'unknown'].includes(type);
}

// ============================================================================
// 文件服务类
// ============================================================================

class FileServiceClass {
  private pendingRequests: Map<string, {
    resolve: (value: FileContent) => void;
    reject: (reason: any) => void;
  }> = new Map();
  private listenersSetup = false;

  /**
   * 获取当前 Socket（使用全局 socket）
   */
  private getSocketInstance() {
    return getSocket();
  }

  /**
   * 确保 Socket 已连接并设置监听器
   */
  private async ensureConnected() {
    // 如果没有连接，尝试连接
    if (!isSocketConnected()) {
      try {
        await connectSocket();
      } catch (e) {
        throw new Error('Socket 未连接');
      }
    }

    const socket = this.getSocketInstance();
    if (!socket) {
      throw new Error('Socket 未连接');
    }

    // 设置监听器（只设置一次）
    if (!this.listenersSetup) {
      this.setupListeners(socket);
      this.listenersSetup = true;
    }

    return socket;
  }

  /**
   * 设置 Socket 监听器
   */
  private setupListeners(socket: any): void {
    console.log('[FileService] 设置 Socket 监听器');

    // 监听文件内容响应
    socket.on('file:content', (response: FileContent) => {
      console.log('[FileService] 收到 file:content 响应:', {
        filePath: response.filePath,
        hasContent: !!response.content,
        hasBase64: !!response.base64,
        base64Length: response.base64?.length,
        fileType: response.fileType,
        error: response.error,
      });

      const pending = this.pendingRequests.get(response.filePath);
      if (pending) {
        this.pendingRequests.delete(response.filePath);
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response);
        }
      } else {
        console.warn('[FileService] 没有找到对应的 pending 请求:', response.filePath);
      }
    });

    socket.on('file:list', (response: FileListResponse) => {
      const pending = this.pendingRequests.get(`list:${response.rootPath}`);
      if (pending) {
        this.pendingRequests.delete(`list:${response.rootPath}`);
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response as any);
        }
      }
    });

    // 监听文件写入响应
    socket.on('file:writeResult', (response: FileWriteResponse) => {
      const pending = this.pendingRequests.get(`write:${response.filePath}`);
      if (pending) {
        this.pendingRequests.delete(`write:${response.filePath}`);
        if (response.error || !response.success) {
          pending.reject(new Error(response.error || '写入失败'));
        } else {
          pending.resolve(response as any);
        }
      }
    });
  }

  /**
   * 设置 Socket 实例（向后兼容）
   * @deprecated 使用全局 socket，无需手动设置
   */
  setSocket(_socket: any): void {
    console.warn('[FileService] setSocket 已废弃，使用全局 socket');
  }

  /**
   * 加载文件内容
   */
  async loadFile(filePath: string): Promise<FileContent> {
    const socket = await this.ensureConnected();

    // 检查是否有待处理的相同请求
    if (this.pendingRequests.has(filePath)) {
      return new Promise((resolve, reject) => {
        const existing = this.pendingRequests.get(filePath)!;
        const originalResolve = existing.resolve;
        const originalReject = existing.reject;
        existing.resolve = (value) => {
          originalResolve(value);
          resolve(value);
        };
        existing.reject = (reason) => {
          originalReject(reason);
          reject(reason);
        };
      });
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(filePath, { resolve, reject });

      // 获取当前设备 ID（本地模式）
      const { currentDeviceId } = useAgentStore.getState();

      const isBinary = isBinaryFile(filePath);
      console.log('[FileService] 发送 file:read 请求:', {
        filePath,
        encoding: isBinary ? 'base64' : 'utf-8',
        deviceId: currentDeviceId,
        isBinary,
        fileType: detectFileType(filePath),
      });

      // 发送文件读取请求
      socket.emit('file:read', {
        filePath,
        encoding: isBinary ? 'base64' : 'utf-8',
        deviceId: currentDeviceId,
      });

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(filePath)) {
          this.pendingRequests.delete(filePath);
          reject(new Error('文件加载超时'));
        }
      }, 30000); // 30秒超时
    });
  }

  /**
   * 保存文件内容
   */
  async saveFile(filePath: string, content: string): Promise<void> {
    const socket = await this.ensureConnected();

    const requestKey = `write:${filePath}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestKey, {
        resolve: () => resolve(),
        reject,
      });

      // 获取当前设备 ID（本地模式）
      const { currentDeviceId } = useAgentStore.getState();

      // 发送文件写入请求
      socket.emit('file:write', {
        filePath,
        content,
        encoding: 'utf-8',
        deviceId: currentDeviceId,
      });

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(requestKey)) {
          this.pendingRequests.delete(requestKey);
          reject(new Error('文件保存超时'));
        }
      }, 30000); // 30秒超时
    });
  }

  /**
   * 获取目录文件列表
   */
  async getFileList(rootPath: string, patterns?: string[]): Promise<FileTreeNode[]> {
    const socket = await this.ensureConnected();

    const requestKey = `list:${rootPath}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestKey, {
        resolve: (response: any) => resolve(response.files),
        reject
      });

      // 获取当前设备 ID（本地模式）
      const { currentDeviceId } = useAgentStore.getState();

      socket.emit('file:list', {
        rootPath,
        patterns,
        deviceId: currentDeviceId,
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestKey)) {
          this.pendingRequests.delete(requestKey);
          reject(new Error('获取文件列表超时'));
        }
      }, 30000);
    });
  }

  /**
   * 创建模拟的文件内容（用于没有 Client Agent 的情况）
   */
  createMockFileContent(filePath: string): FileContent {
    const fileType = detectFileType(filePath);
    const language = detectLanguage(filePath);
    const filename = getFilename(filePath);

    return {
      filePath,
      content: `// 文件: ${filename}\n// 类型: ${fileType}\n// 需要 Client Agent 连接才能加载实际内容`,
      fileType,
      language,
      size: 0,
      filename,
      isBinary: isBinaryFile(filePath),
    };
  }
}

// 导出单例
export const FileService = new FileServiceClass();

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

/**
 * 文件加载 Hook
 */
export function useFileContent(filePath: string | undefined) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async () => {
    if (!filePath) {
      console.log('[useFileContent] filePath 为空，跳过加载');
      setContent(null);
      return;
    }

    console.log('[useFileContent] 开始加载文件:', filePath);
    setLoading(true);
    setError(null);

    try {
      const result = await FileService.loadFile(filePath);
      console.log('[useFileContent] 文件加载成功:', {
        filePath: result.filePath,
        hasContent: !!result.content,
        hasBase64: !!result.base64,
        base64Length: result.base64?.length,
        fileType: result.fileType,
      });
      setContent(result);
    } catch (err) {
      console.error('[useFileContent] 加载文件失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
      // 使用模拟内容作为回退
      const mockContent = FileService.createMockFileContent(filePath);
      console.log('[useFileContent] 使用模拟内容作为回退:', {
        filePath: mockContent.filePath,
        hasBase64: !!mockContent.base64,
      });
      setContent(mockContent);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  return { content, loading, error, reload: loadFile };
}

/**
 * 文件列表 Hook
 */
export function useFileList(rootPath: string | undefined, patterns?: string[]) {
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!rootPath) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await FileService.getFileList(rootPath, patterns);
      setFiles(result);
    } catch (err) {
      console.error('[FileService] 获取文件列表失败:', err);
      setError(err instanceof Error ? err.message : '获取失败');
    } finally {
      setLoading(false);
    }
  }, [rootPath, patterns]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return { files, loading, error, reload: loadFiles };
}
