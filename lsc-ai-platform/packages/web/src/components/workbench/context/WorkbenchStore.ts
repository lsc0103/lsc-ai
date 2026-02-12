/**
 * LSC-AI Workbench 状态管理
 *
 * 使用 Zustand 管理 Workbench 的全局状态
 * 与现有 chat.ts store 保持一致的风格
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  WorkbenchSchema,
  WorkbenchTab,
  ComponentState,
  WorkbenchAction,
} from '../schema/types';
import { validateWorkbenchSchema } from '../schema/validator';
import { ensureNewSchema } from '../schema/schema-transformer';
import { ActionHandler, type ActionContext } from '../actions';

// ============================================================================
// 辅助函数
// ============================================================================

/** 为 schema 中缺少 id 的组件自动分配唯一 ID */
function assignComponentIds(schema: WorkbenchSchema): WorkbenchSchema {
  const tabs = schema.tabs.map((tab) => ({
    ...tab,
    components: (tab.components || []).map((comp, idx) => ({
      ...comp,
      id: comp.id || `${tab.key}-comp-${idx}`,
    })),
  }));
  return { ...schema, tabs };
}

// ============================================================================
// 状态类型定义
// ============================================================================

interface WorkbenchStore {
  // ====== 状态 ======
  /** 当前 Schema */
  schema: WorkbenchSchema | null;
  /** 当前激活的标签页 */
  activeTabKey: string;
  /** 各组件状态 */
  componentStates: Record<string, ComponentState>;
  /** 是否可见 */
  visible: boolean;
  /** 宽度比例（0-1，相对于可用空间） */
  widthRatio: number;
  /** 是否正在加载 */
  loading: boolean;
  /** 历史记录（用于撤销） */
  history: WorkbenchSchema[];
  /** 历史索引 */
  historyIndex: number;
  /** 用户手动关闭的标签页标题（防止 AI 重新添加） */
  userClosedTabs: Set<string>;

  // ====== 基础操作 ======
  /** 打开 Workbench 并设置 Schema */
  open: (schema: WorkbenchSchema) => void;
  /** 合并 Schema（将新标签页添加到现有 Workbench，而不是替换） */
  mergeSchema: (schema: WorkbenchSchema) => void;
  /** 关闭 Workbench */
  close: () => void;
  /** 切换可见性 */
  toggle: () => void;
  /** 设置 Schema（不改变可见性） */
  setSchema: (schema: WorkbenchSchema) => void;
  /** 清空 Schema */
  clear: () => void;

  // ====== 标签页操作 ======
  /** 切换标签页 */
  setActiveTab: (key: string) => void;
  /** 添加标签页 */
  addTab: (tab: WorkbenchTab) => void;
  /** 关闭标签页 */
  closeTab: (key: string) => void;
  /** 关闭多个标签页 */
  closeTabs: (keys: string[]) => void;
  /** 关闭其他标签页 */
  closeOtherTabs: (keepKey: string) => void;
  /** 更新标签页 */
  updateTab: (key: string, updates: Partial<WorkbenchTab>) => void;

  // ====== 快捷操作 ======
  /** 打开空白 Workbench（带文件浏览器） */
  openBlank: (rootPath?: string) => void;
  /** 打开文件预览 */
  openFile: (filePath: string, title?: string) => void;

  // ====== 组件状态操作 ======
  /** 设置组件状态 */
  setComponentState: (id: string, state: Partial<ComponentState>) => void;
  /** 获取组件状态 */
  getComponentState: (id: string) => ComponentState | undefined;
  /** 更新组件数据 */
  updateComponentData: (id: string, data: unknown) => void;

  // ====== 布局操作 ======
  /** 设置宽度比例 */
  setWidthRatio: (ratio: number) => void;

  // ====== 历史操作 ======
  /** 撤销 */
  undo: () => void;
  /** 重做 */
  redo: () => void;
  /** 是否可撤销 */
  canUndo: () => boolean;
  /** 是否可重做 */
  canRedo: () => boolean;

