/**
 * MCP (Model Context Protocol) 类型定义 - 高级版
 * 参考: https://modelcontextprotocol.io
 *
 * 支持完整 MCP 2024-11-05 规范：
 * - Tools (工具)
 * - Resources (资源)
 * - Prompts (提示模板)
 * - Sampling (采样)
 * - Logging (日志)
 * - Progress (进度通知)
 */

// ==================== 传输层 ====================

/**
 * MCP 传输类型
 */
export type MCPTransportType = 'stdio' | 'http' | 'sse' | 'websocket';

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  /** 服务器名称 */
  name: string;
  /** 传输类型 */
  transport: MCPTransportType;
  /** stdio 模式的命令 */
  command?: string;
  /** stdio 模式的参数 */
  args?: string[];
  /** http/sse/websocket 模式的 URL */
  url?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** HTTP 头 */
  headers?: Record<string, string>;
  /** 连接超时（毫秒） */
  connectTimeout?: number;
  /** 请求超时（毫秒） */
  requestTimeout?: number;
  /** 是否自动重连 */
  autoReconnect?: boolean;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 是否启用 */
  enabled?: boolean;
}

// ==================== JSON-RPC ====================

/**
 * JSON-RPC 2.0 消息
 */
export interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: JSONRPCError;
}

/**
 * JSON-RPC 错误
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * 标准错误码
 */
export enum JSONRPCErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  // MCP 特定错误
  ServerError = -32000,
  ResourceNotFound = -32001,
  ToolNotFound = -32002,
  PromptNotFound = -32003,
}

// ==================== 协议初始化 ====================

/**
 * 客户端能力
 */
export interface ClientCapabilities {
  /** 是否支持采样 */
  sampling?: Record<string, never>;
  /** 实验性功能 */
  experimental?: Record<string, unknown>;
  /** 根目录配置 */
  roots?: {
    listChanged?: boolean;
  };
}

/**
 * 服务器能力
 */
export interface ServerCapabilities {
  /** 工具能力 */
  tools?: {
    listChanged?: boolean;
  };
  /** 资源能力 */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /** 提示能力 */
  prompts?: {
    listChanged?: boolean;
  };
  /** 日志能力 */
  logging?: Record<string, never>;
  /** 实验性功能 */
  experimental?: Record<string, unknown>;
}

/**
 * 初始化请求参数
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * 初始化响应
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

// ==================== 工具 (Tools) ====================

/**
 * MCP 工具定义
 */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

/**
 * JSON Schema
 */
export interface JSONSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'null';
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  items?: JSONSchemaProperty;
  description?: string;
  additionalProperties?: boolean | JSONSchemaProperty;
}

/**
 * JSON Schema 属性
 */
