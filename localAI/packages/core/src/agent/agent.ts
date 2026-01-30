import type { LLMProvider, Message, ToolCall, StreamChunk, LLMRequestOptions, MessageContent, TextContent, ImageContent, TokenUsage } from '../llm/types.js';
import type { Tool, ToolResult, DiffPreview } from '../tools/types.js';
import { getSystemPrompt, wrapUserMessage, wrapUserMessageContent, type SystemPromptOptions } from './prompts.js';
import { detectProjectContext, type ProjectContext } from './projectContext.js';
import { needsCompression, compressMessagesAsync, type CompressionConfig } from './contextCompression.js';
import { ContentClassifier, type ClassifiedContent, type ClassifierConfig, ContentType } from '../classifier/index.js';
import { planManager } from './planMode.js';
import { UserRejectedError } from '../tools/errors.js';
import { generateAgentId, type AgentSnapshot, type SemanticPermission, matchSemanticPermission } from '../config/session.js';

/**
 * Agent 请求选项
 */
export interface AgentRequestOptions {
  /** 用于中断请求的 AbortSignal */
  signal?: AbortSignal;
}

/**
 * 确认回调返回值类型
 */
export type ConfirmResult = 'yes' | 'no' | 'always';

/**
 * 需要用户确认的敏感工具列表
 */
export const SENSITIVE_TOOLS = ['write', 'edit'];

/**
 * 计划模式中允许的只读工具
 */
const PLAN_MODE_ALLOWED_TOOLS = [
  'read', 'glob', 'grep', 'ls', 'gitStatus', 'gitDiff', 'gitLog', 'gitBranch',
  'readPlan', 'updatePlan', 'exitPlanMode', 'approvePlan', 'rejectPlan',
  'askUser', 'todoWrite',
];

/**
 * 安全的 bash 命令前缀（不需要确认）
 */
const SAFE_BASH_COMMANDS = [
  'ls', 'cat', 'head', 'tail', 'pwd', 'echo', 'which', 'whoami',
  'find', 'grep', 'rg', 'ag', 'fd', 'tree', 'wc', 'sort', 'uniq',
  'diff', 'file', 'stat', 'du', 'df', 'date', 'uname', 'env',
  'printenv', 'hostname', 'id', 'groups', 'type', 'command',
  'git status', 'git log', 'git diff', 'git branch', 'git show',
  'git remote', 'git config --get', 'git rev-parse',
  'node -v', 'npm -v', 'pnpm -v', 'yarn -v', 'npx -v',
  'python --version', 'python3 --version', 'pip --version',
  'cargo --version', 'rustc --version', 'go version',
  'java -version', 'javac -version',
];

/**
 * 检查 bash 命令是否安全（不需要确认）
 */
function isSafeBashCommand(command: string): boolean {
  const trimmed = command.trim();
  // 检查是否以安全命令开头
  return SAFE_BASH_COMMANDS.some(safe => {
    // 完全匹配或后面跟空格/参数
    return trimmed === safe || trimmed.startsWith(safe + ' ') || trimmed.startsWith(safe + '\t');
  });
}

/**
 * 技能信息
 */
export interface SkillInfo {
  name: string;
  description: string;
}

/**
 * MCP 工具信息
 */
export interface MCPToolInfo {
  name: string;
  server: string;
  description: string;
}

