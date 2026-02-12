import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { configManager } from '../config/index.js';

/**
 * 任务定义
 */
export interface AgentTask {
  taskId: string;
  sessionId?: string;
  userId?: string;
  type: 'chat' | 'execute' | 'file_operation' | 'file:read' | 'file:list' | 'file:write';
  payload: {
    message?: string;
    command?: string;
    workDir?: string;
    fileIds?: string[];
    /** 历史消息（用于上下文连续性，由 Platform 下发） */
    history?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    /** Workbench 上下文（让 AI 知道用户正在看什么，由 Platform 下发） */
    workbenchContext?: string;
    /** 文件操作相关 */
    filePath?: string;
    rootPath?: string;
    patterns?: string[];
    encoding?: string;
    /** 文件写入内容 */
    content?: string;
  };
  /** 回传信息（用于文件操作等非会话任务） */
  replyTo?: {
    userId: string;
    socketId: string;
    event: string;
  };
}

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 任务结果
 */
export interface TaskResult {
  taskId: string;
  sessionId?: string;
  status: TaskStatus;
  result?: string;
  error?: string;
}

/**
 * Socket 客户端事件
 */
export interface SocketClientEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  paired: (data: { userId: string; token: string }) => void;
  pairingFailed: (error: string) => void;
  pairingCodeReceived: (data: { code: string; expiresAt: string }) => void;
  taskReceived: (task: AgentTask) => void;
  error: (error: Error) => void;
}

/**
 * Platform Socket 客户端
 */
export class PlatformSocketClient extends EventEmitter {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * 连接到 Platform 服务器
   */
  connect(): void {
    const config = configManager.getAll();

    // 创建 Socket.IO 连接（连接到 /agent 命名空间）
    const platformUrl = config.platformUrl.endsWith('/')
      ? config.platformUrl.slice(0, -1)
      : config.platformUrl;
    this.socket = io(`${platformUrl}/agent`, {
      transports: ['websocket', 'polling'],
      auth: {
        type: 'client-agent',
        deviceId: config.deviceId,
        deviceName: config.deviceName,
        token: config.authToken,
      },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('[Socket] Connected to Platform');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected');

      // 如果已配对，发送上线通知
      if (configManager.isPaired()) {
        this.socket?.emit('agent:online', {
          deviceId: configManager.get('deviceId'),
          deviceName: configManager.get('deviceName'),
          workDir: configManager.get('workDir'),
        });
      }
    });

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      this.stopHeartbeat();
      this.emit('disconnected', reason);
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempts++;
      this.emit('error', error);
    });

    // 配对成功（包含 LLM 配置）
    this.socket.on('agent:paired', (data: {
      userId: string;
      token: string;
      llmConfig?: {
        apiProvider: string;
        apiBaseUrl: string;
        apiKey: string;
        model: string;
      };
    }) => {
      console.log('[Socket] Pairing successful');
      configManager.set('userId', data.userId);
      configManager.set('authToken', data.token);

      // 保存 Platform 下发的 LLM 配置
      if (data.llmConfig) {
        console.log('[Socket] Received LLM config from Platform');
        // 验证 apiProvider 是否为支持的类型（deepseek / openai-compatible）
        const provider = data.llmConfig.apiProvider as string;
        if (provider === 'deepseek' || provider === 'openai-compatible') {
          configManager.set('apiProvider', provider as 'deepseek' | 'openai-compatible');
        } else {
          console.warn(`[Socket] Unsupported LLM provider: ${provider}, defaulting to deepseek`);
          configManager.set('apiProvider', 'deepseek');
        }
        configManager.set('apiBaseUrl', data.llmConfig.apiBaseUrl);
        configManager.set('apiKey', data.llmConfig.apiKey);
        configManager.set('model', data.llmConfig.model);
      }

      this.emit('paired', data);
    });

    // 配对失败
    this.socket.on('agent:pairing_failed', (error: string) => {
      console.error('[Socket] Pairing failed:', error);
      this.emit('pairingFailed', error);
    });

    // 收到配对码（Agent 请求配对码后服务器返回）
    this.socket.on('agent:pairing_code', (data: { code: string; expiresAt: string }) => {
      console.log('[Socket] Received pairing code:', data.code);
      this.emit('pairingCodeReceived', data);
    });

    // 接收任务
    this.socket.on('agent:task', (task: AgentTask) => {
      console.log(`[Socket] Received task: ${task.taskId}`);
      this.emit('taskReceived', task);
    });

    // 心跳响应
    this.socket.on('pong', () => {
      // 心跳正常
    });
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // 30 秒一次心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 发送配对请求（使用从浏览器获取的配对码）
   */
  requestPairing(pairingCode: string): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to Platform');
    }

    this.socket.emit('agent:pair', {
      pairingCode,
      deviceId: configManager.get('deviceId'),
      deviceName: configManager.get('deviceName'),
    });
  }

  /**
   * 请求配对码（Agent 主动请求，显示给用户）
   * 用于首次启动时，用户在浏览器中输入此码完成绑定
   */
  requestPairingCode(): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to Platform');
    }

    this.socket.emit('agent:request_pairing_code', {
      deviceId: configManager.get('deviceId'),
      deviceName: configManager.get('deviceName'),
    });
  }

  /**
   * 发送任务状态更新
   */
  sendTaskStatus(taskId: string, status: TaskStatus, data?: Record<string, unknown>): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send task status: not connected');
      return;
    }

    this.socket.emit('agent:task_status', {
      taskId,
      status,
      ...data,
    });
  }

  /**
   * 发送流式输出
   */
  sendStreamChunk(taskId: string, chunk: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('agent:stream', {
      taskId,
      chunk,
    });
  }

  /**
   * 发送工具调用状态
   */
  sendToolCall(taskId: string, toolName: string, args: Record<string, unknown>): void {
    if (!this.socket?.connected) return;

    this.socket.emit('agent:tool_call', {
      taskId,
      toolName,
      args,
    });
  }

  /**
   * 发送工具调用结果
   */
  sendToolResult(taskId: string, toolName: string, result: unknown): void {
    if (!this.socket?.connected) return;

    this.socket.emit('agent:tool_result', {
      taskId,
      toolName,
      result,
    });
  }

  /**
   * 发送任务结果
   */
  sendTaskResult(result: TaskResult): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send task result: not connected');
      return;
    }

    this.socket.emit('agent:task_result', result);
  }

  /**
   * 发送文件操作响应
   * 用于 file:read 和 file:list 任务的结果回传
   */
  sendFileResponse(event: string, data: Record<string, unknown>): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send file response: not connected');
      return;
    }

    this.socket.emit(`agent:${event}`, data);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// 导出单例
export const socketClient = new PlatformSocketClient();
