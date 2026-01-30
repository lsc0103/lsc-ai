import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { formatWorkbenchContextForAI } from '../components/workbench';

// Token 刷新函数
async function refreshAccessToken(): Promise<string | null> {
  const authStore = useAuthStore.getState();
  const refreshToken = authStore.refreshToken;

  if (!refreshToken) {
    console.log('[Socket] 无 refreshToken，无法刷新');
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.error('[Socket] Token 刷新失败:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.accessToken) {
      // 更新 store 中的 token
      authStore.setTokens(data.accessToken, data.refreshToken || refreshToken);
      console.log('[Socket] Token 刷新成功');
      return data.accessToken;
    }
    return null;
  } catch (error) {
    console.error('[Socket] Token 刷新异常:', error);
    return null;
  }
}

// Socket.IO 客户端实例
let socket: Socket | null = null;

// 连接状态
let isConnected = false;
let isConnecting = false;
let isAuthenticated = false;
let authPromise: Promise<void> | null = null;

// 事件监听器引用，用于清理
const listeners: { event: string; handler: (...args: any[]) => void }[] = [];

// 当前活跃的流式会话
let activeStreamSession: string | null = null;
let activeStreamHandler: ((data: any) => void) | null = null;

/**
 * 获取 Socket 实例，如果未连接则自动连接
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * 连接 Socket.IO 服务器
 */
export function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // 已连接直接返回
    if (socket && isConnected) {
      resolve(socket);
      return;
    }

    // 正在连接中
    if (isConnecting) {
      const checkInterval = setInterval(() => {
        if (socket && isConnected) {
          clearInterval(checkInterval);
          resolve(socket);
        }
      }, 100);
      return;
    }

    isConnecting = true;

    // 创建 Socket 连接
    socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // 连接成功
    socket.on('connect', () => {
      console.log('[Socket] 连接成功:', socket?.id);
      isConnected = true;
      isConnecting = false;
      isAuthenticated = false;

      // 发送认证
      const token = useAuthStore.getState().accessToken;
      if (token && socket) {
        authPromise = new Promise<void>(async (authResolve, authReject) => {
          const attemptAuth = (authToken: string) => {
            socket!.emit('auth', { token: authToken }, async (response: { success: boolean; error?: string }) => {
              if (response.success) {
                console.log('[Socket] 认证成功');
                isAuthenticated = true;
                authResolve();
                resolve(socket!);
              } else {
                // 检查是否是 token 过期错误
                const isExpired = response.error?.toLowerCase().includes('expired') ||
                                  response.error?.toLowerCase().includes('jwt');

                if (isExpired) {
                  console.log('[Socket] Token 已过期，尝试刷新...');
                  const newToken = await refreshAccessToken();
                  if (newToken) {
                    // 使用新 token 重试认证
                    attemptAuth(newToken);
                    return;
                  }
                }

                console.error('[Socket] 认证失败:', response.error);
                isAuthenticated = false;
                authReject(new Error(response.error || '认证失败'));
                reject(new Error(response.error || '认证失败'));
              }
            });
          };
          attemptAuth(token);
        });
      } else {
        resolve(socket!);
      }
    });

    // 连接错误
    socket.on('connect_error', (error) => {
      console.error('[Socket] 连接错误:', error);
      isConnecting = false;
      reject(error);
    });

    // 断开连接
    socket.on('disconnect', (reason) => {
      console.log('[Socket] 断开连接:', reason);
      isConnected = false;
      isAuthenticated = false;
      authPromise = null;
    });

    // 重连成功
    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] 重连成功，尝试次数:', attemptNumber);
      isConnected = true;
      isAuthenticated = false;

      // 重新认证（同样使用 Promise 跟踪，支持 token 刷新）
      const token = useAuthStore.getState().accessToken;
      if (token && socket) {
        authPromise = new Promise<void>(async (authResolve) => {
          const attemptAuth = (authToken: string) => {
            socket!.emit('auth', { token: authToken }, async (response: { success: boolean; error?: string }) => {
              if (response.success) {
                console.log('[Socket] 重连后认证成功');
                isAuthenticated = true;
                authResolve();
              } else {
                // 检查是否是 token 过期错误
                const isExpired = response.error?.toLowerCase().includes('expired') ||
                                  response.error?.toLowerCase().includes('jwt');

                if (isExpired) {
                  console.log('[Socket] 重连时 Token 已过期，尝试刷新...');
                  const newToken = await refreshAccessToken();
                  if (newToken) {
                    attemptAuth(newToken);
                    return;
                  }
                }

                console.error('[Socket] 重连后认证失败:', response.error);
                isAuthenticated = false;
                authResolve();
              }
            });
          };
          attemptAuth(token);
        });
      }
    });
  });
}