export interface AgentOptions {
  llm: LLMProvider;
  tools: Tool[];
  cwd?: string;
  /** 是否在系统提示词中显示工作目录（默认 true，Web 模式可设为 false） */
  showCwd?: boolean;
  /** 自定义系统提示词（如果提供，将完全替代内核默认提示词） */
  customSystemPrompt?: string;
  maxIterations?: number;
  isAdvancedModel?: boolean;
  /** 可用技能列表（用于注入提示词） */
  skills?: SkillInfo[];
  /** MCP 工具列表（用于注入提示词） */
  mcpTools?: MCPToolInfo[];
  /** 上下文压缩配置 */
  compressionConfig?: CompressionConfig;
  /** 是否启用上下文压缩 */
  enableCompression?: boolean;
  /** 内容分类器配置 */
  classifierConfig?: ClassifierConfig;
  /** 是否启用内容分类 */
  enableClassifier?: boolean;
  onText?: (text: string) => void;
  /** 分类后的文本回调（专业 UI 展示） */
  onClassifiedText?: (content: ClassifiedContent) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolCall: ToolCall, result: ToolResult) => void;
  /**
   * 工具执行前的确认回调（仅针对敏感工具）
   * 返回 'yes' 执行一次，'no' 拒绝，'always' 后续不再询问
   * @param toolCall 工具调用信息
   * @param preview Diff 预览信息（如果工具支持）
   */
  onToolConfirm?: (toolCall: ToolCall, preview?: DiffPreview) => Promise<ConfirmResult>;
  /** 压缩发生时的回调 */
  onCompression?: (stats: { before: number; after: number }) => void;
  /** Token 使用统计回调 */
  onTokenUsage?: (usage: TokenUsage) => void;
  /** 恢复用的 Agent 快照（可选） */
  snapshot?: AgentSnapshot;
  /** 恢复用的消息历史（可选） */
  resumeMessages?: Message[];
}

export interface AgentResponse {
  content: string;
  toolCalls: Array<{ call: ToolCall; result: ToolResult }>;
  /** 累计 Token 使用统计 */
  usage?: TokenUsage;
}

export class Agent {
  /** Agent 唯一标识符（用于恢复） */
  public readonly agentId: string;
  /** Agent 创建时间 */
  public readonly createdAt: number;

  private llm: LLMProvider;
  private tools: Map<string, Tool>;
  private messages: Message[] = [];
  private cwd: string;
  private showCwd: boolean;
  private customSystemPrompt?: string;
  private maxIterations: number;
  private isAdvancedModel: boolean;
  private skills: SkillInfo[];
  private mcpTools: MCPToolInfo[];
  private compressionConfig: CompressionConfig;
  private enableCompression: boolean;
  private classifier: ContentClassifier;
  private enableClassifier: boolean;
  private onText?: (text: string) => void;
  private onClassifiedText?: (content: ClassifiedContent) => void;
  private onToolCall?: (toolCall: ToolCall) => void;
  private projectContext?: ProjectContext;
  private projectContextReady: Promise<void>;
  private onToolResult?: (toolCall: ToolCall, result: ToolResult) => void;
  private onToolConfirm?: (toolCall: ToolCall, preview?: DiffPreview) => Promise<ConfirmResult>;
  private onCompression?: (stats: { before: number; after: number }) => void;
  private onTokenUsage?: (usage: TokenUsage) => void;
  private alwaysAllowedTools: Set<string> = new Set();
  /** 语义化权限列表（如 "run tests", "install dependencies"） */
  private semanticPermissions: SemanticPermission[] = [];
  private toolCallPending: boolean = false;
  private totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(options: AgentOptions) {
    this.llm = options.llm;
    this.tools = new Map(options.tools.map(t => [t.definition.name, t]));
    this.cwd = options.cwd || process.cwd();
    this.showCwd = options.showCwd ?? true;
    this.customSystemPrompt = options.customSystemPrompt;
    this.maxIterations = options.maxIterations || 20;
    this.isAdvancedModel = options.isAdvancedModel || false;
    this.skills = options.skills || [];
    this.mcpTools = options.mcpTools || [];
    this.compressionConfig = options.compressionConfig || {};
    this.enableCompression = options.enableCompression ?? true;
    this.enableClassifier = options.enableClassifier ?? true;
    this.classifier = new ContentClassifier(options.classifierConfig);
    this.onText = options.onText;
    this.onClassifiedText = options.onClassifiedText;
    this.onToolCall = options.onToolCall;
    this.onToolResult = options.onToolResult;
    this.onToolConfirm = options.onToolConfirm;
    this.onCompression = options.onCompression;
    this.onTokenUsage = options.onTokenUsage;

    // 从快照恢复或生成新的 Agent ID
    if (options.snapshot) {
      // 恢复模式：从快照恢复状态
      this.agentId = options.snapshot.agentId;
      this.createdAt = options.snapshot.createdAt;
      this.isAdvancedModel = options.snapshot.isAdvancedModel;
      this.alwaysAllowedTools = new Set(options.snapshot.alwaysAllowedTools);
      this.semanticPermissions = [...options.snapshot.allowedPrompts];
      this.totalUsage = { ...options.snapshot.tokenUsage };

      // 恢复项目上下文（如果有）
      if (options.snapshot.projectContext) {
        this.projectContext = options.snapshot.projectContext as ProjectContext;
      }
    } else {
      // 新建模式：生成新的 Agent ID
      this.agentId = generateAgentId();
      this.createdAt = Date.now();
    }

    // 恢复消息历史或初始化新的
    if (options.resumeMessages && options.resumeMessages.length > 0) {
      this.messages = [...options.resumeMessages];
    } else {
      // 先用基础提示词初始化
      this.messages.push({
        role: 'system',
        content: this.getSystemPromptContent(),
      });
    }

    // 异步初始化项目感知，并在完成后更新系统提示词
    this.projectContextReady = this.initProjectContext();
  }

