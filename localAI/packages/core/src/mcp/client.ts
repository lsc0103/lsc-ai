/**
 * MCP 客户端实现 - 高级版
 * 支持 stdio, SSE, WebSocket 传输
 * 支持 Tools, Resources, Prompts, Logging
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResource,
  MCPResourceTemplate,
  MCPPrompt,
  JSONRPCMessage,
  ToolCallResult,
  ReadResourceResult,
  GetPromptResult,
  ServerCapabilities,
  InitializeResult,
  LogLevel,
  MCPClientStatus,
  MCPClientEvent,
  IMCPClient,
  LogMessageNotification,
  ProgressNotification,
  ResourceUpdatedNotification,
} from './types.js';

/**
 * MCP 客户端
 */
export class MCPClient extends EventEmitter implements IMCPClient {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private buffer = '';

  // 状态
  private _status: MCPClientStatus = 'disconnected';
  private _capabilities: ServerCapabilities | null = null;
  private _serverInfo: { name: string; version: string } | null = null;

  // 缓存
  private cachedTools: MCPToolDefinition[] = [];
  private cachedResources: MCPResource[] = [];
  private cachedResourceTemplates: MCPResourceTemplate[] = [];
  private cachedPrompts: MCPPrompt[] = [];

  // 资源订阅
  private subscriptions: Set<string> = new Set();

  // 重连
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // SSE/WebSocket
  private abortController: AbortController | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ws: any = null;

  constructor(config: MCPServerConfig) {
    super();
    this.config = {
      connectTimeout: 30000,
      requestTimeout: 30000,
      autoReconnect: true,
      maxReconnectAttempts: 5,
      ...config,
    };
  }

  // ==================== 公共属性 ====================

  get name(): string {
    return this.config.name;
  }

  get status(): MCPClientStatus {
    return this._status;
  }

  get capabilities(): ServerCapabilities | null {
    return this._capabilities;
  }

  get serverInfo(): { name: string; version: string } | null {
    return this._serverInfo;
  }

  // ==================== 连接管理 ====================

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    if (this._status === 'connected') {
      return;
    }

    this._status = 'connecting';
    this.emit('connecting');

    try {
      switch (this.config.transport) {
        case 'stdio':
          await this.connectStdio();
          break;
        case 'sse':
          await this.connectSSE();
          break;
        case 'websocket':
          await this.connectWebSocket();
          break;
        case 'http':
          // HTTP 模式不需要持久连接
          await this.initialize();
          break;
        default:
          throw new Error(`不支持的传输类型: ${this.config.transport}`);
      }

      this._status = 'connected';
      this.reconnectAttempts = 0;
      this.emit('connected');

      // 自动发现能力
      await this.discoverCapabilities();

    } catch (error) {
      this._status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.clearReconnectTimer();

    // 取消所有挂起的请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('连接已断开'));
      this.pendingRequests.delete(id);
    }

    // 关闭传输
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._status = 'disconnected';
    this._capabilities = null;
    this.cachedTools = [];
    this.cachedResources = [];
    this.cachedPrompts = [];
    this.subscriptions.clear();