/**
 * 断开 Socket 连接
 */
export function disconnectSocket(): void {
  if (socket) {
    // 移除所有监听器
    listeners.forEach(({ event, handler }) => {
      socket?.off(event, handler);
    });
    listeners.length = 0;

    socket.disconnect();
    socket = null;
    isConnected = false;
    isConnecting = false;
    isAuthenticated = false;
    authPromise = null;
    console.log('[Socket] 已断开连接');
  }
}

/**
 * 工具调用信息
 */
interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * 工具结果信息
 */
interface ToolResultInfo {
  toolCallId: string;
  name: string;
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * 发送聊天消息并接收流式响应
 * 支持工具调用和文件附件
 * 支持路由到 Client Agent（当指定 deviceId 时）
 */
export async function sendChatMessage(
  sessionId: string,
  message: string,
  callbacks: {
    onStart?: () => void;
    onChunk?: (content: string) => void;
    onToolCall?: (toolCall: ToolCallInfo) => void;
    onToolResult?: (result: ToolResultInfo) => void;
    onDone?: (fullContent: string, toolCallsCount?: number) => void;
    onError?: (error: string) => void;
  } = {},
  options?: {
    fileIds?: string[];
    // 新增：Client Agent 路由参数
    deviceId?: string;
    workDir?: string;
  },
): Promise<void> {
  const { onStart, onChunk, onToolCall, onToolResult, onDone, onError } = callbacks;
  const chatStore = useChatStore.getState();

  try {
    // 确保已连接
    const sock = await connectSocket();

    // 确保已认证（等待认证完成）
    if (authPromise) {
      await authPromise;
    }

    // 如果未认证，尝试重新认证（支持 token 刷新）
    if (!isAuthenticated) {
      let token = useAuthStore.getState().accessToken;
      if (token && sock) {
        console.log('[Socket] 消息发送前重新认证...');
        await new Promise<void>(async (resolve, reject) => {
          const attemptAuth = (authToken: string) => {
            sock.emit('auth', { token: authToken }, async (response: { success: boolean; error?: string }) => {
              if (response.success) {
                console.log('[Socket] 重新认证成功');
                isAuthenticated = true;
                resolve();
              } else {
                // 检查是否是 token 过期错误
                const isExpired = response.error?.toLowerCase().includes('expired') ||
                                  response.error?.toLowerCase().includes('jwt');

                if (isExpired) {
                  console.log('[Socket] Token 已过期，尝试刷新...');
                  const newToken = await refreshAccessToken();
                  if (newToken) {
                    attemptAuth(newToken);
                    return;
                  }
                }

                console.error('[Socket] 重新认证失败:', response.error);
                reject(new Error(response.error || '认证失败'));
              }
            });
          };
          attemptAuth(token);
        });
      }
    }

    // 开始接收
    onStart?.();
    chatStore.setLoading(true);
    chatStore.clearStreamingContent();

    // 累积完整内容
    let fullContent = '';
    let toolCallsCount = 0;
    let isStopped = false;

    // RAF 批量更新文本内容
    let textBuffer = '';
    let rafId: number | null = null;

    const flushTextBuffer = () => {
      if (textBuffer) {
        chatStore.appendStreamingContent(textBuffer);
        onChunk?.(textBuffer);
        textBuffer = '';
      }
      rafId = null;
    };

    // 跟踪已预测的工具（避免重复添加）
    const pendingTools = new Set<string>();

    // 工具关键词检测（更精确的模式匹配）
    const detectToolMention = (text: string) => {
      const toolPatterns = [
        {
          // Workbench 工具 - 需要明确的展示意图
          patterns: [
            /在\s*workbench\s*(里|中|上)\s*(展示|显示)/i,
            /用\s*workbench\s*(展示|显示)/i,
            /workbench\s*(展示|显示)/i,
          ],
          toolName: 'workbench'
        },
        {
          // Web 搜索 - 明确的搜索意图
          patterns: [
            /(网上|网络|上网)\s*(搜索|查询|查找)/,
            /web\s*search/i,
          ],
          toolName: 'webSearch'
        },
        {
          // Web 抓取
          patterns: [
            /获取\s*(网页|页面)/,
            /抓取\s*(网页|页面)/,
            /web\s*fetch/i,
          ],
          toolName: 'webFetch'
        },
      ];

      for (const { patterns, toolName } of toolPatterns) {
        if (!pendingTools.has(toolName) && patterns.some(pattern => pattern.test(text))) {
          return toolName;
        }
      }
      return null;
    };

    // 监听流式响应（支持新的消息类型）
    const streamHandler = (data: {
      sessionId: string;
      type?: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'status';
      content?: string;
      toolCall?: ToolCallInfo;
      toolResult?: ToolResultInfo;
      done?: boolean;
      stopped?: boolean;
      toolCallsCount?: number;
      status?: string;
      message?: string;
    }) => {
      if (data.sessionId !== sessionId) return;

      // 处理不同类型的消息
      const msgType = data.type || (data.done ? 'done' : 'text');

      switch (msgType) {
        case 'text':
          // 文本内容 - 使用 RAF 批量更新
          if (data.content && !isStopped) {
            fullContent += data.content;
            textBuffer += data.content;

            // 检测工具提及 - 立即显示工具卡片
            const mentionedTool = detectToolMention(fullContent);
            if (mentionedTool) {
              pendingTools.add(mentionedTool);
              console.log('[Socket] 检测到工具提及:', mentionedTool);

              // 添加一个 pending 状态的工具步骤
              chatStore.addToolStep({
                id: `pending-${mentionedTool}-${Date.now()}`,
                name: mentionedTool,
                arguments: {},
                status: 'running',
                startTime: Date.now(),
              });
            }

            // 如果没有 pending 的更新，用 RAF 调度
            if (!rafId) {
              rafId = requestAnimationFrame(flushTextBuffer);
            }
          }
          break;

        case 'tool_call':
          // 工具调用开始 - 使用结构化数据而非文本
          if (data.toolCall) {
            toolCallsCount++;
            console.log('[Socket] 工具调用:', data.toolCall.name);

            // 检查是否已经有 pending 的同名工具
            const currentSteps = useChatStore.getState().streamingToolSteps;
            const pendingStep = currentSteps.find(
              s => s.name === data.toolCall!.name && s.id.startsWith('pending-')
            );

            if (pendingStep) {
              // 移除 pending 步骤，添加真实步骤
              console.log('[Socket] 替换 pending 工具步骤为真实步骤:', data.toolCall.name);
              chatStore.removeToolStep(pendingStep.id);
            }

            // 添加真实的工具步骤
            chatStore.addToolStep({
              id: data.toolCall.id || `tool-${Date.now()}-${toolCallsCount}-${Math.random().toString(36).substring(2, 8)}`,
              name: data.toolCall.name,
              arguments: data.toolCall.arguments,
              status: 'running',
              startTime: Date.now(),
            });

            // 从 pending 集合中移除
            pendingTools.delete(data.toolCall.name);
            onToolCall?.(data.toolCall);
          }
          break;

        case 'tool_result':
          // 工具调用结果 - 更新对应的工具步骤
          if (data.toolResult) {
            console.log('[Socket] 工具结果:', data.toolResult.name, data.toolResult.success ? '成功' : '失败');
            // 更新工具步骤状态
            const currentSteps = useChatStore.getState().streamingToolSteps;
            // 找到最后一个同名的 running 状态的步骤
            const stepToUpdate = [...currentSteps].reverse().find(
              (s) => s.name === data.toolResult!.name && s.status === 'running'
            );
            if (stepToUpdate) {
              chatStore.updateToolStep(stepToUpdate.id, {
                status: data.toolResult.success ? 'completed' : 'failed',
                result: data.toolResult.output,
                error: data.toolResult.error,
                endTime: Date.now(),
              });
            }
            onToolResult?.(data.toolResult);
          }
          break;

        case 'status':
          // 状态消息（不持久化，仅显示状态）
          console.log('[Socket] 状态:', data.status, data.message);
          // 状态消息不添加到 streamingContent，让 UI 层通过 isLoading 状态显示
          break;

        case 'done':
          // 流式结束 - 先刷新缓冲区
          if (rafId) {
            cancelAnimationFrame(rafId);
            flushTextBuffer();
          }

          activeStreamSession = null;
          activeStreamHandler = null;

          // 重要：获取最新状态，避免使用过期的状态引用
          const currentStore = useChatStore.getState();
          currentStore.setLoading(false);

          // 将流式内容和工具步骤转为正式消息
          const finalContent = currentStore.streamingContent;
          const finalToolSteps = currentStore.streamingToolSteps;

          if (finalContent || finalToolSteps.length > 0) {
            currentStore.addMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: finalContent + (data.stopped ? '\n\n[已停止生成]' : ''),
              toolSteps: finalToolSteps.length > 0 ? [...finalToolSteps] : undefined,
              createdAt: new Date().toISOString(),
            });
          }

          currentStore.clearStreamingContent();
          currentStore.clearToolSteps();
          onDone?.(fullContent, data.toolCallsCount || toolCallsCount);

          // 移除监听器
          sock.off('chat:stream', streamHandler);
          sock.off('workbench:update', workbenchHandler);
          break;

        case 'error':
          // 错误 - 先刷新缓冲区，然后获取最新状态
          if (rafId) {
            cancelAnimationFrame(rafId);
            flushTextBuffer();
          }

          const errorStore = useChatStore.getState();
          errorStore.setLoading(false);
          activeStreamSession = null;
          activeStreamHandler = null;
          errorStore.clearStreamingContent();
          errorStore.clearToolSteps();
          sock.off('chat:stream', streamHandler);
          sock.off('workbench:update', workbenchHandler);
          onError?.(data.content || '未知错误');
          break;

        default:
          // 兼容旧格式
          if (data.done || data.stopped) {
            activeStreamSession = null;
            activeStreamHandler = null;

            // 重要：获取最新状态
            const latestStore = useChatStore.getState();
            latestStore.setLoading(false);

            // 使用最新的 streamingContent 和 toolSteps
            const content = latestStore.streamingContent || fullContent;
            const toolStepsForDefault = latestStore.streamingToolSteps;

            if (content || toolStepsForDefault.length > 0) {
              latestStore.addMessage({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: content + (data.stopped ? '\n\n[已停止生成]' : ''),
                toolSteps: toolStepsForDefault.length > 0 ? [...toolStepsForDefault] : undefined,
                createdAt: new Date().toISOString(),
              });
            }

            latestStore.clearStreamingContent();
            latestStore.clearToolSteps();
            onDone?.(fullContent);
            sock.off('chat:stream', streamHandler);
            sock.off('workbench:update', workbenchHandler);
          } else if (data.content && !isStopped) {
            fullContent += data.content;
            chatStore.appendStreamingContent(data.content);
            onChunk?.(data.content);
          }
      }
    };

