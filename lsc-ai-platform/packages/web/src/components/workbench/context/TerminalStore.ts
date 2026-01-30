/**
 * Workbench 终端状态管理
 *
 * 管理命令执行输出的显示
 */

import { create } from 'zustand';

/** 命令执行状态 */
export type CommandStatus = 'running' | 'success' | 'error' | 'cancelled';

/** 单条命令记录 */
export interface CommandRecord {
  /** 命令 ID */
  id: string;
  /** 命令内容 */
  command: string;
  /** 输出内容（累积） */
  output: string;
  /** 执行状态 */
  status: CommandStatus;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 错误信息 */
  error?: string;
}

interface TerminalStore {
  /** 命令历史记录 */
  commands: CommandRecord[];
  /** 终端面板是否展开 */
  isExpanded: boolean;
  /** 终端面板高度 */
  height: number;
  /** 当前正在执行的命令 ID */
  activeCommandId: string | null;

  /** 添加新命令 */
  addCommand: (id: string, command: string) => void;
  /** 追加输出 */
  appendOutput: (id: string, output: string) => void;
  /** 更新命令状态 */
  updateStatus: (id: string, status: CommandStatus, error?: string) => void;
  /** 清空历史 */
  clearHistory: () => void;
  /** 切换展开状态 */
  toggleExpanded: () => void;
  /** 设置展开状态 */
  setExpanded: (expanded: boolean) => void;
  /** 设置高度 */
  setHeight: (height: number) => void;
  /** 获取命令记录 */
  getCommand: (id: string) => CommandRecord | undefined;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  commands: [],
  isExpanded: false,
  height: 200,
  activeCommandId: null,

  addCommand: (id, command) => {
    const newCommand: CommandRecord = {
      id,
      command,
      output: '',
      status: 'running',
      startTime: Date.now(),
    };
    set((state) => ({
      commands: [...state.commands, newCommand],
      activeCommandId: id,
      isExpanded: true, // 添加命令时自动展开
    }));
  },

  appendOutput: (id, output) => {
    set((state) => ({
      commands: state.commands.map((cmd) =>
        cmd.id === id ? { ...cmd, output: cmd.output + output } : cmd
      ),
    }));
  },

  updateStatus: (id, status, error) => {
    set((state) => ({
      commands: state.commands.map((cmd) =>
        cmd.id === id
          ? { ...cmd, status, error, endTime: Date.now() }
          : cmd
      ),
      activeCommandId: status === 'running' ? id : null,
    }));
  },

  clearHistory: () => {
    set({ commands: [], activeCommandId: null });
  },

  toggleExpanded: () => {
    set((state) => ({ isExpanded: !state.isExpanded }));
  },

  setExpanded: (expanded) => {
    set({ isExpanded: expanded });
  },

  setHeight: (height) => {
    // 限制高度范围
    const clampedHeight = Math.max(100, Math.min(500, height));
    set({ height: clampedHeight });
  },

  getCommand: (id) => {
    return get().commands.find((cmd) => cmd.id === id);
  },
}));

/** 获取终端是否展开 */
export function useTerminalExpanded(): boolean {
  return useTerminalStore((state) => state.isExpanded);
}

/** 获取命令历史 */
export function useTerminalCommands(): CommandRecord[] {
  return useTerminalStore((state) => state.commands);
}

/** 获取当前活动命令 */
export function useActiveCommand(): CommandRecord | null {
  return useTerminalStore((state) => {
    if (!state.activeCommandId) return null;
    return state.commands.find((cmd) => cmd.id === state.activeCommandId) || null;
  });
}
