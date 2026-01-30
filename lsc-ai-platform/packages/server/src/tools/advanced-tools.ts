/**
 * 高级工具（Mastra 格式）
 *
 * Web、SQL、Notebook、Todo 等高级工具
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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
      const { WebSearchTool } = await import('./mastra/webSearch.js');
      const tool = new WebSearchTool();
      const result = await tool.execute({ query, num });
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
      const { WebFetchTool } = await import('./mastra/webFetch.js');
      const tool = new WebFetchTool();
      const result = await tool.execute({ url, selector });
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
      const { SqlTool } = await import('./mastra/sql.js');
      const tool = new SqlTool();
      const result = await tool.execute({ query, database });
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
      const { SqlConfigTool } = await import('./mastra/sql.js');
      const tool = new SqlConfigTool();
      const result = await tool.execute(config);
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
      const { NotebookEditTool } = await import('./mastra/notebookEdit.js');
      const tool = new NotebookEditTool();
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      throw new Error(`Notebook 编辑失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Todo 任务管理工具
// ============================================================================

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
      const todoStore = createTodoStore();
      const tool = new TodoWriteTool(todoStore);
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
      const { AskUserTool } = await import('./mastra/askUser.js');
      const tool = new AskUserTool();
      const result = await tool.execute({ question, options });
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
      const { UndoTool } = await import('./mastra/undo.js');
      const tool = new UndoTool();
      const result = await tool.execute({ steps });
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
      const { ModificationHistoryTool } = await import('./mastra/undo.js');
      const tool = new ModificationHistoryTool();
      const result = await tool.execute({ file_path });
      return result;
    } catch (error) {
      throw new Error(`查看历史失败: ${(error as Error).message}`);
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
};