    // 监听 Workbench 更新（在注册streamHandler之前）
    const workbenchHandler = async (data: { sessionId: string; schema: any }) => {
      if (data.sessionId !== sessionId) return;

      console.log('[Socket] 收到 Workbench 更新:', data.schema);

      try {
        // 使用统一的 schema 转换器
        const { ensureNewSchema } = await import('../components/workbench/schema/schema-transformer');
        const { validateWorkbenchSchema } = await import('../components/workbench/schema/validator');
        const { useWorkbenchStore } = await import('../components/workbench');

        // 转换 schema（旧格式 -> 新格式）
        let transformedSchema;
        try {
          transformedSchema = ensureNewSchema(data.schema);
          console.log('[Socket] Schema 转换完成:', transformedSchema);
        } catch (error: any) {
          console.error('[Socket] Schema 转换失败:', error);
          return;
        }

        // 验证转换后的 schema
        const validationResult = validateWorkbenchSchema(transformedSchema);

        if (!validationResult.valid) {
          console.error('[Socket] Schema 验证失败!');
          console.error('[Socket] 验证错误:', validationResult.errors);
          console.error('[Socket] 原始 schema:', data.schema);
          console.error('[Socket] 转换后 schema:', transformedSchema);
          return;
        }

        // 更新 Workbench 状态
        const workbenchStore = useWorkbenchStore.getState();
        workbenchStore.loadState({
          schema: transformedSchema,
          visible: true,
          activeTabKey: transformedSchema.defaultActiveKey || transformedSchema.tabs[0]?.key || '',
        });

        console.log('[Socket] Workbench 状态已更新，visible=true, activeTabKey:', transformedSchema.defaultActiveKey);
      } catch (err) {
        console.error('[Socket] Workbench 更新失败:', err);
      }
    };