    this.emit('disconnected');
  }

  // ==================== stdio 传输 ====================

  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('stdio 模式需要指定 command');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`连接超时 (${this.config.connectTimeout}ms)`));
      }, this.config.connectTimeout);

      const env = { ...process.env, ...this.config.env };

      this.process = spawn(this.config.command!, this.config.args || [], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data) => {
        this.handleStdioData(data.toString());
      });

      this.process.stderr?.on('data', (data) => {
        // 将 stderr 作为日志输出
        this.emit('logging/message', {
          level: 'warning',
          logger: this.config.name,
          data: data.toString(),
        } as LogMessageNotification);
      });

      this.process.on('error', (error) => {
        clearTimeout(timeout);
        this.handleDisconnect(error);
        reject(error);
      });

      this.process.on('close', (code) => {
        this.handleDisconnect(new Error(`进程退出，代码: ${code}`));
      });

      // 初始化
      this.initialize()
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private handleStdioData(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message: JSONRPCMessage = JSON.parse(trimmed);
        this.handleMessage(message);
      } catch {
        // 忽略非 JSON 行
      }
    }
  }

  // ==================== SSE 传输 ====================

  private async connectSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('SSE 模式需要指定 url');
    }

    // 首先初始化
    await this.initialize();

    // 然后建立 SSE 连接接收通知
    this.abortController = new AbortController();

    const response = await fetch(this.config.url + '/sse', {
      headers: this.config.headers,
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE 连接失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取 SSE 流');
    }

    // 后台读取 SSE 事件
    this.readSSEStream(reader);
  }

  private async readSSEStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              this.handleNotification(data);
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.handleDisconnect(error as Error);
      }
    }
  }

  // ==================== WebSocket 传输 ====================

  private async connectWebSocket(): Promise<void> {
    if (!this.config.url) {
      throw new Error('WebSocket 模式需要指定 url');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`连接超时 (${this.config.connectTimeout}ms)`));
      }, this.config.connectTimeout);

      // 注意：Node.js 环境需要 ws 包
      const WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');
      this.ws = new WebSocketImpl(this.config.url, {
        headers: this.config.headers,
      });

      this.ws.onopen = () => {
        this.initialize()
          .then(() => {
            clearTimeout(timeout);
            resolve();
          })
          .catch((error: Error) => {
            clearTimeout(timeout);
            reject(error);
          });
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.ws.onmessage = (event: any) => {
        try {
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          const message: JSONRPCMessage = JSON.parse(data);
          this.handleMessage(message);
        } catch {
          // 忽略
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.ws.onerror = (error: any) => {
        clearTimeout(timeout);
        this.handleDisconnect(new Error('WebSocket 错误'));
        reject(error);
      };

      this.ws.onclose = () => {
        this.handleDisconnect(new Error('WebSocket 关闭'));
      };
    });
  }

  // ==================== 消息处理 ====================

  private handleMessage(message: JSONRPCMessage): void {
    // 响应消息
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id as number);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id as number);

        if (message.error) {
          pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // 通知消息
    if (message.method) {
      this.handleNotification(message);
    }
  }

  private handleNotification(message: JSONRPCMessage): void {
    switch (message.method) {
      case 'notifications/tools/list_changed':
        this.emit('tools/list_changed');
        // 自动刷新工具列表
        this.listTools().catch(() => {});
        break;

      case 'notifications/resources/list_changed':
        this.emit('resources/list_changed');
        this.listResources().catch(() => {});
        break;

      case 'notifications/resources/updated':
        const resourceUpdate = message.params as ResourceUpdatedNotification;
        this.emit('resources/updated', resourceUpdate);
        break;

      case 'notifications/prompts/list_changed':
        this.emit('prompts/list_changed');
        this.listPrompts().catch(() => {});
        break;

      case 'notifications/message':
        const logMessage = message.params as LogMessageNotification;
        this.emit('logging/message', logMessage);
        break;

      case 'notifications/progress':
        const progress = message.params as ProgressNotification;
        this.emit('progress', progress);
        break;
    }
  }

  // ==================== 断连和重连 ====================

  private handleDisconnect(error: Error): void {
    if (this._status === 'disconnected') return;

    const wasConnected = this._status === 'connected';
    this._status = 'disconnected';

    this.process = null;
    this.ws = null;

    if (wasConnected) {
      this.emit('disconnected', error);

      // 尝试重连
      if (this.config.autoReconnect && this.reconnectAttempts < (this.config.maxReconnectAttempts || 5)) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    // 指数退避
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this._status = 'reconnecting';
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect 会处理错误
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ==================== 请求发送 ====================

  private async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    const id = ++this.messageId;

    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`请求超时: ${method}`));
      }, this.config.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.sendMessage(message).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  private async sendMessage(message: JSONRPCMessage): Promise<void> {
    const data = JSON.stringify(message);

    switch (this.config.transport) {
      case 'stdio':
        if (!this.process?.stdin) {
          throw new Error('stdio 未连接');
        }
        this.process.stdin.write(data + '\n');
        break;

      case 'websocket':
        if (!this.ws || this.ws.readyState !== 1) {
          throw new Error('WebSocket 未连接');
        }
        this.ws.send(data);
        break;

      case 'http':
      case 'sse':
        if (!this.config.url) {
          throw new Error('URL 未配置');
        }
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: data,
        });

        if (!response.ok) {
          throw new Error(`HTTP 请求失败: ${response.status}`);
        }

        const result = await response.json() as JSONRPCMessage;
        this.handleMessage(result);
        break;
    }
  }

  private sendNotification(method: string, params?: unknown): void {
    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.sendMessage(message).catch(() => {});
  }

  // ==================== 初始化 ====================

  private async initialize(): Promise<void> {
    const result = await this.sendRequest<InitializeResult>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: 'lsc-ai',
        version: '0.1.0',
      },
    });

    this._capabilities = result.capabilities;
    this._serverInfo = result.serverInfo;

    // 发送 initialized 通知
    this.sendNotification('notifications/initialized');
  }

  private async discoverCapabilities(): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // 发现工具
    if (this._capabilities?.tools) {
      promises.push(this.listTools().catch(() => []));
    }

    // 发现资源
    if (this._capabilities?.resources) {
      promises.push(this.listResources().catch(() => []));
      promises.push(this.listResourceTemplates().catch(() => []));
    }

    // 发现提示
    if (this._capabilities?.prompts) {
      promises.push(this.listPrompts().catch(() => []));
    }

    await Promise.all(promises);
  }

  // ==================== 工具 ====================

  async listTools(): Promise<MCPToolDefinition[]> {
    const result = await this.sendRequest<{ tools: MCPToolDefinition[] }>('tools/list');
    this.cachedTools = result.tools || [];
    return this.cachedTools;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult> {
    return this.sendRequest<ToolCallResult>('tools/call', {
      name,
      arguments: args || {},
    });
  }

  get discoveredTools(): MCPToolDefinition[] {
    return this.cachedTools;
  }

  // ==================== 资源 ====================

  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest<{ resources: MCPResource[] }>('resources/list');
    this.cachedResources = result.resources || [];
    return this.cachedResources;
  }

  async listResourceTemplates(): Promise<MCPResourceTemplate[]> {
    const result = await this.sendRequest<{ resourceTemplates: MCPResourceTemplate[] }>('resources/templates/list');
    this.cachedResourceTemplates = result.resourceTemplates || [];
    return this.cachedResourceTemplates;
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    return this.sendRequest<ReadResourceResult>('resources/read', { uri });
  }

  async subscribeResource(uri: string): Promise<void> {
    if (!this._capabilities?.resources?.subscribe) {
      throw new Error('服务器不支持资源订阅');
    }

    await this.sendRequest('resources/subscribe', { uri });
    this.subscriptions.add(uri);
  }

  async unsubscribeResource(uri: string): Promise<void> {
    if (!this.subscriptions.has(uri)) return;

    await this.sendRequest('resources/unsubscribe', { uri });
    this.subscriptions.delete(uri);
  }

  get discoveredResources(): MCPResource[] {
    return this.cachedResources;
  }

  get discoveredResourceTemplates(): MCPResourceTemplate[] {
    return this.cachedResourceTemplates;
  }

  // ==================== 提示 ====================

  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.sendRequest<{ prompts: MCPPrompt[] }>('prompts/list');
    this.cachedPrompts = result.prompts || [];
    return this.cachedPrompts;
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    return this.sendRequest<GetPromptResult>('prompts/get', {
      name,
      arguments: args,
    });
  }

  get discoveredPrompts(): MCPPrompt[] {
    return this.cachedPrompts;
  }

  // ==================== 日志 ====================

  async setLogLevel(level: LogLevel): Promise<void> {
    if (!this._capabilities?.logging) {
      throw new Error('服务器不支持日志');
    }

    await this.sendRequest('logging/setLevel', { level });
  }

  // ==================== 事件覆盖 ====================

  on(event: MCPClientEvent | string, handler: (data?: unknown) => void): this {
    return super.on(event, handler);
  }

  off(event: MCPClientEvent | string, handler: (data?: unknown) => void): this {
    return super.off(event, handler);
  }
}
