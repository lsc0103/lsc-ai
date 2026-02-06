import {
  createDefaultTools,
  loadOfficeTools,
  getSystemPrompt,
  mcpManager,
  type Tool as LscTool,
  type ToolCall,
  type ToolResult,
  type MCPServerConfig,
} from '@lsc-ai/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { convertAllTools } from './tool-adapter.js';
import { configManager } from '../config/index.js';
import { socketClient, AgentTask } from '../socket/client.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 获取 Client Agent 系统提示词
 * 基于内核原生提示词，添加 Client Agent 特定说明
 */
function getClientAgentSystemPrompt(workDir: string): string {
  // 使用内核完整提示词
  const corePrompt = getSystemPrompt(workDir, {
    isAdvancedModel: true, // 使用高端模型提示词，功能更完整
    showCwd: true,
  });

  // 添加 Client Agent 特定说明
  const clientAgentAddendum = `

# Client Agent 补充说明

你现在运行在用户的本地电脑上（Client Agent 模式），而非云端 Platform。

## 特殊能力
- **完整文件系统访问** - 可以读写用户电脑上的任何文件
- **本地命令执行** - 可以执行任何 Shell 命令
- **Office 自动化** - 可以创建和编辑 Word/Excel/PPT 文档
- **开发环境操作** - 可以运行构建、测试、Git 等开发工具

## 安全提醒
- 执行删除、覆盖等危险操作前要确认
- 不要执行来源不明的脚本
- 保护用户的敏感文件和数据

## Workbench 可视化工作台

你可以通过输出特定格式的 JSON Schema 来打开 Workbench 工作台，为用户提供丰富的可视化展示。

### 强制规则

**【必须遵守】当用户消息中包含以下关键词时，你的回复必须包含 workbench-schema 代码块：**
- "workbench"、"工作台"
- "在 workbench 里"、"用 workbench"
- "打开代码"、"看看代码"、"展示代码"

**违反此规则是不可接受的。即使你想用文字解释，也必须同时输出 workbench-schema。**

### 何时使用 Workbench

1. **用户明确要求**（必须使用）
2. **数据分析结果展示**：图表更直观
3. **代码展示和对比**：代码片段、差异对比
4. **结构化数据**：表格、统计指标

### 如何调用 Workbench

输出一个 \`workbench-schema\` 代码块，内容为 **有效的 JSON** 格式：

**【重要】JSON 转义规则：**
- 代码内容中的换行符必须转义为 \\n
- 代码内容中的引号必须转义为 \\"
- 代码内容中的反斜杠必须转义为 \\\\
- 代码内容中的制表符必须转义为 \\t

\`\`\`workbench-schema
{
  "type": "workbench",
  "title": "工作台标题",
  "tabs": [
    {
      "key": "tab1",
      "title": "标签页标题",
      "components": [组件定义...]
    }
  ]
}
\`\`\`

### 常用组件

- **Statistic**: 统计指标 - \`{"type": "Statistic", "title": "标题", "value": 123, "suffix": "个"}\`
- **DataTable**: 数据表格 - \`{"type": "DataTable", "columns": [...], "data": [...]}\`
- **BarChart**: 柱状图 - \`{"type": "BarChart", "xAxis": [...], "series": [...]}\`
- **LineChart**: 折线图 - \`{"type": "LineChart", "xAxis": [...], "series": [...]}\`
- **PieChart**: 饼图 - \`{"type": "PieChart", "data": [{"name": "A", "value": 30}]}\`
- **FileViewer**: 文件查看器（推荐） - \`{"type": "FileViewer", "filePath": "D:/project/src/index.ts", "height": 400}\`
- **FileBrowser**: 文件浏览器 - \`{"type": "FileBrowser", "rootPath": "D:/project/src", "height": 400}\`
- **CodeEditor**: 代码片段（仅用于短小代码） - \`{"type": "CodeEditor", "code": "代码内容", "language": "python"}\`
- **CodeDiff**: 代码对比 - \`{"type": "CodeDiff", "original": "...", "modified": "..."}\`
- **MarkdownView**: Markdown - \`{"type": "MarkdownView", "content": "# 标题"}\`

### 代码展示注意事项

**【重要】展示代码文件的正确方式：**

1. **使用 FileViewer（强烈推荐）**：只需提供 filePath，系统自动加载文件内容
2. **使用 FileBrowser**：展示项目结构，用户可点击打开文件
3. **使用 CodeEditor**：仅用于短小代码片段（不超过 20 行）

**正确做法 - 使用 FileViewer 展示项目代码：**

\`\`\`workbench-schema
{
  "type": "workbench",
  "title": "项目代码",
  "tabs": [
    {
      "key": "browser",
      "title": "文件浏览",
      "components": [
        {"type": "FileBrowser", "rootPath": "D:/project/src", "height": 400}
      ]
    },
    {
      "key": "main",
      "title": "入口文件",
      "components": [
        {"type": "FileViewer", "filePath": "D:/project/src/index.ts", "height": 400}
      ]
    }
  ]
}
\`\`\`

**错误做法 - 不要在 JSON 中嵌入完整代码！** 会导致 JSON 解析失败。

如果用户要查看具体代码片段，可以用 CodeEditor 展示**短小的代码片段**（不超过 20 行）：

\`\`\`json
{"type": "CodeEditor", "code": "def main():\\n    print('hello')", "language": "python"}
\`\`\`

### 交互式按钮

使用 Button 组件创建可点击的按钮，通过 action 属性定义点击行为：

\`\`\`json
{"type": "Button", "text": "启动项目", "variant": "primary", "icon": "PlayCircle", "action": {"type": "shell", "command": "python server.py"}}
\`\`\`

**支持的 action 类型：**

- **shell**: 执行 shell 命令（通过 Client Agent）
  - \`{"type": "shell", "command": "python server.py"}\`
  - \`{"type": "shell", "command": "npm start"}\`
  - \`{"type": "shell", "command": "docker-compose up -d"}\`

- **navigate**: 打开 URL 或页面导航
  - \`{"type": "navigate", "path": "http://localhost:8000"}\` - 打开外部链接
  - \`{"type": "navigate", "path": "/settings"}\` - 内部页面跳转

- **chat**: 发送消息到 AI 对话
  - \`{"type": "chat", "message": "查看项目日志"}\`

**按钮示例 - 项目控制面板：**

\`\`\`json
{
  "type": "Container",
  "children": [
    {"type": "Button", "text": "启动项目", "variant": "primary", "icon": "PlayCircle", "action": {"type": "shell", "command": "python server.py"}},
    {"type": "Button", "text": "停止项目", "variant": "default", "icon": "StopOutlined", "action": {"type": "shell", "command": "taskkill /f /im python.exe"}},
    {"type": "Button", "text": "打开主页", "variant": "link", "icon": "LinkOutlined", "action": {"type": "navigate", "path": "http://localhost:8000"}}
  ]
}
\`\`\`

### 布局

使用 Container、Row、Col 组织布局，span 取值 1-24。
`;

  return corePrompt + clientAgentAddendum;
}