  // ====== 事件处理 ======
  /** 处理组件动作 */
  handleAction: (action: WorkbenchAction, context?: Record<string, unknown>) => Promise<{ success: boolean; error?: string; data?: unknown }>;

  // ====== 会话持久化 ======
  /** 获取可序列化的状态（用于保存） */
  getSerializableState: () => {
    schema: WorkbenchSchema | null;
    activeTabKey: string;
    visible: boolean;
    widthRatio: number;
  };
  /** 从保存的状态恢复 */
  loadState: (state: {
    schema?: WorkbenchSchema | null;
    activeTabKey?: string;
    visible?: boolean;
    widthRatio?: number;
  }) => void;
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 生成默认组件状态 */
function createDefaultComponentState(id: string): ComponentState {
  return {
    id,
    data: null,
    loading: false,
  };
}

/** 深拷贝 Schema */
function cloneSchema(schema: WorkbenchSchema): WorkbenchSchema {
  return JSON.parse(JSON.stringify(schema));
}

// ============================================================================
// Store 实现
// ============================================================================

export const useWorkbenchStore = create<WorkbenchStore>()(
  persist(
    (set, get) => ({
      // ====== 初始状态 ======
      schema: null,
      activeTabKey: '',
      componentStates: {},
      visible: false,
      widthRatio: 0.5, // 默认占 50%
      loading: false,
      history: [],
      historyIndex: -1,
      userClosedTabs: new Set<string>(),

      // ====== 基础操作 ======
      open: (schema) => {
        console.log('[WorkbenchStore] open() 被调用');
        // P0-5 修复：转换旧格式 schema（version 1.0 + blocks）为新格式（tabs）
        const normalizedSchema = ensureNewSchema(schema);
        const result = validateWorkbenchSchema(normalizedSchema);
        if (!result.sanitizedSchema || result.sanitizedSchema.tabs.length === 0) {
          console.error('Invalid Workbench Schema: no valid tabs', result.errors);
          return;
        }
        if (result.errors.length > 0) {
          console.warn('Workbench Schema has issues (partial render):', result.errors);
        }

        // 自动分配组件 ID（确保 componentStates 可正确存储/读取编辑内容）
        const sanitizedSchema = assignComponentIds(result.sanitizedSchema);
        const { history, historyIndex } = get();

        // 添加到历史记录
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(cloneSchema(sanitizedSchema));

        set({
          schema: sanitizedSchema,
          activeTabKey: sanitizedSchema.defaultActiveKey || sanitizedSchema.tabs[0]?.key || '',
          visible: true,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      mergeSchema: (newSchema) => {
        // P0-5 修复：转换旧格式 schema
        const normalizedSchema = ensureNewSchema(newSchema);
        const result = validateWorkbenchSchema(normalizedSchema);
        if (!result.sanitizedSchema || result.sanitizedSchema.tabs.length === 0) {
          console.error('Invalid Workbench Schema: no valid tabs', result.errors);
          return;
        }

        // 自动分配组件 ID
        const sanitizedNewSchema = assignComponentIds(result.sanitizedSchema);
        const { schema: currentSchema, history, historyIndex } = get();

        // 如果当前没有 schema，直接使用新的
        if (!currentSchema) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(cloneSchema(sanitizedNewSchema));
          set({
            schema: sanitizedNewSchema,
            activeTabKey: sanitizedNewSchema.defaultActiveKey || sanitizedNewSchema.tabs[0]?.key || '',
            visible: true,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
          return;
        }

        // 合并：将新 schema 的标签页合并到现有 schema
        const mergedSchema = cloneSchema(currentSchema);
        const { userClosedTabs } = get();

        // 构建现有 key -> index 映射（用于同 key 更新）
        const existingKeyIndex = new Map(mergedSchema.tabs.map((t, i) => [t.key, i]));
        const existingTitles = new Set(mergedSchema.tabs.map(t => t.title));
        const existingKeys = new Set(mergedSchema.tabs.map(t => t.key));

        let hasChanges = false;
        const newTabs: WorkbenchTab[] = [];

        for (const tab of sanitizedNewSchema.tabs) {
          // 跳过用户手动关闭的标签页
          if (userClosedTabs.has(tab.title)) {
            console.log(`[mergeSchema] 跳过用户已关闭的标签页: "${tab.title}"`);
            continue;
          }

          // 同 key 的标签页 → 原地更新内容
          const existingIdx = existingKeyIndex.get(tab.key);
          if (existingIdx !== undefined) {
            console.log(`[mergeSchema] 同 key 更新标签页: "${tab.key}" (${tab.title})`);
            mergedSchema.tabs[existingIdx] = { ...tab };
            hasChanges = true;
            continue;
          }

          // 同标题但不同 key → 跳过（避免重复）
          if (existingTitles.has(tab.title)) {
            console.log(`[mergeSchema] 跳过重复标签页: "${tab.title}"`);
            continue;
          }

          // 全新标签页 → 生成唯一 key 并追加
          let key = tab.key;
          let counter = 1;
          while (existingKeys.has(key)) {
            key = `${tab.key}-${counter}`;
            counter++;
          }
          existingKeys.add(key);
          existingTitles.add(tab.title);
          newTabs.push({ ...tab, key });
          hasChanges = true;
        }

        // 如果没有任何变化，直接返回
        if (!hasChanges) {
          console.log('[mergeSchema] 所有标签页都已存在且无变化，跳过合并');
          return;
        }

        mergedSchema.tabs.push(...newTabs);

        // 更新标题（如果新 schema 有标题）
        if (sanitizedNewSchema.title && sanitizedNewSchema.title !== '工作台') {
          mergedSchema.title = sanitizedNewSchema.title;
        }

        // 添加到历史记录
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(cloneSchema(mergedSchema));

        // 激活最新变化的标签页（新追加的优先，其次是更新的，最后是第一个已有的）
        const firstNewTabKey = newTabs[0]?.key || sanitizedNewSchema.tabs[0]?.key || currentSchema.tabs[0]?.key || '';

        set({
          schema: mergedSchema,
          activeTabKey: firstNewTabKey,
          visible: true,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      close: () => {
        set({ visible: false });
      },

      toggle: () => {
        set((state) => ({ visible: !state.visible }));
      },

      setSchema: (schema) => {
        // P0-5 修复：转换旧格式 schema
        const normalizedSchema = ensureNewSchema(schema);
        const result = validateWorkbenchSchema(normalizedSchema);
        if (!result.sanitizedSchema || result.sanitizedSchema.tabs.length === 0) {
          console.error('Invalid Workbench Schema: no valid tabs', result.errors);
          return;
        }
        if (result.errors.length > 0) {
          console.warn('Workbench Schema has issues (partial render):', result.errors);
        }

        // 自动分配组件 ID
        const sanitizedSchema = assignComponentIds(result.sanitizedSchema);
        const { history, historyIndex } = get();

        // 添加到历史记录
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(cloneSchema(sanitizedSchema));

        set({
          schema: sanitizedSchema,
          activeTabKey: sanitizedSchema.defaultActiveKey || sanitizedSchema.tabs[0]?.key || '',
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      clear: () => {
        set({
          schema: null,
          activeTabKey: '',
          componentStates: {},
          history: [],
          historyIndex: -1,
          userClosedTabs: new Set<string>(),
          visible: false, // 清空时同时关闭workbench
        });
      },

      // ====== 标签页操作 ======
      setActiveTab: (key) => {
        set({ activeTabKey: key });
      },

      addTab: (tab) => {
        set((state) => {
          if (!state.schema) return state;

          const newSchema = cloneSchema(state.schema);
          newSchema.tabs.push(tab);

          return {
            schema: newSchema,
            activeTabKey: tab.key,
          };
        });
      },

      closeTab: (key) => {
        set((state) => {
          if (!state.schema) return state;

          const newSchema = cloneSchema(state.schema);
          const index = newSchema.tabs.findIndex((t) => t.key === key);

          if (index === -1) return state;

          // 记录被关闭的标签页标题
          const closedTab = newSchema.tabs[index];
          const newUserClosedTabs = new Set(state.userClosedTabs);
          if (closedTab) {
            newUserClosedTabs.add(closedTab.title);
            console.log('[WorkbenchStore] 记录用户关闭的标签页:', closedTab.title);
          }

          newSchema.tabs.splice(index, 1);

          // 如果关闭的是当前标签页，切换到相邻的
          let newActiveKey = state.activeTabKey;
          if (state.activeTabKey === key && newSchema.tabs.length > 0) {
            const newIndex = Math.min(index, newSchema.tabs.length - 1);
            newActiveKey = newSchema.tabs[newIndex].key;
          }

          return {
            schema: newSchema.tabs.length > 0 ? newSchema : null,
            activeTabKey: newActiveKey,
            userClosedTabs: newUserClosedTabs,
          };
        });
      },

      closeTabs: (keys) => {
        set((state) => {
          if (!state.schema || keys.length === 0) return state;

          const newSchema = cloneSchema(state.schema);
          const keysToClose = new Set(keys);

          // 记录被关闭的标签页标题
          const newUserClosedTabs = new Set(state.userClosedTabs);
          newSchema.tabs.forEach((t) => {
            if (keysToClose.has(t.key)) {
              newUserClosedTabs.add(t.title);
              console.log('[WorkbenchStore] 记录用户关闭的标签页:', t.title);
            }
          });

          // 过滤掉要关闭的标签页
          newSchema.tabs = newSchema.tabs.filter((t) => !keysToClose.has(t.key));

          // 如果当前激活的标签页被关闭，切换到第一个
          let newActiveKey = state.activeTabKey;
          if (keysToClose.has(state.activeTabKey) && newSchema.tabs.length > 0) {
            newActiveKey = newSchema.tabs[0].key;
          }

          return {
            schema: newSchema.tabs.length > 0 ? newSchema : null,
            activeTabKey: newActiveKey,
            userClosedTabs: newUserClosedTabs,
          };
        });
      },

      closeOtherTabs: (keepKey) => {
        console.log('[WorkbenchStore] closeOtherTabs 被调用, keepKey:', keepKey);
        set((state) => {
          if (!state.schema) {
            console.log('[WorkbenchStore] closeOtherTabs: schema 为空，跳过');
            return state;
          }

          const newSchema = cloneSchema(state.schema);
          const beforeCount = newSchema.tabs.length;

          // 记录被关闭的标签页标题
          const newUserClosedTabs = new Set(state.userClosedTabs);
          newSchema.tabs.forEach((t) => {
            if (t.key !== keepKey && t.closable !== false) {
              newUserClosedTabs.add(t.title);
              console.log('[WorkbenchStore] 记录用户关闭的标签页:', t.title);
            }
          });

          // 只保留 keepKey 的标签页和不可关闭的标签页
          newSchema.tabs = newSchema.tabs.filter(
            (t) => t.key === keepKey || t.closable === false
          );

          const afterCount = newSchema.tabs.length;
          console.log('[WorkbenchStore] closeOtherTabs: 标签页数量', beforeCount, '->', afterCount);

          return {
            schema: newSchema.tabs.length > 0 ? newSchema : null,
            activeTabKey: keepKey,
            userClosedTabs: newUserClosedTabs,
          };
        });
      },

      updateTab: (key, updates) => {
        set((state) => {
          if (!state.schema) return state;

          const newSchema = cloneSchema(state.schema);
          const tab = newSchema.tabs.find((t) => t.key === key);

          if (!tab) return state;

          Object.assign(tab, updates);

          return { schema: newSchema };
        });
      },

      // ====== 快捷操作 ======
      openBlank: (rootPath) => {
        const blankSchema: WorkbenchSchema = {
          type: 'workbench',
          title: '工作台',
          tabs: [
            {
              key: 'browser',
              title: '文件浏览',
              components: rootPath
                ? [
                    {
                      type: 'FileBrowser',
                      rootPath,
                      // 不设置 height，让组件自动填满可用空间
                    },
                  ]
                : [],
            },
          ],
        };

        set({
          schema: blankSchema,
          activeTabKey: 'browser',
          visible: true,
        });
      },

      openFile: (filePath, title) => {
        const { schema, visible } = get();
        const filename = filePath.split(/[/\\]/).pop() || filePath;
        const tabKey = `file-${Date.now()}`;

        const newTab: WorkbenchTab = {
          key: tabKey,
          title: title || filename,
          components: [
            {
              type: 'FileViewer',
              filePath,
              // 不设置 height，让组件自动填满可用空间
            },
          ],
        };

        if (schema && visible) {
          // 已有 Workbench 打开，添加新标签页
          const newSchema = cloneSchema(schema);
          newSchema.tabs.push(newTab);
          set({
            schema: newSchema,
            activeTabKey: tabKey,
          });
        } else {
          // 创建新的 Workbench
          const newSchema: WorkbenchSchema = {
            type: 'workbench',
            title: '工作台',
            tabs: [newTab],
          };
          set({
            schema: newSchema,
            activeTabKey: tabKey,
            visible: true,
          });
        }
      },

      // ====== 组件状态操作 ======
      setComponentState: (id, partialState) => {
        set((state) => ({
          componentStates: {
            ...state.componentStates,
            [id]: {
              ...(state.componentStates[id] || createDefaultComponentState(id)),
              ...partialState,
            },
          },
        }));
      },

      getComponentState: (id) => {
        return get().componentStates[id];
      },

      updateComponentData: (id, data) => {
        set((state) => ({
          componentStates: {
            ...state.componentStates,
            [id]: {
              ...(state.componentStates[id] || createDefaultComponentState(id)),
              data,
            },
          },
        }));
      },

      // ====== 布局操作 ======
      setWidthRatio: (ratio) => {
        // 限制在合理范围内
        const clampedRatio = Math.max(0.2, Math.min(0.8, ratio));
        set({ widthRatio: clampedRatio });
      },

      // ====== 历史操作 ======
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;

        const newIndex = historyIndex - 1;
        const previousSchema = history[newIndex];

        set({
          schema: cloneSchema(previousSchema),
          historyIndex: newIndex,
          activeTabKey: previousSchema.defaultActiveKey || previousSchema.tabs[0]?.key || '',
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const newIndex = historyIndex + 1;
        const nextSchema = history[newIndex];

        set({
          schema: cloneSchema(nextSchema),
          historyIndex: newIndex,
          activeTabKey: nextSchema.defaultActiveKey || nextSchema.tabs[0]?.key || '',
        });
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // ====== 事件处理 ======
      handleAction: async (action, context = {}) => {
        const state = get();

        // 构建 ActionContext
        const actionContext: ActionContext = {
          data: context,
          componentData: state.componentStates,
          schema: state.schema,
        };

        // 使用 ActionHandler 执行动作
        const result = await ActionHandler.execute(action, actionContext);

        if (!result.success) {
          console.error('[Workbench] 动作执行失败:', result.error);
        }

        // 如果需要刷新，触发刷新事件
        if (result.shouldRefresh) {
          const event = new CustomEvent('workbench:refresh', { detail: { action, result } });
          window.dispatchEvent(event);
        }

        return result;
      },

      // ====== 会话持久化 ======
      getSerializableState: () => {
        const { schema, activeTabKey, visible, widthRatio } = get();
        return {
          schema,
          activeTabKey,
          visible,
          widthRatio,
        };
      },

      loadState: (savedState) => {
        console.log('[WorkbenchStore] loadState() 被调用');

        const updates: Partial<WorkbenchStore> = {};

        if (savedState.schema !== undefined) {
          // 验证 schema（宽容模式：有 sanitizedSchema 且有有效 tabs 即可）
          if (savedState.schema) {
            const result = validateWorkbenchSchema(savedState.schema);
            if (result.sanitizedSchema && result.sanitizedSchema.tabs.length > 0) {
              if (result.errors.length > 0) {
                console.warn('[WorkbenchStore] 保存的 schema 有非致命警告（部分渲染）:', result.errors);
              }
              updates.schema = result.sanitizedSchema;
            } else {
              console.warn('[WorkbenchStore] 保存的 schema 无效，跳过', result.errors);
            }
          } else {
            updates.schema = null;
          }
        }

        if (savedState.activeTabKey !== undefined) {
          updates.activeTabKey = savedState.activeTabKey;
        }

        if (savedState.visible !== undefined) {
          updates.visible = savedState.visible;
        }

        if (savedState.widthRatio !== undefined) {
          updates.widthRatio = savedState.widthRatio;
        }

        // 重置历史记录（加载新会话时不需要保留旧历史）
        updates.history = updates.schema ? [cloneSchema(updates.schema)] : [];
        updates.historyIndex = updates.schema ? 0 : -1;
        updates.componentStates = {};

        set(updates as any);
      },
    }),
    {
      name: 'lsc-ai-workbench',
      // 只持久化部分状态
      partialize: (state) => ({
        widthRatio: state.widthRatio,
      }),
    }
  )
);

// ============================================================================
// 便捷 Hooks
// ============================================================================

/** 获取当前 Schema */
export function useWorkbenchSchema(): WorkbenchSchema | null {
  return useWorkbenchStore((state) => state.schema);
}

/** 获取当前标签页 */
export function useActiveTab(): WorkbenchTab | null {
  return useWorkbenchStore((state) => {
    if (!state.schema) return null;
    return state.schema.tabs.find((t) => t.key === state.activeTabKey) || null;
  });
}

/** 获取可见性 */
export function useWorkbenchVisible(): boolean {
  return useWorkbenchStore((state) => state.visible);
}

/** 获取宽度比例 */
export function useWorkbenchWidthRatio(): number {
  return useWorkbenchStore((state) => state.widthRatio);
}

// ============================================================================
// Workbench 上下文（供 AI 感知）
// ============================================================================

export interface WorkbenchContext {
  /** Workbench 是否打开 */
  isOpen: boolean;
  /** 标题 */
  title?: string;
  /** 所有标签页 */
  tabs: Array<{
    key: string;
    title: string;
    isActive: boolean;
    /** 标签页内容摘要 */
    summary: string;
  }>;
  /** 当前激活标签页的详细内容 */
  activeTabContent?: {
    /** 组件类型和描述 */
    components: Array<{
      type: string;
      description: string;
      /** 如果是文件查看器，包含文件信息 */
      filePath?: string;
      /** 文件内容摘要（前 1000 字符） */
      contentPreview?: string;
    }>;
  };
}

/**
 * 获取 Workbench 上下文（供 AI 感知当前工作台状态）
 * 这是一个非 hook 函数，可在任何地方调用
 */
export function getWorkbenchContext(): WorkbenchContext | null {
  const state = useWorkbenchStore.getState();

  console.log('[WorkbenchStore] getWorkbenchContext - visible:', state.visible, 'hasSchema:', !!state.schema);

  if (!state.visible || !state.schema) {
    return {
      isOpen: false,
      tabs: [],
    };
  }

  const { schema, activeTabKey, componentStates } = state;

  // 获取标签页摘要
  const tabs = schema.tabs.map((tab) => {
    const isActive = tab.key === activeTabKey;

    // 生成标签页内容摘要
    let summary = '';
    if (tab.components && tab.components.length > 0) {
      const componentTypes = tab.components.map((c) => {
        if (c.type === 'FileViewer') {
          return `文件查看: ${(c as any).filePath || '未知文件'}`;
        }
        if (c.type === 'FileBrowser') {
          return `文件浏览器: ${(c as any).rootPath || '根目录'}`;
        }
        if (c.type === 'CodeEditor') {
          return `代码编辑器: ${(c as any).language || '未知语言'}`;
        }
        if (c.type === 'DataTable') {
          return '数据表格';
        }
        if (c.type === 'Card') {
          return `卡片: ${(c as any).title || '无标题'}`;
        }
        if (c.type === 'MarkdownView') {
          return 'Markdown 内容';
        }
        return c.type;
      });
      summary = componentTypes.join(', ');
    } else {
      summary = '空白标签页';
    }

    return {
      key: tab.key,
      title: tab.title,
      isActive,
      summary,
    };
  });

  // 获取当前激活标签页的详细内容
  const activeTab = schema.tabs.find((t) => t.key === activeTabKey);
  let activeTabContent: WorkbenchContext['activeTabContent'] | undefined;

  if (activeTab && activeTab.components) {
    activeTabContent = {
      components: activeTab.components.map((component) => {
        const result: {
          type: string;
          description: string;
          filePath?: string;
          contentPreview?: string;
        } = {
          type: component.type,
          description: '',
        };

        // 根据组件类型生成描述
        switch (component.type) {
          case 'FileViewer': {
            const filePath = (component as any).filePath;
            result.filePath = filePath;
            result.description = `正在查看文件: ${filePath}`;

            // 尝试获取文件内容（从 componentStates）
            const componentId = (component as any).id || `file-${filePath}`;
            const componentState = componentStates[componentId];
            if (componentState?.data) {
              const content = typeof componentState.data === 'string'
                ? componentState.data
                : (componentState.data as any)?.content;
              if (content && typeof content === 'string') {
                // 限制预览长度
                result.contentPreview = content.length > 1000
                  ? content.substring(0, 1000) + '...(内容已截断)'
                  : content;
              }
            }
            break;
          }
          case 'FileBrowser': {
            const rootPath = (component as any).rootPath;
            result.description = `文件浏览器，根目录: ${rootPath || '未指定'}`;
            break;
          }
          case 'CodeEditor': {
            const language = (component as any).language || '未知';
            result.description = `代码编辑器，语言: ${language}`;
            const code = (component as any).code;
            if (code && typeof code === 'string') {
              // 增加预览长度到 5000 字符，让 AI 能看到更多内容
              result.contentPreview = code.length > 5000
                ? code.substring(0, 5000) + '...(内容已截断，完整内容共 ' + code.length + ' 字符)'
                : code;
            }
            break;
          }
          case 'DataTable': {
            const title = (component as any).title;
            result.description = `数据表格${title ? `: ${title}` : ''}`;
            break;
          }
          case 'Card': {
            const title = (component as any).title;
            result.description = `卡片${title ? `: ${title}` : ''}`;
            break;
          }
          case 'MarkdownView': {
            result.description = 'Markdown 内容';
            const mdContent = (component as any).content;
            if (mdContent && typeof mdContent === 'string') {
              result.contentPreview = mdContent.length > 1000
                ? mdContent.substring(0, 1000) + '...(内容已截断)'
                : mdContent;
            }
            break;
          }
          default:
            result.description = `${component.type} 组件`;
        }

        return result;
      }),
    };
  }

  return {
    isOpen: true,
    title: schema.title,
    tabs,
    activeTabContent,
  };
}

/**
 * 将 Workbench 上下文格式化为文本（供发送给 AI）
 */
export function formatWorkbenchContextForAI(): string {
  const context = getWorkbenchContext();

  if (!context || !context.isOpen) {
    return '';
  }

  const lines: string[] = [
    '【当前 Workbench 状态】',
    `标题: ${context.title || '工作台'}`,
    `标签页数量: ${context.tabs.length}`,
    '',
    '标签页列表:',
  ];

  context.tabs.forEach((tab, index) => {
    const activeMarker = tab.isActive ? ' ← 当前激活' : '';
    lines.push(`  ${index + 1}. ${tab.title}${activeMarker}`);
    lines.push(`     内容: ${tab.summary}`);
  });

  if (context.activeTabContent) {
    lines.push('');
    lines.push('当前标签页详情:');
    context.activeTabContent.components.forEach((comp, index) => {
      lines.push(`  组件 ${index + 1}: ${comp.description}`);
      if (comp.filePath) {
        lines.push(`    文件路径: ${comp.filePath}`);
      }
      if (comp.contentPreview) {
        lines.push('    内容预览:');
        lines.push('    ```');
        // 缩进内容预览，增加到 100 行
        const previewLines = comp.contentPreview.split('\n');
        previewLines.slice(0, 100).forEach((line) => {
          lines.push(`    ${line}`);
        });
        if (previewLines.length > 100) {
          lines.push(`    ...(更多内容已省略，共 ${previewLines.length} 行)`);
        }
        lines.push('    ```');
      }
    });
  }

  return lines.join('\n');
}