export interface JSONSchemaProperty {
  type: string | string[];
  description?: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * 工具调用请求参数
 */
export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 工具调用响应
 */
export interface ToolCallResult {
  content: MCPContentBlock[];
  isError?: boolean;
}

// ==================== 资源 (Resources) ====================

/**
 * 资源定义
 */
export interface MCPResource {
  /** 资源 URI */
  uri: string;
  /** 资源名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * 资源模板
 */
export interface MCPResourceTemplate {
  /** URI 模板 */
  uriTemplate: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** MIME 类型 */
  mimeType?: string;
}

/**
 * 读取资源请求参数
 */
export interface ReadResourceParams {
  uri: string;
}

/**
 * 读取资源响应
 */
export interface ReadResourceResult {
  contents: ResourceContent[];
}

/**
 * 资源内容
 */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // Base64 encoded
}

/**
 * 资源订阅参数
 */
export interface SubscribeResourceParams {
  uri: string;
}

/**
 * 资源更新通知
 */
export interface ResourceUpdatedNotification {
  uri: string;
}

// ==================== 提示 (Prompts) ====================

/**
 * 提示定义
 */
export interface MCPPrompt {
  /** 提示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 参数列表 */
  arguments?: MCPPromptArgument[];
}

/**
 * 提示参数
 */
export interface MCPPromptArgument {
  /** 参数名 */
  name: string;
  /** 描述 */
  description?: string;
  /** 是否必需 */
  required?: boolean;
}

/**
 * 获取提示请求参数
 */
export interface GetPromptParams {
  name: string;
  arguments?: Record<string, string>;
}

/**
 * 获取提示响应
 */
export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

/**
 * 提示消息
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: MCPTextContent | MCPImageContent | MCPEmbeddedResource;
}

// ==================== 采样 (Sampling) ====================

/**
 * 创建消息请求参数（采样）
 */
export interface CreateMessageParams {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 采样消息
 */
export interface SamplingMessage {
  role: 'user' | 'assistant';
  content: MCPTextContent | MCPImageContent;
}

/**
 * 模型偏好
 */
export interface ModelPreferences {
  hints?: Array<{
    name?: string;
  }>;
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

/**
 * 创建消息响应
 */
export interface CreateMessageResult {
  role: 'assistant';
  content: MCPTextContent;
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

// ==================== 日志 (Logging) ====================

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * 设置日志级别参数
 */
export interface SetLogLevelParams {
  level: LogLevel;
}

/**
 * 日志消息通知
 */
export interface LogMessageNotification {
  level: LogLevel;
  logger?: string;
  data: unknown;
}

// ==================== 进度通知 ====================

/**
 * 进度通知
 */
export interface ProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
}

// ==================== 内容类型 ====================

/**
 * MCP 文本内容
 */
export interface MCPTextContent {
  type: 'text';
  text: string;
}

/**
 * MCP 图片内容
 */
export interface MCPImageContent {
  type: 'image';
  data: string; // Base64
  mimeType: string;
}

/**
 * MCP 嵌入资源
 */
export interface MCPEmbeddedResource {
  type: 'resource';
  resource: ResourceContent;
}

/**
 * MCP 内容块
 */
export type MCPContentBlock = MCPTextContent | MCPImageContent | MCPEmbeddedResource;

// 为了向后兼容，保留别名
export type ContentBlock = MCPContentBlock;
export type TextContent = MCPTextContent;
export type ImageContent = MCPImageContent;
export type EmbeddedResource = MCPEmbeddedResource;

// ==================== 根目录 ====================

/**
 * 根目录
 */
export interface Root {
  uri: string;
  name?: string;
}

/**
 * 列出根目录结果
 */
export interface ListRootsResult {
  roots: Root[];
}

// ==================== 客户端接口 ====================

/**
 * MCP 客户端事件
 */
export type MCPClientEvent =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'tools/list_changed'
  | 'resources/list_changed'
  | 'resources/updated'
  | 'prompts/list_changed'
  | 'logging/message'
  | 'progress';

/**
 * MCP 客户端状态
 */
export type MCPClientStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * MCP 客户端接口
 */
export interface IMCPClient {
  /** 服务器名称 */
  readonly name: string;
  /** 连接状态 */
  readonly status: MCPClientStatus;
  /** 服务器能力 */
  readonly capabilities: ServerCapabilities | null;
  /** 服务器信息 */
  readonly serverInfo: { name: string; version: string } | null;

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // 工具
  listTools(): Promise<MCPToolDefinition[]>;
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;

  // 资源
  listResources(): Promise<MCPResource[]>;
  listResourceTemplates(): Promise<MCPResourceTemplate[]>;
  readResource(uri: string): Promise<ReadResourceResult>;
  subscribeResource(uri: string): Promise<void>;
  unsubscribeResource(uri: string): Promise<void>;

  // 提示
  listPrompts(): Promise<MCPPrompt[]>;
  getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>;

  // 采样（如果客户端支持）
  createMessage?(params: CreateMessageParams): Promise<CreateMessageResult>;

  // 日志
  setLogLevel(level: LogLevel): Promise<void>;

  // 事件
  on(event: MCPClientEvent, handler: (data?: unknown) => void): void;
  off(event: MCPClientEvent, handler: (data?: unknown) => void): void;
}

// ==================== 配置文件格式 ====================

/**
 * MCP 配置文件格式（兼容 Claude Code 格式）
 */
export interface MCPConfigFile {
  mcpServers: Record<string, Omit<MCPServerConfig, 'name'>>;
}

/**
 * MCP 服务器状态
 */
export interface MCPServerStatus {
  name: string;
  status: MCPClientStatus;
  capabilities: ServerCapabilities | null;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  lastError?: string;
  reconnectAttempts?: number;
}
