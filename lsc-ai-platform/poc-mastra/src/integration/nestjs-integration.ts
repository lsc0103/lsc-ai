/**
 * NestJS Gateway 集成模式示例
 *
 * 展示 Mastra Agent 如何与 NestJS Gateway 集成
 * 这是一个模式示例，展示实际集成方式
 */

import { Agent } from "@mastra/core/agent";
import { deepseek } from "@ai-sdk/deepseek";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

/**
 * 模拟 NestJS 的 AgentService
 * 在实际 NestJS 项目中，这将是一个 @Injectable() 服务
 */
export class AgentService {
  private agents: Map<string, Agent> = new Map();
  private storage: LibSQLStore;
  private memory: Memory;

  constructor() {
    // 初始化存储（PoC 使用内存数据库，生产环境使用 LibSQL 或其他存储）
    this.storage = new LibSQLStore({
      id: "lsc-ai-storage",
      url: ":memory:",
    });

    // 初始化 Memory
    this.memory = new Memory({
      storage: this.storage,
      options: {
        lastMessages: 50,
      },
    });

    // 注册默认 Agent
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    // Platform Agent - 用于平台端交互
    const platformAgent = new Agent({
      name: "platform-agent",
      instructions: `你是 LSC-AI 平台助手，负责帮助用户完成各种任务。
你可以：
1. 生成 Workbench Schema 展示代码、表格、图表等内容
2. 执行文件操作
3. 回答用户问题

请用中文回复。`,
      model: deepseek("deepseek-chat"),
      memory: this.memory,
    });

    this.agents.set("platform", platformAgent);
  }

  /**
   * 获取 Agent 实例
   */
  getAgent(type: string): Agent | undefined {
    return this.agents.get(type);
  }

  /**
   * 处理聊天请求 - 返回完整响应
   */
  async chat(params: {
    agentType: string;
    message: string;
    threadId: string;
    resourceId: string;
  }) {
    const agent = this.getAgent(params.agentType);
    if (!agent) {
      throw new Error(`Agent type "${params.agentType}" not found`);
    }

    const result = await agent.generate(params.message, {
      memory: {
        thread: params.threadId,
        resource: params.resourceId,
      },
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls,
    };
  }

  /**
   * 处理聊天请求 - 流式响应
   * 这是与 WebSocket Gateway 集成的关键方法
   */
  async *chatStream(params: {
    agentType: string;
    message: string;
    threadId: string;
    resourceId: string;
  }): AsyncGenerator<{ type: string; data: any }> {
    const agent = this.getAgent(params.agentType);
    if (!agent) {
      throw new Error(`Agent type "${params.agentType}" not found`);
    }

    // 使用 stream 方法获取流式响应
    const stream = await agent.stream(params.message, {
      memory: {
        thread: params.threadId,
        resource: params.resourceId,
      },
    });

    // 遍历流并转换为 Gateway 可发送的格式
    for await (const chunk of stream.textStream) {
      yield {
        type: "text-delta",
        data: { content: chunk },
      };
    }

    // 发送完成信号
    yield {
      type: "finish",
      data: { reason: "stop" },
    };
  }
}

/**
 * 模拟 NestJS WebSocket Gateway
 * 在实际项目中，这将是一个 @WebSocketGateway() 类
 */
export class MockChatGateway {
  private agentService: AgentService;

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  /**
   * 处理 WebSocket 消息
   * 在实际 NestJS 中使用 @SubscribeMessage('chat') 装饰器
   */
  async handleChatMessage(
    client: MockWebSocketClient,
    payload: {
      message: string;
      agentType?: string;
      threadId: string;
      resourceId: string;
    }
  ) {
    const { message, agentType = "platform", threadId, resourceId } = payload;

    try {
      // 使用流式响应
      const stream = this.agentService.chatStream({
        agentType,
        message,
        threadId,
        resourceId,
      });

      for await (const chunk of stream) {
        client.emit("chat-response", chunk);
      }
    } catch (error) {
      client.emit("chat-error", {
        error: (error as Error).message,
      });
    }
  }
}

/**
 * 模拟 WebSocket 客户端
 */
export class MockWebSocketClient {
  private events: Array<{ event: string; data: any }> = [];

  emit(event: string, data: any) {
    this.events.push({ event, data });
    // 在实际应用中，这会通过 WebSocket 发送到客户端
    console.log(`[WebSocket] ${event}:`, JSON.stringify(data));
  }

  getEvents() {
    return this.events;
  }
}

/**
 * 导出服务工厂函数
 * 在实际 NestJS 中，这些会通过 DI 容器管理
 */
export function createServices() {
  const agentService = new AgentService();
  const chatGateway = new MockChatGateway(agentService);

  return {
    agentService,
    chatGateway,
  };
}