/**
 * 加载 MCP 配置
 */
async function loadMCPConfig(): Promise<MCPServerConfig[]> {
  // 查找 MCP 配置文件
  const possiblePaths = [
    path.join(process.cwd(), '.lsc-ai', 'mcp.json'),
    path.join(os.homedir(), '.lsc-ai', 'mcp.json'),
    path.join(os.homedir(), '.config', 'lsc-ai', 'mcp.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.mcpServers && Array.isArray(config.mcpServers)) {
          console.log(`[Executor] 加载 MCP 配置: ${configPath}`);
          return config.mcpServers;
        }
      } catch (error) {
        console.warn(`[Executor] 解析 MCP 配置失败: ${configPath}`, error);
      }
    }
  }

  return [];
}

/**
 * 任务执行器
 */
export class TaskExecutor {
  private mastraAgent: Agent | null = null;
  private memory: Memory | null = null;
  private lscTools: LscTool[] = [];
  private lscOfficeTools: LscTool[] = [];
  private lscMcpTools: LscTool[] = [];
  private mastraTools: Record<string, any> = {};
  private currentTask: AgentTask | null = null;
  private isExecuting = false;
  private abortController: AbortController | null = null;
  private initialized = false;

  /**
   * 初始化执行器（Mastra Agent 版本）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const config = configManager.getAll();

    // 验证 API Key
    const apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      throw new Error('API Key 未配置，请使用 `lsc-agent config --set apiKey=your-key` 设置');
    }

    // 1. 创建默认工具（45+ 工具）并转换为 Mastra 格式
    this.lscTools = createDefaultTools({});
    console.log(`[Executor] 加载默认工具: ${this.lscTools.length} 个`);

    // 2. 加载 Office 工具
    try {
      this.lscOfficeTools = await loadOfficeTools();
      console.log(`[Executor] 加载 Office 工具: ${this.lscOfficeTools.length} 个`);
    } catch (error) {
      console.warn('[Executor] Office 工具加载失败（可选功能）:', error);
      this.lscOfficeTools = [];
    }

    // 3. 加载 MCP 工具
    try {
      const mcpConfigs = await loadMCPConfig();
      if (mcpConfigs.length > 0) {
        for (const serverConfig of mcpConfigs) {
          await mcpManager.addServer(serverConfig);
        }
        this.lscMcpTools = mcpManager.getTools();
        console.log(`[Executor] 加载 MCP 工具: ${this.lscMcpTools.length} 个`);
      }
    } catch (error) {
      console.warn('[Executor] MCP 工具加载失败（可选功能）:', error);
      this.lscMcpTools = [];
    }

    // 4. 转换所有工具为 Mastra 格式
    this.mastraTools = convertAllTools([
      ...this.lscTools,
      ...this.lscOfficeTools,
      ...this.lscMcpTools,
    ]);

    const totalTools = Object.keys(this.mastraTools).length;
    console.log(`[Executor] 工具转换完成: ${totalTools} 个 Mastra 工具`);

    // 5. 初始化本地 Memory（SQLite）
    const dataDir = path.join(os.homedir(), '.lsc-ai');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const libsqlUrl = `file:${path.join(dataDir, 'client-agent.db')}`;

    const storage = new LibSQLStore({ id: 'client-agent-storage', url: libsqlUrl });
    const vector = new LibSQLVector({ id: 'client-agent-vector', url: libsqlUrl });

    this.memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      options: {
        lastMessages: 30,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
          scope: 'resource',
        },
      },
    });

    console.log(`[Executor] Mastra Memory 已初始化: ${libsqlUrl}`);
    this.initialized = true;
  }

  /**
   * 创建 Mastra Agent 实例
   * @param taskWorkDir 任务指定的工作目录
   */
  private createMastraAgent(taskWorkDir?: string): Agent {
    const config = configManager.getAll();
    const workDir = taskWorkDir || config.workDir || process.cwd();
    console.log(`[Executor] createMastraAgent 使用工作目录: ${workDir}`);

    // 验证 API Key
    const apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('API Key 未配置，请使用 `lsc-agent config --set apiKey=your-key` 设置');
    }

