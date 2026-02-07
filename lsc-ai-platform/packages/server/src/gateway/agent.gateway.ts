import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgentService, LLMConfig } from '../modules/agent/agent.service.js';
import { ChatGateway } from './chat.gateway.js';

/**
 * Client Agent 信息
 */
interface AgentInfo {
  deviceId: string;
  deviceName: string;
  userId: string;
  socketId: string;
  workDir?: string;
  status: 'online' | 'busy' | 'offline';
  connectedAt: Date;
  lastHeartbeat: Date;
}

/**
 * 认证后的 Socket
 */
interface AgentSocket extends Socket {
  agentInfo?: AgentInfo;
}


/**
 * Agent Gateway - 处理 Client Agent 连接和任务分发
 */
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Agent connections may come from internal network IPs without an origin header (e.g. Node.js clients)
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = (process.env.AGENT_CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
        .split(',')
        .map(s => s.trim());
      // Allow explicitly listed origins and private network ranges (10.x, 172.16-31.x, 192.168.x)
      const isPrivateNetwork = /^https?:\/\/(10\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+|192\.168\.\d+|127\.0\.0\.1|localhost)/.test(origin);
      if (allowed.includes(origin) || isPrivateNetwork) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed for agent namespace'));
      }
    },
    credentials: true,
  },
  namespace: '/agent',
})
export class AgentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('AgentGateway');

  // 在线 Agent 映射：deviceId -> AgentInfo
  private onlineAgents: Map<string, AgentInfo> = new Map();

  // 用户的 Agent 列表：userId -> deviceId[]
  private userAgents: Map<string, Set<string>> = new Map();

  // 任务注册表：taskId -> {sessionId, userId, taskType}（用于转发事件）
  private taskRegistry: Map<string, { sessionId: string; userId: string; taskType?: string }> = new Map();

  // 流式内容累积：taskId -> 累积的完整内容（用于保存到数据库）
  private streamingContent: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  afterInit() {
    this.logger.log('Agent Gateway 初始化完成');
    // 将 Gateway 引用注入到 AgentService
    this.agentService.setAgentGateway(this);
  }

  handleConnection(client: AgentSocket) {
    this.logger.log(`Agent 连接: ${client.id}`);
  }

  handleDisconnect(client: AgentSocket) {
    this.logger.log(`Agent 断开: ${client.id}`);

    if (client.agentInfo) {
      const { deviceId, userId } = client.agentInfo;

      // 更新状态为离线
      const agent = this.onlineAgents.get(deviceId);
      if (agent) {
        agent.status = 'offline';
        this.onlineAgents.delete(deviceId);
      }

      // 通知用户 Agent 离线
      this.server.to(`user:${userId}`).emit('agent:offline', {
        deviceId,
        deviceName: client.agentInfo.deviceName,
      });
    }
  }

  /**
   * Agent 配对请求
   */
  @SubscribeMessage('agent:pair')
  async handleAgentPair(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      pairingCode: string;
      deviceId: string;
      deviceName: string;
    },
  ) {
    const { pairingCode, deviceId, deviceName } = data;

    this.logger.log(`Agent 配对请求: code=${pairingCode}, device=${deviceId}`);

    // 使用 AgentService 验证配对码
    const result = await this.agentService.verifyPairingCode(pairingCode, {
      hostname: deviceName,
      platform: 'unknown',
      version: '0.1.0',
      deviceId,
      deviceName,
    });

    if (!result.success) {
      this.logger.warn(`配对失败: ${result.error}`);
      client.emit('agent:pairing_failed', result.error);
      return { success: false, error: result.error };
    }

    // 生成认证 Token（加密随机）
    const token = 'agent_' + crypto.randomBytes(32).toString('hex');

    // 设置 Socket 信息
    client.agentInfo = {
      deviceId,
      deviceName,
      userId: result.userId!,
      socketId: client.id,
      status: 'online',
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    // 加入用户房间
    client.join(`user:${result.userId}`);

    // 记录在线 Agent
    this.onlineAgents.set(deviceId, client.agentInfo);

    // 记录用户的 Agent
    if (!this.userAgents.has(result.userId!)) {
      this.userAgents.set(result.userId!, new Set());
    }
    this.userAgents.get(result.userId!)!.add(deviceId);

    // 通知 AgentService 上线
    this.agentService.agentOnline(result.agentId!, client.id);

    // 发送配对成功
    client.emit('agent:paired', {
      userId: result.userId,
      token,
    });

    this.logger.log(`Agent 配对成功: ${deviceId} -> user ${result.userId}`);

    return { success: true, userId: result.userId };
  }

  /**
   * Agent 请求配对码（首次启动时 Agent 主动请求）
   * Agent 显示配对码，用户在浏览器中输入完成绑定
   */
  @SubscribeMessage('agent:request_pairing_code')
  handleRequestPairingCode(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      deviceId: string;
      deviceName: string;
    },
  ) {
    const { deviceId, deviceName } = data;

    this.logger.log(`Agent 请求配对码: device=${deviceId}, name=${deviceName}`);

    // 生成配对码
    const code = this.agentService.generateAgentPairingCode(deviceId, deviceName);

    // 发送配对码给 Agent
    client.emit('agent:pairing_code', {
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    // 保存临时信息到 socket
    client.agentInfo = {
      deviceId,
      deviceName,
      userId: '', // 尚未绑定用户
      socketId: client.id,
      status: 'offline', // 等待配对
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    // 注册到待配对列表
    this.registerPendingSocket(deviceId, client);

    this.logger.log(`配对码已生成: ${code} -> device ${deviceId}`);

    return { success: true, code };
  }

  // 存储等待配对的 Agent Socket：deviceId -> socket
  private pendingPairingSockets: Map<string, AgentSocket> = new Map();

  /**
   * 注册等待配对的 Socket（在 handleRequestPairingCode 中调用）
   */
  registerPendingSocket(deviceId: string, socket: AgentSocket): void {
    this.pendingPairingSockets.set(deviceId, socket);
  }

  /**
   * Agent 配对确认（浏览器端确认配对后，服务器通知 Agent）
   * 内部方法，由 AgentController.confirmPairing 调用
   */
  notifyAgentPaired(deviceId: string, userId: string, llmConfig: LLMConfig): boolean {
    // 从 pendingPairingSockets 中查找等待配对的 Socket
    const agentSocket = this.pendingPairingSockets.get(deviceId);

    if (!agentSocket || !agentSocket.connected) {
      this.logger.warn(`Agent 配对确认失败: 未找到设备 ${deviceId} 或已断开`);
      return false;
    }

    // 更新 Agent 信息
    if (agentSocket.agentInfo) {
      agentSocket.agentInfo.userId = userId;
      agentSocket.agentInfo.status = 'online';
    }

    // 加入用户房间
    agentSocket.join(`user:${userId}`);

    // 记录在线 Agent
    if (agentSocket.agentInfo) {
      this.onlineAgents.set(deviceId, agentSocket.agentInfo);
    }

    // 记录用户的 Agent
    if (!this.userAgents.has(userId)) {
      this.userAgents.set(userId, new Set());
    }
    this.userAgents.get(userId)!.add(deviceId);

    // 生成认证 Token（加密随机）
    const token = 'agent_' + crypto.randomBytes(32).toString('hex');

    // 通知 Agent 配对成功，并下发 LLM 配置
    agentSocket.emit('agent:paired', {
      userId,
      token,
      llmConfig, // 下发 LLM 配置给 Client Agent
    });

    // 从待配对列表中移除
    this.pendingPairingSockets.delete(deviceId);

    this.logger.log(`Agent 配对成功（浏览器确认）: ${deviceId} -> user ${userId}，已下发 LLM 配置`);

    return true;
  }

  /**
   * Agent 上线通知（已配对的 Agent 重新连接）
   */
  @SubscribeMessage('agent:online')
  async handleAgentOnline(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      deviceId: string;
      deviceName: string;
      workDir?: string;
      token?: string;
    },
  ) {
    const { deviceId, deviceName, workDir, token } = data;

    // 验证 Token（简化处理）
    let agentRecord: any;
    try {
      agentRecord = await this.prisma.clientAgent.findUnique({
        where: { deviceId },
      });

      if (!agentRecord) {
        client.emit('agent:auth_failed', '设备未注册，请先配对');
        return { success: false, error: '设备未注册' };
      }

      // 验证 token（如果提供）
      if (token && agentRecord.token !== token) {
        client.emit('agent:auth_failed', 'Token 无效');
        return { success: false, error: 'Token 无效' };
      }
    } catch (error) {
      this.logger.error('验证 Agent 失败', error);
      return { success: false, error: '验证失败' };
    }

    // 设置 Socket 信息
    client.agentInfo = {
      deviceId,
      deviceName,
      userId: agentRecord.userId,
      socketId: client.id,
      workDir,
      status: 'online',
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    // 加入用户房间
    client.join(`user:${agentRecord.userId}`);

    // 记录在线 Agent
    this.onlineAgents.set(deviceId, client.agentInfo);

    // 更新数据库
    await this.prisma.clientAgent.update({
      where: { deviceId },
      data: { lastSeen: new Date() },
    });

    // 通知用户 Agent 上线
    this.server.to(`user:${agentRecord.userId}`).emit('agent:online', {
      deviceId,
      deviceName,
      workDir,
    });

    this.logger.log(`Agent 上线: ${deviceId} (user: ${agentRecord.userId})`);

    return { success: true };
  }

  /**
   * Agent 心跳
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AgentSocket) {
    if (client.agentInfo) {
      client.agentInfo.lastHeartbeat = new Date();
      client.emit('pong');
    }
    return { success: true };
  }

  /**
   * Agent 任务状态更新
   */
  @SubscribeMessage('agent:task_status')
  handleTaskStatus(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      taskId: string;
      status: string;
      [key: string]: any;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    const { userId } = client.agentInfo;

    // 转发给用户
    this.server.to(`user:${userId}`).emit('task:status', data);

    // 更新 Agent 状态
    if (data.status === 'running') {
      client.agentInfo.status = 'busy';
    } else if (data.status === 'completed' || data.status === 'failed') {
      client.agentInfo.status = 'online';
    }

    return { success: true };
  }

  /**
   * Agent 流式输出
   * 同时累积内容用于保存到数据库，确保平台知道完整对话
   */
  @SubscribeMessage('agent:stream')
  handleAgentStream(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      taskId: string;
      chunk: string;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    const { taskId, chunk } = data;

    // 累积流式内容（用于任务完成时保存到数据库）
    const existingContent = this.streamingContent.get(taskId) || '';
    this.streamingContent.set(taskId, existingContent + chunk);

    // 查找任务的 sessionId
    const taskInfo = this.taskRegistry.get(taskId);
    if (taskInfo) {
      // 对于 execute 类型任务，同时发送 execute:stream 事件（用于 Workbench 终端面板）
      if (taskInfo.taskType === 'execute') {
        this.chatGateway.emitToUser(taskInfo.userId, 'execute:stream', {
          taskId,
          content: chunk,
        });
      }

      // 通过 ChatGateway 转发流式文本，使用 chat:stream 格式
      this.chatGateway.emitToUser(taskInfo.userId, 'chat:stream', {
        sessionId: taskInfo.sessionId,
        type: 'text',
        content: chunk,
        done: false,
      });
    }

    return { success: true };
  }

  /**
   * Agent 工具调用
   */
  @SubscribeMessage('agent:tool_call')
  handleToolCall(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      taskId: string;
      toolName: string;
      args: Record<string, unknown>;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    // 查找任务的 sessionId
    const taskInfo = this.taskRegistry.get(data.taskId);
    if (taskInfo) {
      // 通过 ChatGateway 转发工具调用，使用 chat:stream 格式
      this.chatGateway.emitToUser(taskInfo.userId, 'chat:stream', {
        sessionId: taskInfo.sessionId,
        type: 'tool_call',
        toolCall: {
          id: `${data.taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: data.toolName,
          arguments: data.args,
        },
        done: false,
      });
    }

    return { success: true };
  }

  /**
   * Agent 工具结果
   */
  @SubscribeMessage('agent:tool_result')
  handleToolResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      taskId: string;
      toolName: string;
      result: unknown;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    // 查找任务的 sessionId
    const taskInfo = this.taskRegistry.get(data.taskId);
    if (taskInfo) {
      // 解析结果
      const resultObj = data.result as { success?: boolean; output?: string; error?: string; schema?: any };

      // 特殊处理 Workbench 工具（workbench + showTable/showChart/showCode 快捷工具）
      const WORKBENCH_TOOL_NAMES = ['workbench', 'showTable', 'showChart', 'showCode'];
      if (WORKBENCH_TOOL_NAMES.includes(data.toolName)) {
        // 工具结果可能在 output 字段中（JSON 序列化后），也可能直接在 resultObj 上
        let actualResult = resultObj;
        if (typeof resultObj?.output === 'string') {
          try {
            actualResult = JSON.parse(resultObj.output);
          } catch {
            // ignore parse error
          }
        }

        if (actualResult?.schema) {
          this.chatGateway.emitToUser(taskInfo.userId, 'workbench:update', {
            sessionId: taskInfo.sessionId,
            schema: actualResult.schema,
          });
          this.logger.log(`[Workbench:Agent] ${data.toolName} Schema 已推送到前端`);
        }
      }

      // 通过 ChatGateway 转发工具结果，使用 chat:stream 格式
      this.chatGateway.emitToUser(taskInfo.userId, 'chat:stream', {
        sessionId: taskInfo.sessionId,
        type: 'tool_result',
        toolResult: {
          toolCallId: `${data.taskId}_tool`,
          name: data.toolName,
          success: resultObj?.success ?? true,
          output: resultObj?.output,
          error: resultObj?.error,
        },
        done: false,
      });
    }

    return { success: true };
  }

  /**
   * Agent 任务结果
   * 任务完成时，将累积的内容保存到数据库，确保平台记录完整对话
   */
  @SubscribeMessage('agent:task_result')
  async handleTaskResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      taskId: string;
      sessionId?: string;
      status: string;
      result?: string;
      error?: string;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    const { userId } = client.agentInfo;
    const { taskId } = data;

    // 更新 Agent 状态
    client.agentInfo.status = 'online';

    // 从 taskRegistry 获取 sessionId（如果 data 中没有）
    const taskInfo = this.taskRegistry.get(taskId);
    const sessionId = data.sessionId || taskInfo?.sessionId;
    const targetUserId = taskInfo?.userId || userId;

    // 获取累积的流式内容
    const accumulatedContent = this.streamingContent.get(taskId) || '';

    // AI 回复由 Mastra Memory 自动存储，无需手动保存到 PostgreSQL
    // 仅记录日志
    if (sessionId && accumulatedContent) {
      this.logger.log(`[Client Agent] AI 回复完成: sessionId=${sessionId}, 长度=${accumulatedContent.length}, status=${data.status}`);
    }

    // 对于 execute 类型任务，发送 execute:complete 事件（用于 Workbench 终端面板）
    if (taskInfo?.taskType === 'execute') {
      this.chatGateway.emitToUser(targetUserId, 'execute:complete', {
        taskId,
        status: data.status,
        result: data.result || accumulatedContent,
      });
    }

    // 通过 ChatGateway 转发为 chat:stream 格式（支持前端聊天界面）
    if (sessionId) {
      if (data.status === 'completed') {
        // 注意：流式内容已经通过 agent:stream 发送，这里只发送完成信号
        this.chatGateway.emitToUser(targetUserId, 'chat:stream', {
          sessionId,
          type: 'done',
          done: true,
        });
      } else if (data.status === 'failed') {
        // 发送错误
        this.chatGateway.emitToUser(targetUserId, 'chat:stream', {
          sessionId,
          type: 'error',
          content: `❌ 任务执行失败: ${data.error || '未知错误'}`,
          done: true,
        });
      } else if (data.status === 'cancelled') {
        // 发送取消
        this.chatGateway.emitToUser(targetUserId, 'chat:stream', {
          sessionId,
          type: 'done',
          content: '\n\n[任务已取消]',
          done: true,
          stopped: true,
        });
      }
    } else {
      // 兼容旧格式，没有 sessionId 时使用 task:result 事件
      this.chatGateway.emitToUser(targetUserId, 'task:result', data);
    }

    // 清理任务注册表和流式内容累积
    if (taskId) {
      this.taskRegistry.delete(taskId);
      this.streamingContent.delete(taskId);
      this.logger.log(`任务清理: ${taskId}`);
    }

    this.logger.log(`任务完成: ${taskId} - ${data.status}`);

    return { success: true };
  }

  /**
   * Agent 文件内容响应
   * 转发给请求的浏览器客户端
   */
  @SubscribeMessage('agent:file:content')
  handleFileContent(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      filePath: string;
      content?: string;
      base64?: string;
      fileType?: string;
      language?: string;
      size?: number;
      filename?: string;
      isBinary?: boolean;
      error?: string;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    const { userId } = client.agentInfo;

    // 转发给用户的所有浏览器连接
    this.chatGateway.emitToUser(userId, 'file:content', data);

    this.logger.log(`文件内容响应: ${data.filePath} -> user ${userId}`);

    return { success: true };
  }

  /**
   * Agent 文件列表响应
   * 转发给请求的浏览器客户端
   */
  @SubscribeMessage('agent:file:list')
  handleFileList(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      rootPath: string;
      files?: any[];
      error?: string;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    const { userId } = client.agentInfo;

    // 转发给用户的所有浏览器连接
    this.chatGateway.emitToUser(userId, 'file:list', data);

    this.logger.log(`文件列表响应: ${data.rootPath} -> user ${userId}`);

    return { success: true };
  }

  /**
   * Agent 文件写入响应
   * 转发给请求的浏览器客户端
   */
  @SubscribeMessage('agent:file:writeResult')
  handleFileWriteResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      filePath: string;
      success: boolean;
      error?: string;
    },
  ) {
    if (!client.agentInfo) return { success: false };

    const { userId } = client.agentInfo;

    // 转发给用户的所有浏览器连接
    this.chatGateway.emitToUser(userId, 'file:writeResult', data);

    this.logger.log(`文件写入响应: ${data.filePath} -> user ${userId}, success=${data.success}`);

    return { success: true };
  }

  /**
   * 向指定 Agent 发送任务
   */
  sendTaskToAgent(deviceId: string, task: any): boolean {
    const agent = this.onlineAgents.get(deviceId);
    if (!agent || agent.status === 'offline') {
      return false;
    }

    // 注册任务到 taskRegistry（用于后续转发事件）
    if (task.taskId && task.sessionId && task.userId) {
      this.taskRegistry.set(task.taskId, {
        sessionId: task.sessionId,
        userId: task.userId,
        taskType: task.type, // 保存任务类型用于路由
      });
      this.logger.log(`任务注册: ${task.taskId} -> session ${task.sessionId}, type=${task.type}`);
    }

    this.server.to(agent.socketId).emit('agent:task', task);
    return true;
  }

  /**
   * 获取用户在线的 Agent 列表
   */
  getUserOnlineAgents(userId: string): AgentInfo[] {
    const deviceIds = this.userAgents.get(userId);
    if (!deviceIds) return [];

    return Array.from(deviceIds)
      .map((id) => this.onlineAgents.get(id))
      .filter((a): a is AgentInfo => a !== undefined && a.status !== 'offline');
  }

  /**
   * 检查 Agent 是否在线
   */
  isAgentOnline(deviceId: string): boolean {
    const agent = this.onlineAgents.get(deviceId);
    return agent !== undefined && agent.status !== 'offline';
  }
}
