import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { useChatStore } from '../stores/chat';
import ChatInput from '../components/chat/ChatInput';
import MessageList from '../components/chat/MessageList';
import WelcomeScreen from '../components/chat/WelcomeScreen';
import { WorkbenchLayout } from '../components/workbench';

/**
 * 聊天页面
 * 核心交互界面，集成 Workbench 分屏布局
 */
export default function ChatPage() {
  const { sessionId } = useParams();
  const {
    messages,
    currentSessionId,
    isNewChat,
    isLoading,
    isLoadingSession,
    streamingContent,
    streamingToolSteps,
    loadSession,
    startNewChat,
  } = useChatStore();

  // 监听 sessionId 变化，加载会话消息
  useEffect(() => {
    // P0-6 修复：新对话模式下不加载任何会话
    // 防止 navigate('/chat') 尚未生效时，旧 URL 中的 sessionId 触发 loadSession
    if (isNewChat) return;

    // 如果 URL 中有 sessionId，优先加载该会话
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
      return;
    }

    // 如果 URL 中没有 sessionId 但 store 中仍有 currentSessionId（未被清空），
    // 说明用户可能通过浏览器后退或直接输入 URL 到达 /chat
    // 注意：必须排除"正在发送消息、即将导航"的中间状态
    // （此时 currentSessionId 已设置但 URL 还未更新，messages 或 isLoading 不为空）
    if (!sessionId && currentSessionId && !isNewChat && !isLoading && messages.length === 0) {
      startNewChat();
    }
  }, [sessionId, currentSessionId, isNewChat, isLoading, messages.length, loadSession, startNewChat]);

  // 判断是否应该显示消息列表
  // 条件：有消息、有流式内容、有工具调用、或正在加载中（已发送消息等待响应）
  // 必须在有效的会话上下文中（有sessionId或currentSessionId）
  const hasActiveChat =
    messages.length > 0 ||
    streamingContent.length > 0 ||
    streamingToolSteps.length > 0 ||
    (isLoading && currentSessionId);

  const inSession = !!(sessionId || currentSessionId);
  const showMessages = hasActiveChat && inSession;

  return (
    <WorkbenchLayout className="h-full">
      {/* 聊天区域 */}
      <div className="relative flex flex-col h-full">
        {/* 消息区域 */}
        <div className="flex-1 overflow-hidden relative">
          {isLoadingSession ? (
            <div className="flex items-center justify-center h-full">
              <Spin size="large" tip="加载会话中..." />
            </div>
          ) : showMessages ? (
            <MessageList />
          ) : (
            <WelcomeScreen />
          )}
        </div>

        {/* 输入区域 - 固定在底部 */}
        <div className="relative z-10">
          <ChatInput />
        </div>
      </div>
    </WorkbenchLayout>
  );
}
