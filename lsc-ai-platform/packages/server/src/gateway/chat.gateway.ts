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
import { JwtService } from '@nestjs/jwt';
import { MastraAgentService } from '../services/mastra-agent.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MinioService } from '../modules/storage/minio.service.js';
import { AgentService } from '../modules/agent/agent.service.js';

// 类型定义（兼容旧代码）
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };
type MessageContent = Array<TextContent | ImageContent>;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  agentId?: string;
  clientType?: 'browser' | 'agent';
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
      .split(',')
      .map(s => s.trim()),
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('ChatGateway');

  // 用户连接映射：userId -> socketId[]
  private userSockets: Map<string, Set<string>> = new Map();

  // Agent 连接映射：agentId -> socketId
  private agentSockets: Map<string, string> = new Map();

  // 活跃的流式会话：sessionId -> 是否应该停止
  private activeStreams: Map<string, { shouldStop: boolean }> = new Map();

  constructor(
    private readonly mastraAgentService: MastraAgentService,
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway 初始化完成');
  }

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`客户端连接: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`客户端断开: ${client.id}`);

    // 清理用户连接
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }

    // 清理 Agent 连接
    if (client.agentId) {
      this.agentSockets.delete(client.agentId);
    }
  }

  // 浏览器客户端认证
  @SubscribeMessage('auth')
  handleAuth(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { token: string },
  ) {
    try {
      // 验证 JWT Token
      const payload = this.jwtService.verify<{ sub: string; username: string }>(data.token);
      client.clientType = 'browser';
      client.userId = payload.sub;

      this.logger.log(`用户认证成功: userId=${client.userId}, socketId=${client.id}`);

      // 加入用户房间
      client.join(`user:${client.userId}`);

      // 记录连接
      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      this.userSockets.get(client.userId)!.add(client.id);

      return { success: true };
    } catch (error) {
      this.logger.error(`认证失败: ${error}`);
      return { success: false, error: '认证失败' };
    }
  }

  // Agent 配对
  @SubscribeMessage('agent:pair')
  handleAgentPair(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    _data: {
      pairingCode: string;
      hostname: string;
      platform: string;
      version: string;
    },
  ) {
    // TODO: 调用 AgentService 验证配对码
    // 这里简化处理
    client.clientType = 'agent';

    return { success: true, agentId: 'temp-agent-id' };
  }

  // Agent 心跳
  @SubscribeMessage('agent:heartbeat')
  handleAgentHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    if (client.agentId) {
      // 更新最后活跃时间
      return { success: true, timestamp: Date.now() };
    }
    return { success: false };
  }

  // 停止生成
  @SubscribeMessage('chat:stop')
  handleChatStop(
    @ConnectedSocket() _client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    const { sessionId } = data;

    // 标记本地流式会话停止
    const streamInfo = this.activeStreams.get(sessionId);
    if (streamInfo) {
      streamInfo.shouldStop = true;
      this.logger.log(`停止生成: sessionId=${sessionId}`);
      return { success: true };
    }

    return { success: false, error: '没有活跃的流式会话' };
  }

  // 聊天消息（流式，基于 @lsc-ai/core Agent）
  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      sessionId: string;
      message: string;
      fileIds?: string[];
      // Client Agent 路由参数
      deviceId?: string;
      workDir?: string;
      // Workbench 上下文（让 AI 感知工作台状态）
      workbenchContext?: string;
      // AgentNetwork 模式（多 Agent 协作）
      useNetwork?: boolean;
    },
  ) {
    if (!client.userId) {
      return { success: false, error: '未认证' };
    }

    const { sessionId, message, fileIds, deviceId, workDir, workbenchContext, useNetwork } = data;

    this.logger.log(`收到消息: sessionId=${sessionId}, deviceId=${deviceId}, fileIds=${JSON.stringify(fileIds)}, hasWorkbenchContext=${!!workbenchContext}, useNetwork=${!!useNetwork}`);

    // 如果指定了 deviceId，检查是否要路由到 Client Agent
    if (deviceId) {
      return this.handleClientAgentMessage(client, {
        sessionId,
        message,
        deviceId,
        workDir,
        fileIds,
        workbenchContext,
      });
    }

    // AgentNetwork 模式：多 Agent 协作
    if (useNetwork) {
      return this.handleNetworkMessage(client, sessionId, message, workbenchContext);
    }

    try {
      // 1. 用户消息已由 Mastra Memory 自动存储，无需手动保存到 PostgreSQL

      // 2. DeepSeek API 配置检查（Mastra 自行处理）

      // 3. 处理附件文件（区分图片和其他文件）
      let baseMessage = message;
      if (workbenchContext) {
        baseMessage = `${workbenchContext}\n\n---\n\n用户消息: ${message}`;
        this.logger.log('[Remote] 已附加 Workbench 上下文');
      }
      let finalMessage: string | MessageContent = baseMessage;
      if (fileIds && fileIds.length > 0) {
        this.logger.log(`查询文件: ${fileIds.join(', ')}`);
        // 获取文件信息
        const files = await this.prisma.file.findMany({
          where: { id: { in: fileIds } },
        });

        this.logger.log(`查询到 ${files.length} 个文件: ${files.map(f => `${f.originalName}(${f.mimeType})`).join(', ')}`);

        if (files.length > 0) {
          // 分离图片文件和其他文件
          const imageFiles = files.filter(f => f.mimeType.startsWith('image/'));
          this.logger.log(`其中 ${imageFiles.length} 个图片文件`);
          const otherFiles = files.filter(f => !f.mimeType.startsWith('image/'));

          // 构建多模态消息内容
          const contentParts: (TextContent | ImageContent)[] = [];

          // 如果有其他文件，直接读取文件内容并添加到消息中
          let textMessage = message;
          if (otherFiles.length > 0) {
            const fileContents: string[] = [];
            for (const file of otherFiles) {
              try {
                const buffer = await this.minioService.getFileBuffer(file.objectKey);
                const content = buffer.toString('utf-8');
                fileContents.push(`\n--- 文件: ${file.originalName} ---\n${content}\n--- 文件结束 ---`);
                this.logger.log(`已读取文件内容: ${file.originalName} (${Math.round(buffer.length / 1024)} KB)`);
              } catch (error) {
                this.logger.error(`读取文件失败: ${file.originalName}`, error);
                fileContents.push(`\n--- 文件: ${file.originalName} ---\n[读取失败]\n--- 文件结束 ---`);
              }
            }
            textMessage = `${message}\n\n[用户上传的文件内容]${fileContents.join('\n')}`;
          }

          // 添加文本部分
          contentParts.push({ type: 'text', text: textMessage });

          // 处理图片文件 - 转换为 base64 数据 URL
          for (const imageFile of imageFiles) {
            try {
              const buffer = await this.minioService.getFileBuffer(imageFile.objectKey);
              const base64 = buffer.toString('base64');
              const dataUrl = `data:${imageFile.mimeType};base64,${base64}`;

              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'auto', // 让模型自动选择分辨率
                },
              });

              this.logger.log(`图片已转换为 base64: ${imageFile.originalName} (${Math.round(buffer.length / 1024)} KB)`);
            } catch (error) {
              this.logger.error(`读取图片失败: ${imageFile.originalName}`, error);
              // 如果图片读取失败，添加到文本说明中
              contentParts[0] = {
                type: 'text',
                text: (contentParts[0] as TextContent).text + `\n\n[注意: 图片 ${imageFile.originalName} 读取失败]`,
              };
            }
          }

          // 注意：DeepSeek API 不支持多模态/视觉输入
          // 如果有图片，需要提示用户当前模型不支持图片查看
          if (imageFiles.length > 0) {
            // TODO: 未来可以接入支持视觉的模型（如 GPT-4V、Claude 等）
            // 目前 DeepSeek 不支持 image_url 类型，改为文本提示
            const imageNames = imageFiles.map(f => f.originalName).join(', ');
            textMessage = `${message}\n\n[系统提示: 您上传了图片 (${imageNames})，但当前使用的 DeepSeek 模型不支持图片查看功能。如需图片分析，请切换到支持视觉的模型。]`;
            finalMessage = textMessage;
            this.logger.warn(`DeepSeek 不支持图片，已转为文本提示: ${imageNames}`);
          } else {
            finalMessage = textMessage;
          }
        }
      }

      // 4. 获取会话历史消息（从 Mastra Memory）
      // P0-2 说明：Mastra Memory 存储消息但不会自动加载到上下文
      // 因此需要手动获取历史并传递给 Agent
      const history = await this.mastraAgentService.getThreadMessages(sessionId, client.userId);

      // 转换为 Agent 消息格式
      // P0-2 修复：限制历史消息数量，避免超出 token 窗口
      // 注意：getThreadMessages 返回的历史不包含当前消息，所以不需要 slice(-1)
      const maxHistoryMessages = 20; // 最多保留 20 条历史消息
      const historySlice = history.slice(-maxHistoryMessages); // 取最近 20 条
      const resumeMessages: Message[] = historySlice.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }));

      this.logger.log(`[P0-2] 加载 ${resumeMessages.length} 条历史消息 (总计 ${history.length})`);
      // 详细日志：显示历史消息内容（前 200 字符）
      if (resumeMessages.length > 0) {
        this.logger.log(`[P0-2] 历史消息: ${JSON.stringify(resumeMessages.map(m => ({ role: m.role, content: m.content.slice(0, 100) })))}`);
      }

      // 5. 注册活跃流式会话
      const streamInfo = { shouldStop: false };
      this.activeStreams.set(sessionId, streamInfo);

      // 6. 使用 Mastra Agent 处理消息
      let fullContent = '';
      const toolCallsExecuted: Array<{ call: ToolCall; result: ToolResult }> = [];

      try {
        const response = await this.mastraAgentService.chatWithCallbacks(
          sessionId,
          client.userId,
          finalMessage,
          {
            onText: (text) => {
              if (streamInfo.shouldStop) return;

              fullContent += text;
              this.logger.log(`[文本流] 收到 ${text.length} 字符`);
              client.emit('chat:stream', {
                sessionId,
                type: 'text',
                content: text,
                done: false,
              });
            },
            onToolCall: (toolCall) => {
              if (streamInfo.shouldStop) return;

              this.logger.log(`工具调用: ${toolCall.name}`);
              client.emit('chat:stream', {
                sessionId,
                type: 'tool_call',
                toolCall: {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: toolCall.arguments,
                },
                done: false,
              });
            },
            onToolResult: (toolCall, result) => {
              if (streamInfo.shouldStop) return;

              toolCallsExecuted.push({ call: toolCall, result });

              // result结构: { id, name, result: 工具的实际返回值 }
              const actualResult = result.result || result;
              const isSuccess = actualResult.success !== false; // 默认成功

              this.logger.log(`工具结果: ${toolCall.name} - ${isSuccess ? '成功' : '失败'}`);

              // 特殊处理 Workbench 工具
              if (toolCall.name === 'workbench') {
                this.logger.log(`[Workbench] actualResult 结构: ${JSON.stringify(actualResult).slice(0, 500)}`);

                if (actualResult.schema) {
                  // 推送 Workbench Schema 到前端
                  client.emit('workbench:update', {
                    sessionId,
                    schema: actualResult.schema,
                  });
                  this.logger.log(`Workbench Schema 已推送到前端`);
                } else {
                  this.logger.error(`[Workbench] schema 字段不存在！actualResult: ${JSON.stringify(actualResult)}`);
                }
              }

              client.emit('chat:stream', {
                sessionId,
                type: 'tool_result',
                toolResult: {
                  toolCallId: toolCall.id,
                  name: toolCall.name,
                  success: isSuccess,
                  output: actualResult.message || actualResult.output || JSON.stringify(actualResult).slice(0, 500),
                  error: actualResult.error,
                },
                done: false,
              });
            },
            onTokenUsage: (usage) => {
              client.emit('chat:token_usage', {
                sessionId,
                usage,
              });
            },
            onDone: async (content) => {
              // 清理活跃会话
              this.activeStreams.delete(sessionId);

              this.logger.log(`[完成] 总内容长度: ${content?.length || 0} 字符, 工具调用: ${toolCallsExecuted.length} 次`);

              // AI 响应已由 Mastra Memory 自动存储，无需手动保存到 PostgreSQL

              // 发送完成信号
              client.emit('chat:stream', {
                sessionId,
                type: 'done',
                content: '',
                done: true,
                stopped: streamInfo.shouldStop,
                toolCallsCount: toolCallsExecuted.length,
              });
            },
            onError: (error) => {
              // 清理活跃会话
              this.activeStreams.delete(sessionId);

              this.logger.error('Agent 执行失败:', error);
              client.emit('chat:stream', {
                sessionId,
                type: 'error',
                content: `\n\n[错误] AI 响应失败: ${error.message}`,
                done: true,
              });
            },
          },
          {
            // P0-2 修复：限制历史消息数量，避免 token 窗口溢出
            resumeMessages: resumeMessages.length > 0 ? resumeMessages : undefined,
          }
        );

        return { success: true, toolCallsCount: response.toolCalls.length };
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message === '用户中断') {
          return { success: true, stopped: true };
        }
        throw error;
      }
    } catch (error: any) {
      this.logger.error('处理聊天消息失败:', error);
      return { success: false, error: error.message || '处理失败' };
    }
  }

  /**
   * 处理 AgentNetwork 多 Agent 协作消息
   */
  private async handleNetworkMessage(
    client: AuthenticatedSocket,
    sessionId: string,
    message: string,
    workbenchContext?: string,
  ) {
    this.logger.log(`[AgentNetwork] 启动多 Agent 协作: sessionId=${sessionId}`);

    let finalMessage = message;
    if (workbenchContext) {
      finalMessage = `${workbenchContext}\n\n---\n\n用户消息: ${message}`;
    }

    // 注册活跃流式会话
    const streamInfo = { shouldStop: false };
    this.activeStreams.set(sessionId, streamInfo);

    try {
      await this.mastraAgentService.networkChat(
        sessionId,
        client.userId!,
        finalMessage,
        {
          onText: (text) => {
            if (streamInfo.shouldStop) return;
            client.emit('chat:stream', {
              sessionId,
              type: 'text',
              content: text,
              done: false,
            });
          },
          onToolCall: (toolCall) => {
            if (streamInfo.shouldStop) return;
            client.emit('chat:stream', {
              sessionId,
              type: 'tool_call',
              toolCall,
              done: false,
            });
          },
          onToolResult: (toolCall, result) => {
            if (streamInfo.shouldStop) return;

            // 特殊处理 Workbench 工具
            if (toolCall?.name === 'workbench') {
              const actualResult = result?.result || result;
              if (actualResult?.schema) {
                client.emit('workbench:update', {
                  sessionId,
                  schema: actualResult.schema,
                });
              }
            }

            client.emit('chat:stream', {
              sessionId,
              type: 'tool_result',
              toolResult: {
                toolCallId: toolCall?.id,
                name: toolCall?.name,
                success: true,
                output: JSON.stringify(result?.result || result).slice(0, 500),
              },
              done: false,
            });
          },
          onDone: (_content) => {
            this.activeStreams.delete(sessionId);
            client.emit('chat:stream', {
              sessionId,
              type: 'done',
              content: '',
              done: true,
              stopped: streamInfo.shouldStop,
            });
          },
          onError: (error) => {
            this.activeStreams.delete(sessionId);
            client.emit('chat:stream', {
              sessionId,
              type: 'error',
              content: `\n\n[错误] AgentNetwork 执行失败: ${error.message}`,
              done: true,
            });
          },
          onIterationComplete: (context) => {
            // 通知前端当前正在使用哪个 Agent
            client.emit('chat:stream', {
              sessionId,
              type: 'status',
              status: 'agent_switch',
              message: `Agent "${context.primitiveId}" 处理中 (迭代 ${context.iteration})`,
              done: false,
            });
          },
        },
      );

      return { success: true, mode: 'network' };
    } catch (error: any) {
      this.activeStreams.delete(sessionId);
      this.logger.error('[AgentNetwork] 处理失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理路由到 Client Agent 的消息
   * 当用户选择了本地电脑作为工作路径时，消息会被路由到 Client Agent 执行
   */
  private async handleClientAgentMessage(
    client: AuthenticatedSocket,
    data: {
      sessionId: string;
      message: string;
      deviceId: string;
      workDir?: string;
      fileIds?: string[];
      workbenchContext?: string;
    },
  ) {
    const { sessionId, message, deviceId, workDir, fileIds, workbenchContext } = data;

    this.logger.log(`[Client Agent] 路由任务到设备 ${deviceId}`);

    try {
      // 1. 检查 Agent 是否在线
      if (!this.agentService.isAgentOnline(deviceId)) {
        this.logger.warn(`[Client Agent] 设备 ${deviceId} 不在线`);
        client.emit('chat:stream', {
          sessionId,
          type: 'error',
          content: '❌ Client Agent 未连接。请确保 Agent 正在运行。',
          done: true,
        });
        return { success: false, error: 'Agent 不在线' };
      }

      // 2. 用户消息已由 Mastra Memory 自动存储，无需手动保存到 PostgreSQL

      // 3. 获取会话历史消息（从 Mastra Memory）
      const history = await this.mastraAgentService.getThreadMessages(sessionId, client.userId!);

      // 转换为简化的历史消息格式
      // P0-2 修复：与云端模式一致，限制历史消息数量，避免 token 窗口溢出
      // 注意：getThreadMessages 返回的历史不包含当前消息，所以不需要 slice(0, -1)
      const maxHistoryMessages = 20; // 最多保留 20 条历史消息
      const historyMessages = history.slice(-maxHistoryMessages).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }));

      this.logger.log(`[Client Agent] 携带 ${historyMessages.length} 条历史消息`);

      // 4. 生成任务 ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // 5. 构建任务（包含历史消息和 Workbench 上下文）
      this.logger.log(`[Client Agent] 构建任务: workDir="${workDir}", hasWorkbenchContext=${!!workbenchContext}`);
      const task = {
        taskId,
        sessionId,
        userId: client.userId,
        type: 'chat' as const,
        payload: {
          message,
          workDir,
          fileIds,
          // 携带历史消息，确保上下文连续性
          history: historyMessages.length > 0 ? historyMessages : undefined,
          // 携带 Workbench 上下文，让 AI 知道用户正在看什么
          workbenchContext: workbenchContext || undefined,
        },
      };

      // 6. 注册活跃流式会话
      const streamInfo = { shouldStop: false };
      this.activeStreams.set(sessionId, streamInfo);

      // 7. 分发任务到 Client Agent
      const success = await this.agentService.dispatchTaskToAgent(deviceId, task);

      if (!success) {
        this.activeStreams.delete(sessionId);
        client.emit('chat:stream', {
          sessionId,
          type: 'error',
          content: '❌ 任务下发失败，请稍后重试。',
          done: true,
        });
        return { success: false, error: '任务下发失败' };
      }

      this.logger.log(`[Client Agent] 任务 ${taskId} 已下发到设备 ${deviceId}`);

      // 通知前端任务已开始（使用 status 类型，前端可以选择如何展示）
      client.emit('chat:stream', {
        sessionId,
        type: 'status',
        status: 'started',
        message: '正在通过 Client Agent 执行任务...',
        done: false,
      });

      return { success: true, taskId, routed: 'client-agent' };
    } catch (error: any) {
      this.logger.error('[Client Agent] 处理失败:', error);
      client.emit('chat:stream', {
        sessionId,
        type: 'error',
        content: `❌ 任务处理失败: ${error.message}`,
        done: true,
      });
      return { success: false, error: error.message };
    }
  }

  // 向指定用户发送消息
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // 向指定 Agent 发送命令
  emitToAgent(agentId: string, event: string, data: any) {
    const socketId = this.agentSockets.get(agentId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // ============================================================================
  // 文件操作（路由到 Client Agent）
  // ============================================================================

  /**
   * 处理文件读取请求
   * 路由到 Client Agent 执行
   */
  @SubscribeMessage('file:read')
  async handleFileRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      filePath: string;
      encoding?: string;
      deviceId?: string;
    },
  ) {
    if (!client.userId) {
      return { success: false, error: '未认证' };
    }

    const { filePath, encoding, deviceId } = data;

    if (!deviceId) {
      // 没有 deviceId，返回错误
      client.emit('file:content', {
        filePath,
        error: '未选择设备，请先切换到本地模式',
      });
      return { success: false, error: '未选择设备' };
    }

    // 检查 Agent 是否在线
    if (!this.agentService.isAgentOnline(deviceId)) {
      client.emit('file:content', {
        filePath,
        error: 'Client Agent 未连接',
      });
      return { success: false, error: 'Agent 不在线' };
    }

    // 构建任务
    const taskId = `file_read_${Date.now()}`;
    const task = {
      taskId,
      type: 'file:read' as const,
      payload: {
        filePath,
        encoding: encoding || 'utf-8',
      },
      // 回传信息
      replyTo: {
        userId: client.userId,
        socketId: client.id,
        event: 'file:content',
      },
    };

    // 分发到 Client Agent
    const success = await this.agentService.dispatchTaskToAgent(deviceId, task);

    if (!success) {
      client.emit('file:content', {
        filePath,
        error: '任务下发失败',
      });
      return { success: false, error: '任务下发失败' };
    }

    this.logger.log(`[File] 文件读取任务 ${taskId} 已下发: ${filePath}`);
    return { success: true, taskId };
  }

  /**
   * 处理文件列表请求
   * 路由到 Client Agent 执行
   */
  @SubscribeMessage('file:list')
  async handleFileList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      rootPath: string;
      patterns?: string[];
      deviceId?: string;
    },
  ) {
    if (!client.userId) {
      return { success: false, error: '未认证' };
    }

    const { rootPath, patterns, deviceId } = data;

    if (!deviceId) {
      client.emit('file:list', {
        rootPath,
        files: [],
        error: '未选择设备，请先切换到本地模式',
      });
      return { success: false, error: '未选择设备' };
    }

    // 检查 Agent 是否在线
    if (!this.agentService.isAgentOnline(deviceId)) {
      client.emit('file:list', {
        rootPath,
        files: [],
        error: 'Client Agent 未连接',
      });
      return { success: false, error: 'Agent 不在线' };
    }

    // 构建任务
    const taskId = `file_list_${Date.now()}`;
    const task = {
      taskId,
      type: 'file:list' as const,
      payload: {
        rootPath,
        patterns,
      },
      replyTo: {
        userId: client.userId,
        socketId: client.id,
        event: 'file:list',
      },
    };

    // 分发到 Client Agent
    const success = await this.agentService.dispatchTaskToAgent(deviceId, task);

    if (!success) {
      client.emit('file:list', {
        rootPath,
        files: [],
        error: '任务下发失败',
      });
      return { success: false, error: '任务下发失败' };
    }

    this.logger.log(`[File] 文件列表任务 ${taskId} 已下发: ${rootPath}`);
    return { success: true, taskId };
  }

  /**
   * 处理文件写入请求
   * 路由到 Client Agent 执行
   */
  @SubscribeMessage('file:write')
  async handleFileWrite(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      filePath: string;
      content: string;
      encoding?: string;
      deviceId?: string;
    },
  ) {
    if (!client.userId) {
      return { success: false, error: '未认证' };
    }

    const { filePath, content, encoding, deviceId } = data;

    if (!deviceId) {
      client.emit('file:writeResult', {
        filePath,
        success: false,
        error: '未选择设备，请先切换到本地模式',
      });
      return { success: false, error: '未选择设备' };
    }

    // 检查 Agent 是否在线
    if (!this.agentService.isAgentOnline(deviceId)) {
      client.emit('file:writeResult', {
        filePath,
        success: false,
        error: 'Client Agent 未连接',
      });
      return { success: false, error: 'Agent 不在线' };
    }

    // 构建任务
    const taskId = `file_write_${Date.now()}`;
    const task = {
      taskId,
      type: 'file:write' as const,
      payload: {
        filePath,
        content,
        encoding: encoding || 'utf-8',
      },
      replyTo: {
        userId: client.userId,
        socketId: client.id,
        event: 'file:writeResult',
      },
    };

    // 分发到 Client Agent
    const success = await this.agentService.dispatchTaskToAgent(deviceId, task);

    if (!success) {
      client.emit('file:writeResult', {
        filePath,
        success: false,
        error: '任务下发失败',
      });
      return { success: false, error: '任务下发失败' };
    }

    this.logger.log(`[File] 文件写入任务 ${taskId} 已下发: ${filePath}`);
    return { success: true, taskId };
  }
}
