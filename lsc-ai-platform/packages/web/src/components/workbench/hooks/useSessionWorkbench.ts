/**
 * 会话与 Workbench 状态关联 Hook (重构版)
 *
 * 核心职责：
 * 1. 会话切换时保存上一个会话的 Workbench 状态
 * 2. 加载新会话的 Workbench 状态
 * 3. 防抖自动保存当前会话的状态变化
 *
 * 设计原则：
 * - 单一职责：每个函数只做一件事
 * - 简化流程：减少复杂的状态跟踪
 * - 可靠验证：只保存有效数据
 */

import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '../../../stores/chat';
import { useWorkbenchStore } from '../context/WorkbenchStore';
import { sessionApi } from '../../../services/api';
import type { WorkbenchSchema } from '../schema/types';
import { ensureNewSchema } from '../schema/schema-transformer';

/** 保存的 Workbench 状态 */
interface SavedWorkbenchState {
  schema: WorkbenchSchema | null;
  activeTabKey: string;
  visible: boolean;
  widthRatio?: number;
}

/** 防抖延迟（毫秒） */
const DEBOUNCE_DELAY = 2000;

/**
 * 验证 Schema 是否有效（有实际内容）
 */
function isValidSchema(schema: WorkbenchSchema | null): boolean {
  if (!schema) return false;
  if (!schema.tabs || schema.tabs.length === 0) return false;

  // 至少有一个 tab 有 components
  const hasContent = schema.tabs.some(
    (tab: any) => tab.components && tab.components.length > 0
  );

  return hasContent;
}

/**
 * 会话与 Workbench 状态关联 Hook
 * 在 App 或 Layout 组件中调用一次即可
 */
