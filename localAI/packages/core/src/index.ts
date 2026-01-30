// LLM
export * from './llm/index.js';

// Tools
export * from './tools/index.js';

// Agent - 重命名冲突类型
export {
  // 主要功能
  Agent,
  type AgentOptions,
  type AgentRequestOptions,
  type AgentResponse,
  type ConfirmResult,
  SENSITIVE_TOOLS,
  // Agent Manager
  AgentManager,
  agentManager,
  type TaskInfo,
  // 上下文压缩
  compressMessages,
  compressMessagesAsync,
  needsCompression,
  createContextManager,
  estimateTokens,
  extractKeyInfo,
  type CompressionConfig,
  type CompressionStats,
  // 项目感知
  detectProjectContext,
  detectProjectContextQuick,
  generateProjectSummary,
  type ProjectType,
  type ProjectContext,
  type CodeStyleConfig,
  type CICDConfig,
  type EnvConfig,
  type DatabaseConfig as ProjectDatabaseConfig, // 重命名避免冲突
  type APIConfig as ProjectAPIConfig, // 重命名避免冲突
  type TestConfig,
  type DockerConfig,
  type ProjectInstructions,
  type ArchitecturePattern,
  // 子代理
  SubAgent,
  getToolsForSubAgent,
  type SubAgentType,
  type SubAgentConfig,
  type SubAgentResult,
  type SubAgentStatus,
  // 计划模式
  PlanManager,
  planManager,
  getPlanModeSystemPrompt,
  type PlanContent,
  type PlanStep,
  type PlanStatus,
  type PlanSession,
  // 提示词
  SYSTEM_PROMPT_SIMPLE,
  SYSTEM_PROMPT_ADVANCED,
  USER_REMINDER_SIMPLE,
  USER_REMINDER_ADVANCED,
  getSystemPrompt,
  wrapUserMessage,
  wrapUserMessageContent,
} from './agent/index.js';

// MCP - 使用 MCP 前缀的类型避免冲突
export {
  MCPClient,
  MCPManager,
  mcpManager,
  JSONRPCErrorCode,
  type MCPTransportType,
  type MCPServerConfig,
  type JSONRPCMessage,
  type JSONRPCError,
  type ClientCapabilities,
  type ServerCapabilities,
  type InitializeParams,
  type InitializeResult,
  type MCPToolDefinition,
  type JSONSchema,
  type JSONSchemaProperty,
  type ToolCallParams,
  type ToolCallResult as MCPToolCallResult,
  type MCPResource,
  type MCPResourceTemplate,
  type ReadResourceParams,
  type ReadResourceResult,
  type ResourceContent,
  type SubscribeResourceParams,
  type ResourceUpdatedNotification,
  type MCPPrompt,
  type MCPPromptArgument,
  type GetPromptParams,
  type GetPromptResult,
  type PromptMessage,
  type CreateMessageParams,
  type CreateMessageResult,
  type SamplingMessage,
  type ModelPreferences,
  type LogLevel,
  type SetLogLevelParams,
  type LogMessageNotification,
  type ProgressNotification,
  type MCPContentBlock,
  type MCPTextContent,
  type MCPImageContent,
  type MCPEmbeddedResource,
  type Root,
  type ListRootsResult,
  type MCPClientEvent,
  type MCPClientStatus,
  type IMCPClient,
  type MCPConfigFile,
  type MCPServerStatus,
  type MCPManagerEvent,
} from './mcp/index.js';

// Config
export * from './config/index.js';

// Skill
export * from './skill/index.js';

// Hooks
export * from './hooks/index.js';

// Classifier - 内容分类器
export * from './classifier/index.js';

// Utils - 工具函数
export * from './utils/index.js';