    sock.on('workbench:update', workbenchHandler);

    // 注册监听器
    sock.on('chat:stream', streamHandler);

    // 保存活跃会话引用和workbench handler
    activeStreamSession = sessionId;
    activeStreamHandler = streamHandler;

    // 获取 Workbench 上下文（让 AI 感知工作台状态）
    const workbenchContext = formatWorkbenchContextForAI();
    console.log('[Socket] Workbench 上下文:', workbenchContext ? `${workbenchContext.length} 字符` : '空');
    if (workbenchContext) {
      console.log('[Socket] Workbench 上下文内容:\n', workbenchContext);
    }

    // 发送消息（包含文件 IDs、Client Agent 路由参数和 Workbench 上下文）
    sock.emit(
      'chat:message',
      {
        sessionId,
        message,
        fileIds: options?.fileIds,
        // Client Agent 路由参数
        deviceId: options?.deviceId,
        workDir: options?.workDir,
        // Workbench 上下文（让 AI 知道用户正在看什么）
        workbenchContext: workbenchContext || undefined,
      },
      (response: { success: boolean; error?: string; routed?: string }) => {
        if (!response.success) {
          chatStore.setLoading(false);
          chatStore.clearStreamingContent();
          activeStreamSession = null;
          activeStreamHandler = null;
          sock.off('chat:stream', streamHandler);
          sock.off('workbench:update', workbenchHandler);
          onError?.(response.error || '发送失败');
        } else if (response.routed === 'client-agent') {
          console.log('[Socket] 消息已路由到 Client Agent');
        }
      },
    );
  } catch (error: any) {
    // 获取最新状态
    const catchStore = useChatStore.getState();
    catchStore.setLoading(false);
    catchStore.clearStreamingContent();
    activeStreamSession = null;
    activeStreamHandler = null;
    // 确保移除所有监听器
    if (socket) {
      socket.off('chat:stream');
      socket.off('workbench:update');
    }
    onError?.(error.message || '连接失败');
  }
}

