import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useChatStore } from '../../stores/chat';

/**
 * 欢迎界面
 * 新对话时显示的欢迎页面
 */
export default function WelcomeScreen() {
  const { setPendingMessage } = useChatStore();

  // 点击建议时设置待发送消息
  const handleSuggestionClick = (suggestion: string) => {
    setPendingMessage(suggestion);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
      <motion.div
        className="text-center max-w-lg pointer-events-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--accent-primary)] mb-6 shadow-[0_4px_16px_rgba(0,113,227,0.4)]"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <span className="text-white font-bold text-3xl">AI</span>
        </motion.div>

        {/* 欢迎文字 */}
        <motion.h1
          className="text-2xl font-semibold text-[var(--text-primary)] mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          有什么可以帮你的?
        </motion.h1>

        <motion.p
          className="text-[var(--text-secondary)] mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          我是 LSC-AI，你的智能工作助手。我可以帮你处理文档、分析数据、编写代码，以及更多任务。
        </motion.p>

        {/* 建议卡片 */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {[
            '帮我分析这份数据报表',
            '生成一份工作周报',
            '查询系统运行状态',
            '编写一个自动化脚本',
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className={clsx(
                'p-4 text-left text-sm rounded-xl',
                'text-[var(--text-secondary)]',
                'bg-[var(--glass-bg-light)]',
                'border border-[var(--border-light)]',
                'hover:border-[var(--accent-primary)] hover:bg-[var(--glass-bg-medium)]',
                'hover:text-[var(--text-primary)]',
                'transition-all duration-200',
              )}
            >
              {suggestion}
            </button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
