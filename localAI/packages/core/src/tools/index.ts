export * from './types.js';
export * from './errors.js';
export * from './retry.js';
export * from './fileTracker.js';
export * from './read.js';
export * from './write.js';
export * from './edit.js';
export * from './bash.js';
export * from './glob.js';
export * from './grep.js';
export * from './webSearch.js';
export * from './webFetch.js';
export * from './notebookEdit.js';
export * from './todoWrite.js';
export * from './askUser.js';
export * from './bashBackground.js';
export * from './sql.js';
export * from './task.js';
export * from './planTools.js';
export * from './skill.js';
// Office 工具使用懒加载，不在这里导出
// export * from './office/index.js';
export * from './fileOps.js';
export * from './git.js';
export * from './undo.js';
export * from './searchHistory.js';

import { ReadTool } from './read.js';
import { WriteTool } from './write.js';
import { EditTool } from './edit.js';
import { BashTool } from './bash.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { WebSearchTool } from './webSearch.js';
import { WebFetchTool } from './webFetch.js';
import { NotebookEditTool } from './notebookEdit.js';
import { TodoWriteTool, createTodoStore, type TodoStore } from './todoWrite.js';
import { AskUserTool, type UserInputHandler } from './askUser.js';
import { BashOutputTool, KillShellTool, ListShellsTool } from './bashBackground.js';
import { SqlTool, SqlConfigTool, databaseManager } from './sql.js';
import { TaskTool, TaskOutputTool, ListTasksTool } from './task.js';
import { createPlanTools } from './planTools.js';
import { SkillTool, ListSkillsTool } from './skill.js';
// Office 工具改为动态导入
import { MkdirTool, CopyTool, MoveTool, RemoveTool, ListTool } from './fileOps.js';
import { UndoTool, ModificationHistoryTool } from './undo.js';
import type { LLMProvider } from '../llm/types.js';
import {
  GitStatusTool,
  GitDiffTool,
  GitLogTool,
  GitAddTool,
  GitCommitTool,
  GitBranchTool,
} from './git.js';
import type { Tool } from './types.js';

export interface CreateToolsOptions {
  /** TodoStore 实例（可选，用于持久化任务列表） */
  todoStore?: TodoStore;
  /** 用户输入处理器（可选，用于 AskUser 工具） */
  userInputHandler?: UserInputHandler;
  /** 是否包含 Office 工具（默认 false，因为加载较慢） */
  includeOfficeTools?: boolean;
}

/**
 * 创建所有默认工具（不包含 Office 工具，因为加载较慢）
 */
export function createDefaultTools(options?: CreateToolsOptions): Tool[] {
  const todoStore = options?.todoStore || createTodoStore();

  return [
    // 基础文件操作
    new ReadTool(),
    new WriteTool(),
    new EditTool(),

    // 文件系统操作
    new MkdirTool(),
    new CopyTool(),
    new MoveTool(),
    new RemoveTool(),
    new ListTool(),

    // Shell 操作
    new BashTool(),
    new BashOutputTool(),
    new KillShellTool(),
    new ListShellsTool(),

    // 搜索
    new GlobTool(),
    new GrepTool(),

    // 网络
    new WebSearchTool(),
    new WebFetchTool(),

    // Git 版本控制
    new GitStatusTool(),
    new GitDiffTool(),
    new GitLogTool(),
    new GitAddTool(),
    new GitCommitTool(),
    new GitBranchTool(),

    // Jupyter
    new NotebookEditTool(),

    // 任务管理
    new TodoWriteTool(todoStore),

    // 用户交互
    new AskUserTool(options?.userInputHandler),

    // 数据库
    new SqlTool(),
    new SqlConfigTool(),

    // Plan 模式工具
    ...createPlanTools(),

    // Skill 技能工具
    new SkillTool(),
    new ListSkillsTool(),

    // 撤销和历史
    new UndoTool(),
    new ModificationHistoryTool(),

    // Office 工具不再默认加载，使用 loadOfficeTools() 按需加载
  ];
}

/**
 * 动态加载 Office 工具（按需加载，避免启动慢）
 */
export async function loadOfficeTools(): Promise<Tool[]> {
  const {
    CreateWordTool,
    EditWordTool,
    CreateExcelTool,
    EditExcelTool,
    CreatePPTTool,
    CreatePDFTool,
    ReadOfficeTool,
    CreateChartTool,
  } = await import('./office/index.js');

  return [
    new CreateWordTool(),
    new EditWordTool(),
    new CreateExcelTool(),
    new EditExcelTool(),
    new CreatePPTTool(),
    new CreatePDFTool(),
    new ReadOfficeTool(),
    new CreateChartTool(),
  ];
}

/**
 * 创建子代理相关工具
 * 这些工具需要 LLM 实例，所以单独创建
 */
export interface CreateTaskToolsOptions {
  /** LLM 提供者 */
  llm: LLMProvider;
  /** 子代理可用的工具 */
  tools: Tool[];
  /** 工作目录 */
  cwd?: string;
}

export function createTaskTools(options: CreateTaskToolsOptions): Tool[] {
  return [
    new TaskTool({
      llm: options.llm,
      tools: options.tools,
      cwd: options.cwd,
    }),
    new TaskOutputTool(),
    new ListTasksTool(),
  ];
}