/**
 * 停止当前的流式生成
 */
export async function stopGeneration(): Promise<void> {
  if (!activeStreamSession || !socket) {
    console.log('[Socket] 没有活跃的流式会话');
    return;
  }

  const chatStore = useChatStore.getState();

  // 发送停止信号到后端
  socket.emit('chat:stop', { sessionId: activeStreamSession }, (response: { success: boolean }) => {
    if (response.success) {
      console.log('[Socket] 已发送停止信号');
    }
  });

  // 前端立即处理停止
  chatStore.setLoading(false);

  // 将当前流式内容转为消息
  const streamingContent = chatStore.streamingContent;
  if (streamingContent) {
    chatStore.addMessage({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: streamingContent + '\n\n[已停止生成]',
      createdAt: new Date().toISOString(),
    });
  }

  chatStore.clearStreamingContent();

  // 移除监听器
  if (activeStreamHandler) {
    socket.off('chat:stream', activeStreamHandler);
  }

  activeStreamSession = null;
  activeStreamHandler = null;
}

/**
 * 检查是否已连接
 */
export function isSocketConnected(): boolean {
  return isConnected && socket?.connected === true;
}

// ============================================================================
// 命令执行输出监听（用于 Workbench 终端面板）
// ============================================================================

/** 命令执行回调 */
interface CommandExecutionCallbacks {
  onOutput?: (taskId: string, output: string) => void;
  onComplete?: (taskId: string, result: string) => void;
  onError?: (taskId: string, error: string) => void;
}

