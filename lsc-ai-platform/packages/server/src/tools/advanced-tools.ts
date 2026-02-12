/**
 * 高级工具（Mastra 格式）
 *
 * Web、SQL、Notebook、Todo 等高级工具
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 模块级工具实例缓存
const _cache: Record<string, any> = {};

// ============================================================================
// Web 工具
// ============================================================================

export const webSearchTool = createTool({
  id: 'webSearch',
  description: `搜索网页内容。使用搜索引擎查找信息。`,
  inputSchema: z.object({
    query: z.string().describe('搜索关键词'),
    num: z.number().optional().describe('返回结果数量（默认 5）'),
  }),
  execute: async ({ query, num }) => {
    try {
      if (!_cache.webSearch) {
        const { WebSearchTool } = await import('./mastra/webSearch.js');
        _cache.webSearch = new WebSearchTool();
      }
      const result = await _cache.webSearch.execute({ query, num });
      return result;
    } catch (error) {
      throw new Error(`网页搜索失败: ${(error as Error).message}`);
    }
  },
});

export const webFetchTool = createTool({
  id: 'webFetch',
  description: `抓取网页内容。获取指定 URL 的 HTML 内容。`,
  inputSchema: z.object({
    url: z.string().describe('要抓取的网页 URL'),
    selector: z.string().optional().describe('CSS 选择器（可选，只返回匹配的内容）'),
  }),
  execute: async ({ url, selector }) => {
    try {
      if (!_cache.webFetch) {
        const { WebFetchTool } = await import('./mastra/webFetch.js');
        _cache.webFetch = new WebFetchTool();
      }
      const result = await _cache.webFetch.execute({ url, selector });
      return result;
    } catch (error) {
      throw new Error(`网页抓取失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// SQL 工具
// ============================================================================

export const sqlTool = createTool({
  id: 'sql',
  description: `执行 SQL 查询。支持 SELECT、INSERT、UPDATE、DELETE 等操作。`,
  inputSchema: z.object({
    query: z.string().describe('SQL 查询语句'),
    database: z.string().optional().describe('数据库名称（可选，使用默认数据库）'),
  }),
  execute: async ({ query, database }) => {
    try {
      if (!_cache.sql) {
        const { SqlTool } = await import('./mastra/sql.js');
        _cache.sql = new SqlTool();
      }
      const result = await _cache.sql.execute({ query, database });
      return result;
    } catch (error) {
      throw new Error(`SQL 执行失败: ${(error as Error).message}`);
    }
  },
});

export const sqlConfigTool = createTool({
  id: 'sqlConfig',
  description: `配置 SQL 数据库连接。`,
  inputSchema: z.object({
    type: z.enum(['mysql', 'postgres', 'sqlite']).describe('数据库类型'),
    host: z.string().optional().describe('主机地址'),
    port: z.number().optional().describe('端口'),
    database: z.string().describe('数据库名称'),
    user: z.string().optional().describe('用户名'),
    password: z.string().optional().describe('密码'),
  }),
  execute: async (config) => {
    try {
      if (!_cache.sqlConfig) {
        const { SqlConfigTool } = await import('./mastra/sql.js');
        _cache.sqlConfig = new SqlConfigTool();
      }
      const result = await _cache.sqlConfig.execute(config);
      return result;
    } catch (error) {
      throw new Error(`SQL 配置失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Jupyter Notebook 工具
// ============================================================================

export const notebookEditTool = createTool({
  id: 'notebookEdit',
  description: `编辑 Jupyter Notebook (.ipynb) 文件。`,
  inputSchema: z.object({
    notebook_path: z.string().describe('Notebook 文件路径'),
    new_source: z.string().describe('新的 cell 内容'),
    cell_id: z.string().optional().describe('要编辑的 cell ID'),
    cell_type: z.enum(['code', 'markdown']).optional().describe('Cell 类型'),
    edit_mode: z.enum(['replace', 'insert', 'delete']).optional().describe('编辑模式'),
  }),
  execute: async (params) => {
    try {
      if (!_cache.notebookEdit) {
        const { NotebookEditTool } = await import('./mastra/notebookEdit.js');
        _cache.notebookEdit = new NotebookEditTool();
      }
      const result = await _cache.notebookEdit.execute(params);
      return result;
    } catch (error) {
      throw new Error(`Notebook 编辑失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Todo 任务管理工具
// ============================================================================

// 模块级 TodoStore 单例缓存
let _todoStoreSingleton: any = null;

export const todoWriteTool = createTool({
  id: 'todoWrite',
  description: `管理 Todo 任务列表。创建、更新、删除任务。`,
  inputSchema: z.object({
    action: z.enum(['create', 'update', 'delete', 'list']).describe('操作类型'),
    taskId: z.string().optional().describe('任务 ID（update/delete 时需要）'),
    title: z.string().optional().describe('任务标题'),
    description: z.string().optional().describe('任务描述'),
    status: z.enum(['pending', 'in_progress', 'completed']).optional().describe('任务状态'),
  }),
  execute: async (params) => {
    try {
      const { TodoWriteTool, createTodoStore } = await import('./mastra/todoWrite.js');
      if (!_todoStoreSingleton) {
        _todoStoreSingleton = createTodoStore();
      }
      const tool = new TodoWriteTool(_todoStoreSingleton);
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      throw new Error(`Todo 操作失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 用户交互工具
// ============================================================================

export const askUserTool = createTool({
  id: 'askUser',
  description: `询问用户问题。当需要用户输入或确认时使用。`,
  inputSchema: z.object({
    question: z.string().describe('要问用户的问题'),
    options: z.array(z.string()).optional().describe('可选项列表（多选题）'),
  }),
  execute: async ({ question, options }) => {
    try {
      if (!_cache.askUser) {
        const { AskUserTool } = await import('./mastra/askUser.js');
        _cache.askUser = new AskUserTool();
      }
      const result = await _cache.askUser.execute({ question, options });
      return result;
    } catch (error) {
      throw new Error(`询问用户失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 撤销工具
// ============================================================================

export const undoTool = createTool({
  id: 'undo',
  description: `撤销最近的文件修改操作。`,
  inputSchema: z.object({
    steps: z.number().optional().describe('撤销步数（默认 1）'),
  }),
  execute: async ({ steps = 1 }) => {
    try {
      if (!_cache.undo) {
        const { UndoTool } = await import('./mastra/undo.js');
        _cache.undo = new UndoTool();
      }
      const result = await _cache.undo.execute({ steps });
      return result;
    } catch (error) {
      throw new Error(`撤销失败: ${(error as Error).message}`);
    }
  },
});

export const modificationHistoryTool = createTool({
  id: 'modificationHistory',
  description: `查看文件修改历史。`,
  inputSchema: z.object({
    file_path: z.string().optional().describe('文件路径（可选，查看所有修改）'),
  }),
  execute: async ({ file_path }) => {
    try {
      if (!_cache.modHistory) {
        const { ModificationHistoryTool } = await import('./mastra/undo.js');
        _cache.modHistory = new ModificationHistoryTool();
      }
      const result = await _cache.modHistory.execute({ file_path });
      return result;
    } catch (error) {
      throw new Error(`查看历史失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 数据库连接器查询工具
// ============================================================================

// ConnectorService 实例引用（由 MastraAgentService 注入）
let _connectorService: any = null;

/**
 * 设置 ConnectorService 实例（在 MastraAgentService 初始化时调用）
 */
