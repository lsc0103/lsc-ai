import { create } from 'zustand';
import { sessionApi } from '../services/api';

interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

/**
 * 工具调用步骤
 */
interface ToolStep {
  id: string;
  name: string;
  arguments?: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: any[];
  toolSteps?: ToolStep[];
  attachments?: FileAttachment[];
  createdAt: string;
  isStreaming?: boolean;
}

export type { Message, FileAttachment, ToolStep };

interface Session {
  id: string;
  title: string;
  projectId?: string;
  updatedAt: string;
}

interface ChatState {
  // 会话列表
  sessions: Session[];
  currentSessionId: string | null;

  // 新对话模式 - 点击新对话后进入此模式，发送第一条消息后才创建session
  isNewChat: boolean;

  // 待发送消息 - 用于WelcomeScreen建议点击后设置
  pendingMessage: string | null;

  // 消息
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;

  // 会话加载状态
  isLoadingSession: boolean;
  sessionLoadError: string | null;

  // 流式工具步骤（正在执行中的工具调用）
  streamingToolSteps: ToolStep[];

  // 操作
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  updateSessionTitle: (id: string, title: string) => void;

  // 新对话模式
  startNewChat: () => void;

  // 待发送消息
  setPendingMessage: (message: string | null) => void;

  // 加载会话（含历史消息）
  loadSession: (id: string) => Promise<void>;

  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, content: string) => void;

  setLoading: (loading: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  clearStreamingContent: () => void;

  // 工具步骤操作
  addToolStep: (step: ToolStep) => void;
  updateToolStep: (id: string, updates: Partial<ToolStep>) => void;
  removeToolStep: (id: string) => void;
  clearToolSteps: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isNewChat: false,
  pendingMessage: null,
  messages: [],
  isLoading: false,
  streamingContent: '',
  isLoadingSession: false,
  sessionLoadError: null,
  streamingToolSteps: [],

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      isNewChat: false, // 添加session后退出新对话模式
    })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
    })),

  setCurrentSession: (id) => set({ currentSessionId: id, isNewChat: false }),

  updateSessionTitle: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title } : s,
      ),
    })),

  // 开始新对话 - 清空当前状态，进入新对话模式
  startNewChat: () =>
    set({
      currentSessionId: null,
      isNewChat: true,
      messages: [],
      streamingContent: '',
      streamingToolSteps: [],
      pendingMessage: null,
    }),

  // 设置待发送消息
  setPendingMessage: (message) => set({ pendingMessage: message }),

  // 加载会话（含历史消息）
  loadSession: async (id: string) => {
    // 如果已经是当前会话且有消息，不重复加载
    const state = get();
    if (state.currentSessionId === id && state.messages.length > 0) {
      return;
    }

    set({
      isLoadingSession: true,
      sessionLoadError: null,
      currentSessionId: id,
      isNewChat: false,
    });

    try {
      const response = await sessionApi.get(id);
      const session = response.data;

      // 转换消息格式
      const messages: Message[] = (session.messages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolSteps: msg.toolSteps,
        attachments: msg.attachments,
        createdAt: msg.createdAt,
        isStreaming: false,
      }));

      set({
        messages,
        isLoadingSession: false,
        streamingContent: '',
        streamingToolSteps: [],
      });

      console.log('[ChatStore] 会话加载完成:', {
        sessionId: id,
        messageCount: messages.length,
      });
    } catch (error: any) {
      console.error('[ChatStore] 加载会话失败:', error);
      set({
        isLoadingSession: false,
        sessionLoadError: error.message || '加载会话失败',
        messages: [],
      });
    }
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content, isStreaming: false } : m,
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setStreamingContent: (streamingContent) => set({ streamingContent }),

  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  // 添加工具步骤
  addToolStep: (step) =>
    set((state) => ({
      streamingToolSteps: [...state.streamingToolSteps, step],
    })),

  // 更新工具步骤
  updateToolStep: (id, updates) =>
    set((state) => ({
      streamingToolSteps: state.streamingToolSteps.map((step) =>
        step.id === id ? { ...step, ...updates } : step,
      ),
    })),

  // 移除工具步骤
  removeToolStep: (id) =>
    set((state) => ({
      streamingToolSteps: state.streamingToolSteps.filter((step) => step.id !== id),
    })),

  // 清空工具步骤
  clearToolSteps: () => set({ streamingToolSteps: [] }),
}));
