/**
 * MCP 服务器管理器 - 高级版
 * 管理多个 MCP 服务器连接
 * 支持 Tools, Resources, Prompts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { MCPClient } from './client.js';
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResource,
  MCPResourceTemplate,
  MCPPrompt,
  MCPConfigFile,
  MCPServerStatus,
  ToolCallResult,
  ReadResourceResult,
  GetPromptResult,
  MCPContentBlock,
  LogMessageNotification,
} from './types.js';
import type { Tool, ToolResult } from '../../tools/mastra/types.js';

/**
 * MCP 管理器事件
 */
export type MCPManagerEvent =
  | 'server:connected'
  | 'server:disconnected'
  | 'server:error'
  | 'tools:changed'
  | 'resources:changed'
  | 'prompts:changed'
  | 'log';

/**
 * MCP 服务器管理器
 */
export class MCPManager extends EventEmitter {
  private clients: Map<string, MCPClient> = new Map();

  // 聚合的资源
  private allTools: Map<string, { client: MCPClient; toolDef: MCPToolDefinition }> = new Map();
  private allResources: Map<string, { client: MCPClient; resource: MCPResource }> = new Map();
  private allResourceTemplates: Map<string, { client: MCPClient; template: MCPResourceTemplate }> = new Map();
  private allPrompts: Map<string, { client: MCPClient; prompt: MCPPrompt }> = new Map();

  constructor() {
    super();
  }

  // ==================== 配置加载 ====================

  /**
   * 从配置文件加载 MCP 服务器
   */
  async loadFromFile(configPath: string): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(process.cwd(), configPath);

      const content = await fs.readFile(absolutePath, 'utf-8');
      const config: MCPConfigFile = JSON.parse(content);

      const promises: Promise<void>[] = [];

      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        // 跳过禁用的服务器
        if (serverConfig.enabled === false) continue;