    // 选择模型 provider
    const provider = config.apiProvider || 'deepseek';
    const modelName = config.model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o');

    console.log(`[Executor] API Key loaded: ${!!apiKey}, BaseURL: ${config.apiBaseUrl || 'default'}, Provider: ${provider}, Model: ${modelName}`);

    const model = provider === 'deepseek'
      ? createDeepSeek({ apiKey, baseURL: config.apiBaseUrl })(modelName)
      : createOpenAI({ apiKey, baseURL: config.apiBaseUrl })(modelName);

    return new Agent({
      id: 'client-agent',
      name: 'client-agent',
      instructions: getClientAgentSystemPrompt(workDir),
      model,
      memory: this.memory!,
      tools: this.mastraTools,
    });
  }

  /**
   * 执行任务（Mastra Agent 版本）
   */
  async executeTask(task: AgentTask): Promise<void> {
    if (this.isExecuting) {
      console.warn('[Executor] Already executing a task');
      socketClient.sendTaskResult({
        taskId: task.taskId,
        sessionId: task.sessionId,
        status: 'failed',
        error: 'Agent is busy with another task',
      });
      return;
    }

    this.isExecuting = true;
    this.currentTask = task;
    this.abortController = new AbortController();

    try {
      socketClient.sendTaskStatus(task.taskId, 'running');

      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`[Executor] 收到任务，payload.workDir = "${task.payload.workDir}"`);

      if (task.payload.workDir) {
        console.log(`[Executor] 更新工作目录为: ${task.payload.workDir}`);
        configManager.set('workDir', task.payload.workDir);
      }

      // 处理文件操作（不需要 AI Agent）
      if (task.type === 'file:read') {
        await this.handleFileRead(task);
        return;
      }
      if (task.type === 'file:list') {
        await this.handleFileList(task);
        return;
      }
      if (task.type === 'file:write') {
        await this.handleFileWrite(task);
        return;
      }

      // 创建 Mastra Agent
      const agent = this.createMastraAgent(task.payload.workDir);
      this.mastraAgent = agent;

      // 构建消息
      let message: string;
      switch (task.type) {
        case 'chat':
          if (!task.payload.message) throw new Error('Invalid chat task: missing message');
          message = task.payload.workbenchContext
            ? `${task.payload.workbenchContext}\n\n---\n\n用户消息: ${task.payload.message}`
            : task.payload.message;
          break;
        case 'execute':
          if (!task.payload.command) throw new Error('Invalid execute task: missing command');
          message = `请执行以下命令并返回结果：\n\`\`\`\n${task.payload.command}\n\`\`\``;
          break;
        case 'file_operation':
          message = task.payload.message || '';
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // 构建消息列表：优先使用 Server 下发的 history 以保持上下文连续性
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      if (task.payload.history && task.payload.history.length > 0) {
        // Server 下发了历史消息，注入为上下文（与远程模式共享）
        messages.push(...task.payload.history);
        console.log(`[Executor] 注入 Server 历史消息: ${task.payload.history.length} 条`);
      }

      // 当前用户消息
      messages.push({ role: 'user', content: message });

      // 使用 Mastra 流式响应
      const stream = await agent.stream(messages as any, {
        memory: {
          thread: task.sessionId || `task-${task.taskId}`,
          resource: task.userId || 'local-user',
        },
      });

      let fullContent = '';
      let hasToolCalls = false;
      const reader = stream.fullStream.getReader();

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        switch (chunk.type) {
          case 'text-delta':
            if (chunk.payload?.text) {
              fullContent += chunk.payload.text;
              socketClient.sendStreamChunk(task.taskId, chunk.payload.text);
            }
            break;
          case 'tool-call':
            hasToolCalls = true;
            if (chunk.payload) {
              socketClient.sendToolCall(
                task.taskId,
                chunk.payload.toolName,
                chunk.payload.args || {},
              );
            }
            break;
          case 'tool-result':
            if (chunk.payload) {
              socketClient.sendToolResult(task.taskId, chunk.payload.toolName, {
                success: true,
                output: typeof chunk.payload.result === 'string'
                  ? chunk.payload.result
                  : JSON.stringify(chunk.payload.result),
              });
            }
            break;
        }
      }

      if (!fullContent) {
        fullContent = await stream.text;
      }

      // 空 stream 检测：没有文本输出且没有工具调用，视为 AI 无响应
      if (!fullContent && !hasToolCalls) {
        console.error('[Executor] AI 返回空响应，可能是 API Key 无效或服务不可用');
        socketClient.sendTaskResult({
          taskId: task.taskId,
          sessionId: task.sessionId,
          status: 'failed',
          error: '本地 AI 调用无响应，请检查 API Key 配置是否正确（lsc-agent config --set apiKey=your-key）',
        });
        return;
      }

      socketClient.sendTaskResult({
        taskId: task.taskId,
        sessionId: task.sessionId,
        status: 'completed',
        result: fullContent,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Executor] Task failed: ${errorMessage}`);

      socketClient.sendTaskResult({
        taskId: task.taskId,
        sessionId: task.sessionId,
        status: 'failed',
        error: errorMessage,
      });
    } finally {
      this.isExecuting = false;
      this.currentTask = null;
      this.abortController = null;
      this.mastraAgent = null;
    }
  }

  /**
   * 处理文件读取请求（直接文件操作，不经过 AI）
   */
  private async handleFileRead(task: AgentTask): Promise<void> {
    const { filePath, encoding = 'utf-8' } = task.payload;

    if (!filePath) {
      socketClient.sendFileResponse('file:content', {
        filePath: '',
        error: '未指定文件路径',
      });
      return;
    }

    try {
      const stats = fs.statSync(filePath);
      const isBinary = encoding === 'base64';

      let content: string;
      let base64: string | undefined;

      if (isBinary) {
        const buffer = fs.readFileSync(filePath);
        base64 = buffer.toString('base64');
        content = '';
      } else {
        content = fs.readFileSync(filePath, encoding as BufferEncoding);
      }

      // 检测文件类型
      const ext = path.extname(filePath).toLowerCase();
      let fileType = 'text';
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h'].includes(ext)) {
        fileType = 'code';
      } else if (ext === '.md') {
        fileType = 'markdown';
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'].includes(ext)) {
        fileType = 'image';
      } else if (ext === '.pdf') {
        fileType = 'pdf';
      } else if (['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv'].includes(ext)) {
        fileType = 'video';
      } else if (['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'].includes(ext)) {
        fileType = 'audio';
      } else if (['.doc', '.docx'].includes(ext)) {
        fileType = 'word';
      } else if (['.xls', '.xlsx'].includes(ext)) {
        fileType = 'excel';
      } else if (['.ppt', '.pptx'].includes(ext)) {
        fileType = 'ppt';
      }

      // 检测编程语言
      const languageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.json': 'json',
        '.html': 'html',
        '.css': 'css',
        '.sql': 'sql',
        '.sh': 'shell',
        '.md': 'markdown',
        '.yml': 'yaml',
        '.yaml': 'yaml',
      };

      socketClient.sendFileResponse('file:content', {
        filePath,
        content,
        base64,
        fileType,
        language: languageMap[ext] || 'plaintext',
        size: stats.size,
        filename: path.basename(filePath),
        isBinary,
      });

      console.log(`[Executor] 文件读取成功: ${filePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '读取文件失败';
      console.error(`[Executor] 文件读取失败: ${filePath}`, error);

      socketClient.sendFileResponse('file:content', {
        filePath,
        error: errorMessage,
      });
    } finally {
      this.isExecuting = false;
      this.currentTask = null;
    }
  }

  /**
   * 处理文件列表请求（直接文件操作，不经过 AI）
   */
  private async handleFileList(task: AgentTask): Promise<void> {
    const { rootPath, patterns } = task.payload;

    if (!rootPath) {
      socketClient.sendFileResponse('file:list', {
        rootPath: '',
        files: [],
        error: '未指定根目录',
      });
      return;
    }

    try {
      // 检查目录是否存在
      if (!fs.existsSync(rootPath)) {
        socketClient.sendFileResponse('file:list', {
          rootPath,
          files: [],
          error: '目录不存在',
        });
        return;
      }

      // 递归读取目录
      const readDir = (dirPath: string, depth: number = 0): any[] => {
        if (depth > 5) return []; // 限制递归深度

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const result: any[] = [];

        for (const entry of entries) {
          // 跳过隐藏文件和 node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            result.push({
              name: entry.name,
              path: fullPath,
              isDirectory: true,
              children: readDir(fullPath, depth + 1),
            });
          } else {
            // 如果指定了 patterns，检查是否匹配
            if (patterns && patterns.length > 0) {
              const ext = path.extname(entry.name).toLowerCase();
              const matches = patterns.some(p => {
                if (p.startsWith('*.')) {
                  return ext === p.slice(1);
                }
                return entry.name.includes(p);
              });
              if (!matches) continue;
            }

            try {
              const stats = fs.statSync(fullPath);
              result.push({
                name: entry.name,
                path: fullPath,
                isDirectory: false,
                size: stats.size,
                modifiedTime: stats.mtime.toISOString(),
              });
            } catch {
              result.push({
                name: entry.name,
                path: fullPath,
                isDirectory: false,
              });
            }
          }
        }

        // 排序：目录在前，文件在后
        return result.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      };

      const files = readDir(rootPath);

      socketClient.sendFileResponse('file:list', {
        rootPath,
        files,
      });

      console.log(`[Executor] 文件列表获取成功: ${rootPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取文件列表失败';
      console.error(`[Executor] 文件列表获取失败: ${rootPath}`, error);

      socketClient.sendFileResponse('file:list', {
        rootPath,
        files: [],
        error: errorMessage,
      });
    } finally {
      this.isExecuting = false;
      this.currentTask = null;
    }
  }

  /**
   * 处理文件写入请求（直接文件操作，不经过 AI）
   */
  private async handleFileWrite(task: AgentTask): Promise<void> {
    const { filePath, content, encoding = 'utf-8' } = task.payload;

    if (!filePath) {
      socketClient.sendFileResponse('file:writeResult', {
        filePath: '',
        success: false,
        error: '未指定文件路径',
      });
      return;
    }

    if (content === undefined) {
      socketClient.sendFileResponse('file:writeResult', {
        filePath,
        success: false,
        error: '未指定文件内容',
      });
      return;
    }

    try {
      // 确保目录存在
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // 写入文件
      fs.writeFileSync(filePath, content, { encoding: encoding as BufferEncoding });

      socketClient.sendFileResponse('file:writeResult', {
        filePath,
        success: true,
      });

      console.log(`[Executor] 文件写入成功: ${filePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '写入文件失败';
      console.error(`[Executor] 文件写入失败: ${filePath}`, error);

      socketClient.sendFileResponse('file:writeResult', {
        filePath,
        success: false,
        error: errorMessage,
      });
    } finally {
      this.isExecuting = false;
      this.currentTask = null;
    }
  }

  /**
   * 取消当前任务
   */
  cancelCurrentTask(): void {
    if (this.currentTask && this.abortController) {
      this.abortController.abort();
      socketClient.sendTaskResult({
        taskId: this.currentTask.taskId,
        sessionId: this.currentTask.sessionId,
        status: 'cancelled',
      });
      this.isExecuting = false;
      this.currentTask = null;
      this.abortController = null;
      this.mastraAgent = null;
    }
  }

  /**
   * 检查是否正在执行任务
   */
  isBusy(): boolean {
    return this.isExecuting;
  }

  /**
   * 获取当前任务 ID
   */
  getCurrentTaskId(): string | null {
    return this.currentTask?.taskId ?? null;
  }

  /**
   * 获取已加载的工具列表
   */
  getLoadedTools(): { name: string; category: string }[] {
    const result: { name: string; category: string }[] = [];

    for (const tool of this.lscTools) {
      result.push({ name: tool.definition.name, category: 'default' });
    }
    for (const tool of this.lscOfficeTools) {
      result.push({ name: tool.definition.name, category: 'office' });
    }
    for (const tool of this.lscMcpTools) {
      result.push({ name: tool.definition.name, category: 'mcp' });
    }

    return result;
  }
}

// 导出单例
export const taskExecutor = new TaskExecutor();