let commandExecutionCallbacks: CommandExecutionCallbacks | null = null;
let isCommandListenerRegistered = false;

/**
 * 注册命令执行监听器
 * 用于接收 Client Agent 执行命令的流式输出
 */
export function registerCommandListener(callbacks: CommandExecutionCallbacks): void {
  commandExecutionCallbacks = callbacks;

  if (isCommandListenerRegistered || !socket) return;

  // 监听命令流式输出
  socket.on('command:stream', (data: { taskId: string; content: string }) => {
    console.log('[Socket] 命令输出:', data.taskId, data.content?.substring(0, 50));
    commandExecutionCallbacks?.onOutput?.(data.taskId, data.content);
  });

  // 监听命令完成
  socket.on('command:complete', (data: { taskId: string; result: string }) => {
    console.log('[Socket] 命令完成:', data.taskId);
    commandExecutionCallbacks?.onComplete?.(data.taskId, data.result);
  });

  // 监听命令错误
  socket.on('command:error', (data: { taskId: string; error: string }) => {
    console.log('[Socket] 命令错误:', data.taskId, data.error);
    commandExecutionCallbacks?.onError?.(data.taskId, data.error);
  });

  // 也监听 agent 的通用流式输出（chat:stream 可能也会包含命令输出）
  // 针对 execute 类型任务的输出
  socket.on('execute:stream', (data: { taskId: string; content: string }) => {
    console.log('[Socket] Execute 输出:', data.taskId, data.content?.substring(0, 50));
    commandExecutionCallbacks?.onOutput?.(data.taskId, data.content);
  });

  socket.on('execute:complete', (data: { taskId: string; result: string; status: string }) => {
    console.log('[Socket] Execute 完成:', data.taskId, data.status);
    if (data.status === 'completed') {
      commandExecutionCallbacks?.onComplete?.(data.taskId, data.result || '命令执行完成');
    } else if (data.status === 'failed') {
      commandExecutionCallbacks?.onError?.(data.taskId, data.result || '命令执行失败');
    }
  });

  isCommandListenerRegistered = true;
  console.log('[Socket] 命令执行监听器已注册');
}

/**
 * 取消注册命令执行监听器
 */
export function unregisterCommandListener(): void {
  commandExecutionCallbacks = null;
  // 注意：不移除 socket 上的监听器，因为可能有多个组件需要
}
