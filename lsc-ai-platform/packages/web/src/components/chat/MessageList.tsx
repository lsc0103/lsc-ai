import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '../../stores/chat';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

/**
 * 消息列表组件
 * 展示对话历史
 */
export default function MessageList() {
  const { messages, isLoading, streamingContent, streamingToolSteps } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingToolSteps]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto px-4 py-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
          >
            <MessageBubble message={message} />
          </motion.div>
        ))}

        {/* 流式输出中的消息（包含工具步骤） */}
        {(streamingContent || streamingToolSteps.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MessageBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingContent,
                toolSteps: streamingToolSteps.length > 0 ? streamingToolSteps : undefined,
                createdAt: new Date().toISOString(),
                isStreaming: true,
              }}
            />
          </motion.div>
        )}

        {/* 加载指示器 */}
        {isLoading && !streamingContent && streamingToolSteps.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TypingIndicator />
          </motion.div>
        )}

        {/* 工具执行完但还没有文字输出时的提示 */}
        {isLoading && !streamingContent && streamingToolSteps.length > 0 &&
         streamingToolSteps.every(s => s.status !== 'running') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4"
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-medium">AI</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-accent-500">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>正在整理信息并生成回复...</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
