/**
 * TodoWrite 工具 - 任务管理
 * 让 AI 能够创建和管理结构化的任务列表
 */

import type { Tool, ToolResult } from './types.js';

export interface TodoItem {
  id: string;
  /** 任务内容（祈使句形式，如 "修复登录错误"） */
  content: string;
  /** 任务状态 */
  status: 'pending' | 'in_progress' | 'completed';
  /** 进行时描述（如 "正在修复登录错误"），用于状态显示 */
  activeForm?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TodoStore {
  items: TodoItem[];
  onUpdate?: (items: TodoItem[]) => void;
}

/**
 * 创建一个 TodoStore 实例
 */
export function createTodoStore(onUpdate?: (items: TodoItem[]) => void): TodoStore {
  return {
    items: [],
    onUpdate,
  };
}

export class TodoWriteTool implements Tool {
  private store: TodoStore;

  constructor(store: TodoStore) {
    this.store = store;
  }

  definition = {
    name: 'todoWrite',
    description: `创建和管理任务列表。用于规划复杂任务、跟踪进度。

使用场景：
- 复杂多步骤任务（3步以上）
- 用户提供多个任务
- 需要跟踪进度的工作

任务状态：
- pending: 待处理
- in_progress: 正在处理（同时只能有一个）
- completed: 已完成

重要规则：
- 完成一个任务后立即标记为 completed
- 开始工作前标记为 in_progress
- 使用 todos 参数可以批量更新整个任务列表`,
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'update', 'remove', 'list', 'clear', 'set'],
          description: '操作类型：add（添加）、update（更新状态）、remove（删除）、list（列出）、clear（清空）、set（批量设置）',
        },
        content: {
          type: 'string',
          description: '任务内容，祈使句形式，如"修复登录错误"（add 时需要）',
        },
        activeForm: {
          type: 'string',
          description: '进行时描述，如"正在修复登录错误"，用于状态显示（add 时可选）',
        },
        id: {
          type: 'string',
          description: '任务 ID（update/remove 时需要）',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed'],
          description: '任务状态（update 时需要）',
        },
        todos: {
          type: 'array',
          description: '完整的任务列表（set 操作时使用），每个元素包含 content、status、activeForm',
        },
      },
      required: ['action'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as string;
    const content = args.content as string | undefined;
    const activeForm = args.activeForm as string | undefined;
    const id = args.id as string | undefined;
    const status = args.status as TodoItem['status'] | undefined;
    const todos = args.todos as Array<{ content: string; status: TodoItem['status']; activeForm?: string }> | undefined;

    try {
      switch (action) {
        case 'set': {
          // 批量设置任务列表（替换所有现有任务）
          if (!todos || !Array.isArray(todos)) {
            return { success: false, output: '', error: 'set 操作需要 todos 参数（数组格式）' };
          }
          const now = Date.now();
          this.store.items = todos.map((t, idx) => ({
            id: `todo_${now}_${idx}`,
            content: t.content,
            status: t.status || 'pending',
            activeForm: t.activeForm || t.content,
            createdAt: now,
            updatedAt: now,
          }));
          this.notifyUpdate();

          const statusCounts = {
            pending: this.store.items.filter(i => i.status === 'pending').length,
            in_progress: this.store.items.filter(i => i.status === 'in_progress').length,
            completed: this.store.items.filter(i => i.status === 'completed').length,
          };
          return {
            success: true,
            output: `已设置 ${this.store.items.length} 个任务\n待处理: ${statusCounts.pending}, 进行中: ${statusCounts.in_progress}, 已完成: ${statusCounts.completed}`,
          };
        }

        case 'add': {
          if (!content) {
            return { success: false, output: '', error: 'add 操作需要 content 参数' };
          }
          const newItem: TodoItem = {
            id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            content,
            status: 'pending',
            activeForm: activeForm || content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.store.items.push(newItem);
          this.notifyUpdate();
          return {
            success: true,
            output: `已添加任务: ${content}\nID: ${newItem.id}`,
          };
        }

        case 'update': {
          if (id === undefined && id !== 0) {
            return { success: false, output: '', error: 'update 操作需要 id 参数（任务 ID 或索引数字）' };
          }
          if (!status) {
            return { success: false, output: '', error: 'update 操作需要 status 参数' };
          }

          // 支持通过索引或 ID 查找任务
          let item: TodoItem | undefined;
          const idStr = String(id);

          // 如果是数字，按索引查找
          const numId = parseInt(idStr, 10);
          if (!isNaN(numId) && numId >= 0 && numId < this.store.items.length) {
            item = this.store.items[numId];
          } else {
            // 否则按 ID 查找
            item = this.store.items.find(i => i.id === idStr);
          }

          if (!item) {
            return { success: false, output: '', error: `未找到任务: ${id}（共 ${this.store.items.length} 个任务）` };
          }

          item.status = status;
          item.updatedAt = Date.now();
          this.notifyUpdate();
          return {
            success: true,
            output: `已更新任务状态: ${item.content} → ${status}`,
          };
        }

        case 'remove': {
          if (!id) {
            return { success: false, output: '', error: 'remove 操作需要 id 参数' };
          }
          const index = this.store.items.findIndex(i => i.id === id);
          if (index === -1) {
            return { success: false, output: '', error: `未找到任务: ${id}` };
          }
          const removed = this.store.items.splice(index, 1)[0];
          this.notifyUpdate();
          return {
            success: true,
            output: `已删除任务: ${removed.content}`,
          };
        }

        case 'list': {
          if (this.store.items.length === 0) {
            return { success: true, output: '当前没有任务' };
          }
          const statusIcon = {
            pending: '○',
            in_progress: '◐',
            completed: '●',
          };
          const list = this.store.items.map(item => {
            const display = item.status === 'in_progress' && item.activeForm
              ? item.activeForm
              : item.content;
            return `${statusIcon[item.status]} [${item.status}] ${display}`;
          }).join('\n');

          const statusCounts = {
            pending: this.store.items.filter(i => i.status === 'pending').length,
            in_progress: this.store.items.filter(i => i.status === 'in_progress').length,
            completed: this.store.items.filter(i => i.status === 'completed').length,
          };
          return {
            success: true,
            output: `任务列表 (${this.store.items.length} 项)\n待处理: ${statusCounts.pending}, 进行中: ${statusCounts.in_progress}, 已完成: ${statusCounts.completed}\n\n${list}`,
          };
        }

        case 'clear': {
          const count = this.store.items.length;
          this.store.items = [];
          this.notifyUpdate();
          return {
            success: true,
            output: `已清空 ${count} 个任务`,
          };
        }

        default:
          return { success: false, output: '', error: `未知操作: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `任务操作失败: ${(error as Error).message}`,
      };
    }
  }

  private notifyUpdate(): void {
    this.store.onUpdate?.(this.store.items);
  }

  /**
   * 获取当前任务列表
   */
  getItems(): TodoItem[] {
    return [...this.store.items];
  }

  /**
   * 批量设置任务（用于恢复状态）
   */
  setItems(items: TodoItem[]): void {
    this.store.items = items;
    this.notifyUpdate();
  }
}