        promises.push(this.addServer({ name, ...serverConfig }));
      }

      await Promise.allSettled(promises);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`加载 MCP 配置失败: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 从多个位置加载配置
   */
  async loadFromStandardPaths(cwd: string): Promise<void> {
    const paths = [
      // 项目级配置
      path.join(cwd, '.lsc-ai', 'mcp.json'),
      path.join(cwd, '.mcp.json'),
      path.join(cwd, 'mcp.json'),
      // 兼容 Claude Code 格式
      path.join(cwd, '.claude', 'mcp.json'),
    ];

    for (const configPath of paths) {
      try {
        await fs.access(configPath);
        await this.loadFromFile(configPath);
        return; // 找到一个就停止
      } catch {
        // 继续尝试下一个
      }
    }
  }

  // ==================== 服务器管理 ====================

  /**
   * 添加 MCP 服务器
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      console.warn(`MCP 服务器 ${config.name} 已存在，跳过`);
      return;
    }

    const client = new MCPClient(config);

    // 设置事件监听
    this.setupClientEvents(client);

    try {
      await client.connect();
      this.clients.set(config.name, client);

      // 索引所有资源
      await this.indexClientResources(client);

      console.log(`[MCP] 已连接 ${config.name}:`,
        `${client.discoveredTools.length} 工具,`,
        `${client.discoveredResources.length} 资源,`,
        `${client.discoveredPrompts.length} 提示`
      );

      this.emit('server:connected', { name: config.name });

    } catch (error) {
      console.error(`[MCP] 连接 ${config.name} 失败: ${(error as Error).message}`);
      this.emit('server:error', { name: config.name, error });
    }
  }

  /**
   * 移除 MCP 服务器
   */
  async removeServer(name: string): Promise<boolean> {
    const client = this.clients.get(name);
    if (!client) return false;

    await client.disconnect();
    this.clients.delete(name);

    // 清理索引
    this.removeClientResources(name);

    this.emit('server:disconnected', { name });
    return true;
  }

  /**
   * 设置客户端事件监听
   */
  private setupClientEvents(client: MCPClient): void {
    client.on('tools/list_changed', () => {
      this.reindexTools(client);
      this.emit('tools:changed');
    });

    client.on('resources/list_changed', () => {
      this.reindexResources(client);
      this.emit('resources:changed');
    });

    client.on('prompts/list_changed', () => {
      this.reindexPrompts(client);
      this.emit('prompts:changed');
    });

    client.on('logging/message', (message) => {
      this.emit('log', { server: client.name, ...(message as LogMessageNotification) });
    });

    client.on('disconnected', () => {
      this.emit('server:disconnected', { name: client.name });
    });

    client.on('error', (error) => {
      this.emit('server:error', { name: client.name, error });
    });
  }

  // ==================== 资源索引 ====================

  private async indexClientResources(client: MCPClient): Promise<void> {
    // 索引工具
    for (const tool of client.discoveredTools) {
      const fullName = this.makeFullName(client.name, 'tool', tool.name);
      this.allTools.set(fullName, { client, toolDef: tool });
    }

    // 索引资源
    for (const resource of client.discoveredResources) {
      const fullName = this.makeFullName(client.name, 'resource', resource.uri);
      this.allResources.set(fullName, { client, resource });
    }

    // 索引资源模板
    for (const template of client.discoveredResourceTemplates) {
      const fullName = this.makeFullName(client.name, 'template', template.uriTemplate);
      this.allResourceTemplates.set(fullName, { client, template });
    }

    // 索引提示
    for (const prompt of client.discoveredPrompts) {
      const fullName = this.makeFullName(client.name, 'prompt', prompt.name);
      this.allPrompts.set(fullName, { client, prompt });
    }
  }

  private removeClientResources(serverName: string): void {
    const prefix = `mcp__${serverName}__`;

    for (const key of this.allTools.keys()) {
      if (key.startsWith(prefix)) this.allTools.delete(key);
    }
    for (const key of this.allResources.keys()) {
      if (key.startsWith(prefix)) this.allResources.delete(key);
    }
    for (const key of this.allResourceTemplates.keys()) {
      if (key.startsWith(prefix)) this.allResourceTemplates.delete(key);
    }
    for (const key of this.allPrompts.keys()) {
      if (key.startsWith(prefix)) this.allPrompts.delete(key);
    }
  }

  private reindexTools(client: MCPClient): void {
    // 清除旧的
    const prefix = `mcp__${client.name}__tool__`;
    for (const key of this.allTools.keys()) {
      if (key.startsWith(prefix)) this.allTools.delete(key);
    }

    // 添加新的
    for (const tool of client.discoveredTools) {
      const fullName = this.makeFullName(client.name, 'tool', tool.name);
      this.allTools.set(fullName, { client, toolDef: tool });
    }
  }

  private reindexResources(client: MCPClient): void {
    const prefix = `mcp__${client.name}__resource__`;
    for (const key of this.allResources.keys()) {
      if (key.startsWith(prefix)) this.allResources.delete(key);
    }

    for (const resource of client.discoveredResources) {
      const fullName = this.makeFullName(client.name, 'resource', resource.uri);
      this.allResources.set(fullName, { client, resource });
    }
  }

  private reindexPrompts(client: MCPClient): void {
    const prefix = `mcp__${client.name}__prompt__`;
    for (const key of this.allPrompts.keys()) {
      if (key.startsWith(prefix)) this.allPrompts.delete(key);
    }

    for (const prompt of client.discoveredPrompts) {
      const fullName = this.makeFullName(client.name, 'prompt', prompt.name);
      this.allPrompts.set(fullName, { client, prompt });
    }
  }

  private makeFullName(serverName: string, type: string, name: string): string {
    // 简化命名：mcp__serverName__toolName
    // 对于工具，去掉 type 前缀使名称更简洁
    if (type === 'tool') {
      return `mcp__${serverName}__${name}`;
    }
    return `mcp__${serverName}__${type}__${name}`;
  }

  // ==================== 工具操作 ====================

  /**
   * 获取所有 MCP 工具作为 Tool 接口
   */
  getTools(): Tool[] {
    const result: Tool[] = [];

    for (const [fullName, { client, toolDef }] of this.allTools) {
      result.push(this.createToolWrapper(fullName, client, toolDef));
    }

    return result;
  }

  /**
   * 调用工具
   */
  async callTool(fullName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const entry = this.allTools.get(fullName);
    if (!entry) {
      throw new Error(`工具不存在: ${fullName}`);
    }

    return entry.client.callTool(entry.toolDef.name, args);
  }

  private createToolWrapper(fullName: string, client: MCPClient, toolDef: MCPToolDefinition): Tool {
    return {
      definition: {
        name: fullName,
        description: `[MCP: ${client.name}] ${toolDef.description || toolDef.name}`,
        parameters: {
          type: 'object' as const,
          properties: Object.fromEntries(
            Object.entries(toolDef.inputSchema.properties || {}).map(([key, value]) => {
              const propType = Array.isArray(value.type) ? value.type[0] : (value.type ?? 'string');
              const prop: { type: string; description: string; enum?: string[] } = {
                type: String(propType),
                description: value.description || '',
              };
              // 将 enum 值转换为字符串数组
              if (value.enum) {
                prop.enum = value.enum.map((v: any) => String(v));
              }
              return [key, prop];
            })
          ),
          required: toolDef.inputSchema.required || [],
        },
      },
      execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const response = await client.callTool(toolDef.name, args);
          const output = this.formatContent(response.content);

          return {
            success: !response.isError,
            output: output || '(无输出)',
            error: response.isError ? output : undefined,
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `MCP 工具调用失败: ${(error as Error).message}`,
          };
        }
      },
    };
  }

  private formatContent(content: MCPContentBlock[]): string {
    return content
      .map(block => {
        if (block.type === 'text') {
          return block.text;
        }
        if (block.type === 'image') {
          return `[图片: ${block.mimeType}]`;
        }
        if (block.type === 'resource') {
          return block.resource.text || `[资源: ${block.resource.uri}]`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  // ==================== 资源操作 ====================

  /**
   * 列出所有资源
   */
  listResources(): Array<{ fullName: string; server: string; resource: MCPResource }> {
    return Array.from(this.allResources.entries()).map(([fullName, { client, resource }]) => ({
      fullName,
      server: client.name,
      resource,
    }));
  }

  /**
   * 列出所有资源模板
   */
  listResourceTemplates(): Array<{ fullName: string; server: string; template: MCPResourceTemplate }> {
    return Array.from(this.allResourceTemplates.entries()).map(([fullName, { client, template }]) => ({
      fullName,
      server: client.name,
      template,
    }));
  }

  /**
   * 读取资源
   */
  async readResource(uri: string, serverName?: string): Promise<ReadResourceResult> {
    // 如果指定了服务器
    if (serverName) {
      const client = this.clients.get(serverName);
      if (!client) {
        throw new Error(`服务器不存在: ${serverName}`);
      }
      return client.readResource(uri);
    }

    // 尝试从索引中找
    for (const [, { client, resource }] of this.allResources) {
      if (resource.uri === uri) {
        return client.readResource(uri);
      }
    }

    // 尝试所有服务器
    for (const client of this.clients.values()) {
      try {
        return await client.readResource(uri);
      } catch {
        // 继续尝试下一个
      }
    }

    throw new Error(`无法读取资源: ${uri}`);
  }

  /**
   * 订阅资源
   */
  async subscribeResource(uri: string, serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`服务器不存在: ${serverName}`);
    }
    await client.subscribeResource(uri);
  }

  // ==================== 提示操作 ====================

  /**
   * 列出所有提示
   */
  listPrompts(): Array<{ fullName: string; server: string; prompt: MCPPrompt }> {
    return Array.from(this.allPrompts.entries()).map(([fullName, { client, prompt }]) => ({
      fullName,
      server: client.name,
      prompt,
    }));
  }

  /**
   * 获取提示
   */
  async getPrompt(name: string, args?: Record<string, string>, serverName?: string): Promise<GetPromptResult> {
    // 如果指定了服务器
    if (serverName) {
      const client = this.clients.get(serverName);
      if (!client) {
        throw new Error(`服务器不存在: ${serverName}`);
      }
      return client.getPrompt(name, args);
    }

    // 从索引中找
    for (const [fullName, { client, prompt }] of this.allPrompts) {
      if (prompt.name === name || fullName.endsWith(`__${name}`)) {
        return client.getPrompt(prompt.name, args);
      }
    }

    throw new Error(`提示不存在: ${name}`);
  }

  // ==================== 状态查询 ====================

  /**
   * 列出所有服务器状态
   */
  listServers(): MCPServerStatus[] {
    return Array.from(this.clients.entries()).map(([name, client]) => ({
      name,
      status: client.status,
      capabilities: client.capabilities,
      toolCount: client.discoveredTools.length,
      resourceCount: client.discoveredResources.length,
      promptCount: client.discoveredPrompts.length,
    }));
  }

  /**
   * 列出所有工具摘要
   */
  listAllTools(): Array<{ name: string; server: string; description: string }> {
    return Array.from(this.allTools.entries()).map(([name, { client, toolDef }]) => ({
      name,
      server: client.name,
      description: toolDef.description || '',
    }));
  }

  /**
   * 获取服务器
   */
  getServer(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * 检查是否有已连接的服务器
   */
  get hasConnectedServers(): boolean {
    for (const client of this.clients.values()) {
      if (client.status === 'connected') return true;
    }
    return false;
  }

  /**
   * 获取统计信息
   */
  get stats(): {
    servers: number;
    connectedServers: number;
    tools: number;
    resources: number;
    prompts: number;
  } {
    let connectedServers = 0;
    for (const client of this.clients.values()) {
      if (client.status === 'connected') connectedServers++;
    }

    return {
      servers: this.clients.size,
      connectedServers,
      tools: this.allTools.size,
      resources: this.allResources.size,
      prompts: this.allPrompts.size,
    };
  }

  // ==================== 清理 ====================

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client =>
      client.disconnect().catch(() => {})
    );

    await Promise.all(promises);

    this.clients.clear();
    this.allTools.clear();
    this.allResources.clear();
    this.allResourceTemplates.clear();
    this.allPrompts.clear();
  }
}

// 全局 MCP 管理器实例
export const mcpManager = new MCPManager();