  /**
   * 初始化项目感知上下文
   */
  private async initProjectContext(): Promise<void> {
    try {
      this.projectContext = await detectProjectContext(this.cwd);
      // 更新系统提示词，包含项目上下文
      this.updateSystemPrompt();
    } catch {
      // 项目感知失败不影响正常使用
    }
  }

  /**
   * 获取系统提示词内容
   * 如果设置了 customSystemPrompt，使用自定义提示词
   * 否则使用内核默认提示词
   */
  private getSystemPromptContent(): string {
    if (this.customSystemPrompt) {
      return this.customSystemPrompt;
    }
    return getSystemPrompt(this.cwd, {
      isAdvancedModel: this.isAdvancedModel,
      projectContext: this.projectContext,
      skills: this.skills,
      mcpTools: this.mcpTools,
      showCwd: this.showCwd,
    });
  }

  /**
   * 更新系统提示词
   */
  private updateSystemPrompt(): void {
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = this.getSystemPromptContent();
    }
  }

  /**
   * 更新技能列表
   */
  setSkills(skills: SkillInfo[]): void {
    this.skills = skills;
    this.updateSystemPrompt();
  }

  /**
   * 更新 MCP 工具列表
   */
  setMCPTools(mcpTools: MCPToolInfo[]): void {
    this.mcpTools = mcpTools;
    this.updateSystemPrompt();
  }

  /**
   * 获取项目上下文信息
   */
  getProjectContext(): ProjectContext | undefined {
    return this.projectContext;
  }

  /**
   * 等待项目上下文准备就绪
   */
  async waitForProjectContext(): Promise<ProjectContext | undefined> {
    await this.projectContextReady;
    return this.projectContext;
  }

  /**
   * 检查工具是否需要确认
   * 支持语义化权限检查（类似 Claude Code 的 allowedPrompts）
   */
  private needsConfirmation(toolCall: ToolCall): boolean {
    const { name, arguments: args } = toolCall;

    // 已经设置为始终允许的工具
    if (this.alwaysAllowedTools.has(name)) return false;

    // write/edit 工具：检查语义化权限
    if (SENSITIVE_TOOLS.includes(name)) {
      // 检查文件路径是否匹配语义化权限
      const filePath = String(args.file_path || args.path || '');
      const toolType = name as SemanticPermission['tool'];
      if (matchSemanticPermission(this.semanticPermissions, toolType, filePath)) {
        return false;
      }
      return true;
    }

    // bash 工具：检查命令是否安全或已被授权
    if (name === 'bash') {
      const command = String(args.command || '');

      // 安全命令不需要确认
      if (isSafeBashCommand(command)) return false;

      // 检查语义化权限
      if (matchSemanticPermission(this.semanticPermissions, 'bash', command)) {
        return false;
      }

      // 危险命令需要确认
      return true;
    }

    return false;
  }

  /**
   * 请求用户确认工具执行
   * 支持 Diff 预览确认机制
   * @returns true 如果允许执行，false 如果拒绝
   */
  private async confirmToolExecution(toolCall: ToolCall): Promise<boolean> {
    if (!this.needsConfirmation(toolCall)) return true;
    if (!this.onToolConfirm) return true; // 没有确认回调则默认允许

    // 获取工具并尝试生成预览
    const tool = this.tools.get(toolCall.name);
    let preview: DiffPreview | undefined;

    if (tool && typeof tool.getPreview === 'function') {
      try {
        const previewResult = await tool.getPreview(toolCall.arguments);
        if (previewResult) {
          preview = previewResult;
        }
      } catch {
        // 预览生成失败，继续不带预览的确认
      }
    }

    const result = await this.onToolConfirm(toolCall, preview);
    if (result === 'always') {
      this.alwaysAllowedTools.add(toolCall.name);
      return true;
    }
    return result === 'yes';
  }

  /**
   * 重置 always 权限（用于新会话）
   */
  resetPermissions(): void {
    this.alwaysAllowedTools.clear();
  }

  setAdvancedModel(isAdvanced: boolean): void {
    this.isAdvancedModel = isAdvanced;
    this.updateSystemPrompt();
  }

  private getToolDefinitions() {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      return { success: false, output: '', error: `未知工具: ${toolCall.name}` };
    }

    // 计划模式检查：只允许只读工具
    if (planManager.isInPlanMode() && !PLAN_MODE_ALLOWED_TOOLS.includes(toolCall.name)) {
      return {
        success: false,
        output: '',
        error: `[计划模式] 工具 "${toolCall.name}" 在计划模式中被禁用。只允许使用以下工具: ${PLAN_MODE_ALLOWED_TOOLS.join(', ')}`,
      };
    }

    try {
      // 自动注入 cwd 到支持的工具，确保工具使用正确的工作目录
      // 只有当工具参数中没有提供 cwd 时才注入
      const argsWithCwd = { ...toolCall.arguments };
      if (this.cwd && !argsWithCwd.cwd) {
        // 只为需要路径的工具注入 cwd
        const toolsNeedingCwd = ['Bash', 'Glob', 'Grep', 'Read', 'Write', 'Edit', 'ls', 'mkdir', 'cp', 'mv', 'rm'];
        if (toolsNeedingCwd.includes(toolCall.name)) {
          argsWithCwd.cwd = this.cwd;
        }
      }
      return await tool.execute(argsWithCwd);
    } catch (error) {
      return { success: false, output: '', error: `工具执行错误: ${(error as Error).message}` };
    }
  }

  /**
   * 确保消息历史格式正确
   * 解决多轮对话中消息顺序问题
   *
   * LLM API 要求：
   * 1. 每个 tool 消息的 tool_call_id 必须匹配某个前面 assistant 消息中的 tool_calls.id
   * 2. tool 消息组之后应该有一个 assistant 消息
   *
   * 这个方法会扫描并修复整个消息历史
   */
  private ensureValidMessageHistory(): void {
    if (this.messages.length === 0) return;

    // 收集所有有效的 tool_call_id（从 assistant 消息的 toolCalls 中）
    const validToolCallIds = new Set<string>();
    for (const msg of this.messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          validToolCallIds.add(tc.id);
        }
      }
    }

    // 过滤消息，移除没有匹配 tool_call_id 的 tool 消息
    const newMessages: Message[] = [];
    for (const msg of this.messages) {
      if (msg.role === 'tool') {
        if (!msg.toolCallId || !validToolCallIds.has(msg.toolCallId)) {
          console.warn(`[Agent] 跳过孤立的 tool 消息: ${msg.toolCallId}`);
          continue;
        }
      }
      newMessages.push(msg);
    }

    // 如果最后一条是 tool 消息，添加合成的 assistant 消息来关闭序列
    if (newMessages.length > 0) {
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg.role === 'tool') {
        let toolCount = 0;
        for (let j = newMessages.length - 1; j >= 0; j--) {
          if (newMessages[j].role === 'tool') {
            toolCount++;
          } else {
            break;
          }
        }
        newMessages.push({
          role: 'assistant',
          content: `[执行了 ${toolCount} 个工具调用，已完成]`,
        });
      }
    }

    this.messages = newMessages;
  }

  /**
   * 检查并执行上下文压缩
   */
  private async maybeCompress(): Promise<void> {
    if (!this.enableCompression) return;

    if (needsCompression(this.messages, this.compressionConfig)) {
      const beforeCount = this.messages.length;

      // 使用 LLM 智能压缩
      const result = await compressMessagesAsync(
        this.messages,
        this.llm,
        this.compressionConfig
      );
      this.messages = result.messages;

      const afterCount = this.messages.length;
      this.onCompression?.({ before: beforeCount, after: afterCount });
    }
  }

  async chat(userMessage: string | MessageContent, options?: AgentRequestOptions): Promise<AgentResponse> {
    // 确保项目上下文已加载（首次对话时等待）
    if (this.messages.length <= 1) {
      await this.projectContextReady;
    }

    // 检查是否需要压缩上下文
    await this.maybeCompress();

    // 修复多轮对话问题：确保消息历史格式正确
    // LLM API 要求：tool 消息必须紧跟在带有 tool_calls 的 assistant 消息之后
    // 如果上一轮以 tool 消息结束（没有 assistant 的最终响应），需要添加合成消息
    this.ensureValidMessageHistory();

    // 支持多模态消息（图片等）
    this.messages.push({
      role: 'user',
      content: wrapUserMessageContent(userMessage, this.isAdvancedModel),
    });

    let fullContent = '';
    const allToolCalls: Array<{ call: ToolCall; result: ToolResult }> = [];

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      // 检查是否已中断
      if (options?.signal?.aborted) {
        throw new DOMException('请求已中断', 'AbortError');
      }

      let iterationContent = '';
      let pendingToolCalls: ToolCall[] = [];

      try {
        for await (const chunk of this.llm.chatStream(this.messages, this.getToolDefinitions(), { signal: options?.signal })) {
          // 检查中断信号
          if (options?.signal?.aborted) {
            throw new DOMException('请求已中断', 'AbortError');
          }

          if (chunk.type === 'text' && chunk.content) {
            iterationContent += chunk.content;

            // 使用内容分类器进行分类
            if (this.enableClassifier && this.onClassifiedText) {
              const classifiedChunks = this.classifier.classifyStream(chunk.content, {
                toolCallPending: this.toolCallPending,
              });
              for (const classified of classifiedChunks) {
                this.onClassifiedText(classified);
              }
            }

            // 保持向后兼容
            this.onText?.(chunk.content);
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            // 标记工具调用状态
            this.toolCallPending = true;
            pendingToolCalls.push(chunk.toolCall);
          }

          // 处理 token 使用统计
          if (chunk.usage) {
            this.totalUsage.promptTokens += chunk.usage.promptTokens;
            this.totalUsage.completionTokens += chunk.usage.completionTokens;
            this.totalUsage.totalTokens += chunk.usage.totalTokens;
            this.onTokenUsage?.(chunk.usage);
          }
        }
      } catch (error) {
        // 重新抛出 AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        throw error;
      }

      fullContent += iterationContent;

      // 刷新分类器缓冲区
      if (this.enableClassifier && this.onClassifiedText) {
        const remaining = this.classifier.flush({
          toolCallPending: this.toolCallPending,
        });
        if (remaining) {
          this.onClassifiedText(remaining);
        }
      }

      this.messages.push({
        role: 'assistant',
        content: iterationContent,
        toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
      });

      if (pendingToolCalls.length === 0) {
        // 重置状态
        this.toolCallPending = false;
        break;
      }

      // 检查是否已中断
      if (options?.signal?.aborted) {
        throw new DOMException('请求已中断', 'AbortError');
      }

      // 串行处理每个工具调用（通知 + 确认 + 执行）
      // 注意：不能并行确认，因为 UI 只支持一个确认对话框
      const confirmedCalls: ToolCall[] = [];
      const deniedCalls: ToolCall[] = [];

      for (const toolCall of pendingToolCalls) {
        // 通知 UI 显示工具调用
        this.onToolCall?.(toolCall);

        // 等待用户确认（串行，一个一个来）
        const confirmed = await this.confirmToolExecution(toolCall);

        if (confirmed) {
          confirmedCalls.push(toolCall);
        } else {
          deniedCalls.push(toolCall);
        }
      }

      // 处理被拒绝的工具调用 - 抛出错误中断执行
      if (deniedCalls.length > 0) {
        const firstDenied = deniedCalls[0];
        // 通知 UI 显示拒绝结果
        const deniedResult: ToolResult = {
          success: false,
          output: '',
          error: '用户拒绝执行此操作',
        };
        allToolCalls.push({ call: firstDenied, result: deniedResult });
        this.onToolResult?.(firstDenied, deniedResult);

        // 抛出用户拒绝错误，中断整个对话流程
        throw new UserRejectedError(firstDenied.name, '用户拒绝执行此操作');
      }

      // 并行执行已确认的工具调用
      if (confirmedCalls.length > 0) {
        const results = await Promise.all(
          confirmedCalls.map(tc => this.executeTool(tc))
        );

        // 处理执行结果
        confirmedCalls.forEach((toolCall, idx) => {
          const result = results[idx];
          allToolCalls.push({ call: toolCall, result });
          this.onToolResult?.(toolCall, result);

          // 构建消息内容（支持多模态）
          let messageContent: MessageContent;
          if (result.image) {
            // 包含图片的多模态消息
            const contentParts: (TextContent | ImageContent)[] = [
              { type: 'text', text: result.output || '图片内容如下：' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${result.image.mimeType};base64,${result.image.base64}`,
                  detail: 'auto',
                },
              },
            ];
            messageContent = contentParts;
          } else {
            // 普通文本消息
            messageContent = result.success ? result.output : `错误: ${result.error}`;
          }

          this.messages.push({
            role: 'tool',
            content: messageContent,
            toolCallId: toolCall.id,
          });
        });

        // 工具执行完成，重置状态
        this.toolCallPending = false;
      }
    }

    return { content: fullContent, toolCalls: allToolCalls, usage: { ...this.totalUsage } };
  }

  reset(): void {
    this.messages = [{
      role: 'system',
      content: this.getSystemPromptContent(),
    }];
    this.alwaysAllowedTools.clear();
    this.classifier.reset();
    this.toolCallPending = false;
    this.totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * 获取累计 Token 使用统计
   */
  getTokenUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * 获取 Agent 状态快照
   * 用于会话持久化和恢复
   */
  getSnapshot(): AgentSnapshot {
    return {
      agentId: this.agentId,
      createdAt: this.createdAt,
      alwaysAllowedTools: Array.from(this.alwaysAllowedTools),
      allowedPrompts: [...this.semanticPermissions],
      isAdvancedModel: this.isAdvancedModel,
      tokenUsage: { ...this.totalUsage },
      projectContext: this.projectContext ? {
        type: this.projectContext.type,
        framework: this.projectContext.frameworks?.[0],
        language: this.projectContext.type,
      } : undefined,
    };
  }

  /**
   * 添加语义化权限
   * @param tool 工具类型
   * @param prompt 语义描述（如 "run tests", "install dependencies"）
   * @param expiresIn 过期时间（毫秒），不设置则会话级别
   */
  addSemanticPermission(
    tool: SemanticPermission['tool'],
    prompt: string,
    expiresIn?: number
  ): void {
    const permission: SemanticPermission = {
      tool,
      prompt,
      grantedAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
    };
    this.semanticPermissions.push(permission);
  }

  /**
   * 批量添加语义化权限
   * @param permissions 权限数组
   */
  addSemanticPermissions(
    permissions: Array<{ tool: SemanticPermission['tool']; prompt: string }>
  ): void {
    const now = Date.now();
    for (const { tool, prompt } of permissions) {
      this.semanticPermissions.push({
        tool,
        prompt,
        grantedAt: now,
      });
    }
  }

  /**
   * 获取当前语义化权限列表
   */
  getSemanticPermissions(): SemanticPermission[] {
    return [...this.semanticPermissions];
  }

  /**
   * 清除所有语义化权限
   */
  clearSemanticPermissions(): void {
    this.semanticPermissions = [];
  }

  /**
   * 检查是否有某个语义化权限
   */
  hasSemanticPermission(tool: SemanticPermission['tool'], action: string): boolean {
    return !!matchSemanticPermission(this.semanticPermissions, tool, action);
  }

  /**
   * 从会话数据恢复 Agent（静态工厂方法）
   * @param session 会话数据（包含 messages 和 agentSnapshot）
   * @param options 其他 Agent 配置（llm, tools 等是必需的）
   * @returns 恢复后的 Agent 实例
   */
  static restore(
    session: { messages: Message[]; agentSnapshot?: AgentSnapshot },
    options: Omit<AgentOptions, 'snapshot' | 'resumeMessages'>
  ): Agent {
    return new Agent({
      ...options,
      snapshot: session.agentSnapshot,
      resumeMessages: session.messages,
    });
  }

  /**
   * 检查 Agent 是否是恢复的会话
   */
  isResumed(): boolean {
    // 如果创建时间与当前时间差距较大，说明是恢复的
    return Date.now() - this.createdAt > 5000;
  }

  /**
   * 获取会话摘要（用于显示）
   */
  getSessionSummary(): {
    agentId: string;
    createdAt: Date;
    messageCount: number;
    tokenUsage: TokenUsage;
    permissionCount: number;
    projectType?: string;
  } {
    return {
      agentId: this.agentId,
      createdAt: new Date(this.createdAt),
      messageCount: this.messages.length,
      tokenUsage: { ...this.totalUsage },
      permissionCount: this.alwaysAllowedTools.size + this.semanticPermissions.length,
      projectType: this.projectContext?.type,
    };
  }

  /**
   * 导出完整会话数据（用于保存）
   */
  exportSession(): {
    messages: Message[];
    agentSnapshot: AgentSnapshot;
  } {
    return {
      messages: this.getHistory(),
      agentSnapshot: this.getSnapshot(),
    };
  }

  /**
   * 追加系统提醒到下一条消息前
   * 用于注入上下文相关的提醒（如会话恢复提醒）
   */
  addSystemReminder(reminder: string): void {
    // 在最后一条消息后添加系统提醒
    this.messages.push({
      role: 'system',
      content: `<system-reminder>\n${reminder}\n</system-reminder>`,
    });
  }

  /**
   * 获取最后一条用户消息的内容
   */
  getLastUserMessage(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        const content = this.messages[i].content;
        return typeof content === 'string' ? content : null;
      }
    }
    return null;
  }

  /**
   * 获取对话轮数（用户消息数量）
   */
  getTurnCount(): number {
    return this.messages.filter(m => m.role === 'user').length;
  }
}