export function useSessionWorkbench() {
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const isNewChat = useChatStore((state) => state.isNewChat);

  console.log('[SessionWorkbench] Hook 被调用，当前状态:', { currentSessionId, isNewChat });

  const schema = useWorkbenchStore((state) => state.schema);
  const activeTabKey = useWorkbenchStore((state) => state.activeTabKey);
  const visible = useWorkbenchStore((state) => state.visible);
  const widthRatio = useWorkbenchStore((state) => state.widthRatio);

  const clear = useWorkbenchStore((state) => state.clear);
  const loadState = useWorkbenchStore((state) => state.loadState);

  // 记录上一个会话 ID
  const prevSessionIdRef = useRef<string | null>(null);
  // 记录上一个 isNewChat 状态
  const prevIsNewChatRef = useRef<boolean>(false);
  // 防抖定时器
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 是否正在加载
  const isLoadingRef = useRef(false);
  // 标记组件是否已挂载
  const isMountedRef = useRef(false);

  /**
   * 保存 Workbench 状态到服务器
   */
  const saveWorkbenchState = useCallback(async (sessionId: string) => {
    // 参数验证
    if (!sessionId) {
      console.log('[SessionWorkbench] saveWorkbenchState: sessionId为空');
      return;
    }

    // 正在加载时不保存（避免保存中间状态）
    if (isLoadingRef.current) {
      console.log('[SessionWorkbench] saveWorkbenchState: 正在加载，跳过保存');
      return;
    }

    try {
      // 获取当前状态
      const currentState = useWorkbenchStore.getState();
      const state: SavedWorkbenchState = {
        schema: currentState.schema,
        activeTabKey: currentState.activeTabKey,
        visible: currentState.visible,
        widthRatio: currentState.widthRatio,
      };

      // 验证 schema 是否有效
      if (!isValidSchema(state.schema)) {
        console.log('[SessionWorkbench] saveWorkbenchState: Schema无效或为空，跳过保存');
        return;
      }

      console.log('[SessionWorkbench] saveWorkbenchState: 准备保存', {
        sessionId,
        tabCount: state.schema!.tabs.length,
        tabs: state.schema!.tabs.map((tab: any) => ({
          key: tab.key,
          title: tab.title,
          componentCount: tab.components?.length || 0,
        })),
      });

      // 调用 API 保存
      await sessionApi.saveWorkbenchState(sessionId, state);
      console.log('[SessionWorkbench] saveWorkbenchState: 保存成功');
    } catch (error) {
      console.error('[SessionWorkbench] saveWorkbenchState: 保存失败', error);
    }
  }, []);

  /**
   * 从服务器加载 Workbench 状态
   */
  const loadWorkbenchState = useCallback(async (sessionId: string) => {
    // 参数验证
    if (!sessionId) {
      console.log('[SessionWorkbench] loadWorkbenchState: sessionId为空');
      return;
    }

    // 防护：如果当前是新对话模式，不加载 workbench
    const currentState = useChatStore.getState();
    if (currentState.isNewChat) {
      console.log('[SessionWorkbench] loadWorkbenchState: 当前是新对话模式，跳过加载');
      return;
    }

    console.log('[SessionWorkbench] loadWorkbenchState: 开始加载', sessionId);

    // 设置加载标志
    isLoadingRef.current = true;

    try {
      // 调用 API 获取状态
      const response = await sessionApi.getWorkbenchState(sessionId);
      const savedState = response.data as SavedWorkbenchState | null;

      console.log('[SessionWorkbench] loadWorkbenchState: API响应', savedState);

      if (savedState && savedState.schema) {
        // 转换 schema（旧格式 -> 新格式）
        const transformedSchema = ensureNewSchema(savedState.schema);

        console.log('[SessionWorkbench] loadWorkbenchState: 转换后的Schema', {
          tabCount: transformedSchema.tabs.length,
          tabs: transformedSchema.tabs.map((tab: any) => ({
            key: tab.key,
            title: tab.title,
            componentCount: tab.components?.length || 0,
          })),
        });

        // 验证转换后的 schema
        if (isValidSchema(transformedSchema)) {
          // 加载状态到 store
          loadState({
            schema: transformedSchema,
            activeTabKey: transformedSchema.defaultActiveKey || transformedSchema.tabs[0]?.key || '',
            visible: savedState.visible !== false, // 默认显示
            widthRatio: savedState.widthRatio,
          });
          console.log('[SessionWorkbench] loadWorkbenchState: 状态已加载到store');
        } else {
          console.warn('[SessionWorkbench] loadWorkbenchState: 转换后的Schema无效，清空workbench');
          clear();
        }
      } else {
        console.log('[SessionWorkbench] loadWorkbenchState: 没有保存的状态，清空workbench');
        clear();
      }
    } catch (error) {
      console.error('[SessionWorkbench] loadWorkbenchState: 加载失败', error);
      clear();
    } finally {
      // 延迟重置加载标志，避免立即触发保存
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 500);
    }
  }, [clear, loadState]);

  /**
   * useEffect 1: 会话切换处理
   */
  useEffect(() => {
    const prevSessionId = prevSessionIdRef.current;
    const prevIsNewChat = prevIsNewChatRef.current;
    const sessionIdChanged = currentSessionId !== prevSessionId;
    const isNewChatChanged = isNewChat !== prevIsNewChat;

    console.log('[SessionWorkbench] 会话状态:', {
      currentSessionId,
      prevSessionId,
      isNewChat,
      prevIsNewChat,
      sessionIdChanged,
      isNewChatChanged,
    });

    // 清除待执行的保存定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 处理新对话模式（优先级最高）
    // 只要 isNewChat=true，就确保 workbench 是清空状态
    if (isNewChat) {
      console.log('[SessionWorkbench] 新对话模式，清空并关闭workbench');

      // 如果之前有会话且会话ID发生变化，先保存
      if (prevSessionId && sessionIdChanged && isMountedRef.current) {
        console.log('[SessionWorkbench] 保存上一个会话:', prevSessionId);
        saveWorkbenchState(prevSessionId);
      }

      // 更新 ref
      prevSessionIdRef.current = currentSessionId;
      prevIsNewChatRef.current = isNewChat;

      // 清空并关闭 workbench
      clear();
      return;
    }

    // 更新 isNewChat ref
    prevIsNewChatRef.current = isNewChat;

    // 会话 ID 未变化，跳过
    if (!sessionIdChanged) {
      return;
    }

    // 保存上一个会话的状态（如果有且已挂载）
    if (prevSessionId && isMountedRef.current) {
      console.log('[SessionWorkbench] 保存上一个会话:', prevSessionId);
      saveWorkbenchState(prevSessionId);
    }

    // 更新 ref
    prevSessionIdRef.current = currentSessionId;

    // 加载新会话的状态
    if (currentSessionId) {
      console.log('[SessionWorkbench] 加载新会话:', currentSessionId);
      loadWorkbenchState(currentSessionId);
    } else {
      // 没有选中会话，清空并关闭
      console.log('[SessionWorkbench] 无会话，清空并关闭workbench');
      clear();
    }
  }, [currentSessionId, isNewChat, saveWorkbenchState, loadWorkbenchState, clear]);

  /**
   * useEffect 2: 确保新对话模式下 workbench 始终清空
   * 这个 useEffect 独立于会话切换，专门处理新对话模式的清空逻辑
   */
  useEffect(() => {
    // 只在新对话模式下执行
    if (!isNewChat) return;

    // 检查 workbench 是否需要清空
    const needsClear = visible || schema !== null;

    if (needsClear) {
      console.log('[SessionWorkbench] 检测到新对话模式但workbench未清空，立即清空', {
        visible,
        hasSchema: schema !== null,
      });
      clear();
    }
  }, [isNewChat, visible, schema, clear]);

  /**
   * useEffect 3: Workbench 内容变化时防抖保存
   */
  useEffect(() => {
    // 条件：必须有会话、已挂载、不在加载中
    if (!currentSessionId || !isMountedRef.current || isLoadingRef.current) {
      return;
    }

    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 设置新的防抖定时器
    saveTimerRef.current = setTimeout(() => {
      console.log('[SessionWorkbench] 防抖保存触发');
      saveWorkbenchState(currentSessionId);
    }, DEBOUNCE_DELAY);

    // 清理函数
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [schema, activeTabKey, visible, widthRatio, currentSessionId, saveWorkbenchState]);

  /**
   * useEffect 4: 组件挂载和卸载
   */
  useEffect(() => {
    // 挂载时标记
    isMountedRef.current = true;
    console.log('[SessionWorkbench] Hook已挂载');

    // 卸载时保存当前状态
    return () => {
      console.log('[SessionWorkbench] Hook卸载，保存当前状态');
      isMountedRef.current = false;

      // 清理定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // 保存当前状态
      const sessionId = useChatStore.getState().currentSessionId;
      if (sessionId) {
        // 直接调用保存函数（不使用 callback）
        const currentState = useWorkbenchStore.getState();
        const state: SavedWorkbenchState = {
          schema: currentState.schema,
          activeTabKey: currentState.activeTabKey,
          visible: currentState.visible,
          widthRatio: currentState.widthRatio,
        };

        if (isValidSchema(state.schema)) {
          sessionApi.saveWorkbenchState(sessionId, state).catch((error) => {
            console.error('[SessionWorkbench] 卸载时保存失败', error);
          });
        }
      }
    };
  }, []);
}
