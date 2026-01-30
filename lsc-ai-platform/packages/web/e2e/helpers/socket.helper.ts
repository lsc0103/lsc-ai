/**
 * Socket.IO 测试辅助工具
 *
 * 提供通过 Socket.IO 直接与 AI 对话的能力，
 * 用于精确验证工具调用和结果。
 */
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const API_BASE = `${SERVER_URL}/api`;

export interface StreamEvent {
  sessionId: string;
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'status';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  };
  toolResult?: {
    toolCallId: string;
    name: string;
    success: boolean;
    output: string;
    error?: string;
  };
  done?: boolean;
  stopped?: boolean;
  toolCallsCount?: number;
}

export interface ChatResult {
  text: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
  toolResults: Array<{
    name: string;
    success: boolean;
    output: string;
    error?: string;
  }>;
  events: StreamEvent[];
  toolCallsCount: number;
  error?: string;
}

export class SocketHelper {
  private socket: Socket | null = null;
  private token: string = '';

  async login(username = 'admin', password = 'Admin@123'): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    this.token = data.accessToken;
    return this.token;
  }

  async createSession(title?: string): Promise<string> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ title: title || `test-socket-${Date.now()}` }),
    });
    const data = await res.json();
    return data.id;
  }

  async deleteSession(id: string): Promise<void> {
    await fetch(`${API_BASE}/sessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL, {
        reconnection: false,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.socket!.emit('auth', { token: this.token }, (res: any) => {
          if (res?.success) {
            resolve();
          } else {
            reject(new Error(`Auth failed: ${JSON.stringify(res)}`));
          }
        });
      });

      this.socket.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });

      setTimeout(() => reject(new Error('Connection timeout')), 15000);
    });
  }

  /**
   * 发送消息并收集完整响应（包括所有工具调用和结果）
   */
  async chat(sessionId: string, message: string, timeoutMs = 180000): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      const result: ChatResult = {
        text: '',
        toolCalls: [],
        toolResults: [],
        events: [],
        toolCallsCount: 0,
      };

      const timer = setTimeout(() => {
        this.socket?.off('chat:stream', handler);
        reject(new Error(`Chat timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (data: StreamEvent) => {
        if (data.sessionId !== sessionId) return;

        result.events.push(data);

        switch (data.type) {
          case 'text':
            result.text += data.content || '';
            break;
          case 'tool_call':
            if (data.toolCall) {
              result.toolCalls.push({
                name: data.toolCall.name,
                arguments: data.toolCall.arguments,
              });
            }
            break;
          case 'tool_result':
            if (data.toolResult) {
              result.toolResults.push({
                name: data.toolResult.name,
                success: data.toolResult.success,
                output: data.toolResult.output,
                error: data.toolResult.error,
              });
            }
            break;
          case 'error':
            result.error = data.content;
            clearTimeout(timer);
            this.socket?.off('chat:stream', handler);
            resolve(result);
            return;
          case 'done':
            result.toolCallsCount = data.toolCallsCount || 0;
            clearTimeout(timer);
            this.socket?.off('chat:stream', handler);
            resolve(result);
            return;
        }
      };

      this.socket.on('chat:stream', handler);

      this.socket.emit('chat:message', {
        sessionId,
        message,
      }, (ack: any) => {
        if (!ack?.success) {
          clearTimeout(timer);
          this.socket?.off('chat:stream', handler);
          reject(new Error(`Send failed: ${JSON.stringify(ack)}`));
        }
      });
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  getToken() {
    return this.token;
  }
}