export function setConnectorService(service: any) {
  _connectorService = service;
}

export const queryDatabaseTool = createTool({
  id: 'queryDatabase',
  description: '查询外部数据库。根据连接名称执行只读SQL查询，返回查询结果。使用此工具前，管理员需先在设置页面配置数据库连接。',
  inputSchema: z.object({
    connectionName: z.string().describe('数据库连接名称（在设置中配置的名称）'),
    sql: z.string().describe('SQL查询语句（仅限只读SELECT查询）'),
    params: z.array(z.any()).optional().describe('SQL参数（用于参数化查询）'),
  }),
  execute: async ({ connectionName, sql, params }) => {
    try {
      if (!_connectorService) {
        throw new Error('数据库连接器服务未初始化，请联系管理员');
      }

      // Find the credential by name
      const credential = await _connectorService.findByName(connectionName);
      if (!credential) {
        throw new Error(`未找到名为"${connectionName}"的数据库连接，请检查连接名称或在设置中配置`);
      }

      const result = await _connectorService.query(credential.id, sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields,
      };
    } catch (error) {
      throw new Error(`数据库查询失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 导出所有高级工具
// ============================================================================

export const advancedTools = {
  webSearch: webSearchTool,
  webFetch: webFetchTool,
  sql: sqlTool,
  sqlConfig: sqlConfigTool,
  notebookEdit: notebookEditTool,
  todoWrite: todoWriteTool,
  askUser: askUserTool,
  undo: undoTool,
  modificationHistory: modificationHistoryTool,
  queryDatabase: queryDatabaseTool,
};
