import { Avatar } from 'antd';

/**
 * 打字指示器
 * AI 思考时显示
 */
export default function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <Avatar size={36} className="bg-accent-600 flex-shrink-0">
        AI
      </Avatar>
      <div className="bg-white border border-cream-200 rounded-2xl px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          <span
            className="w-2 h-2 bg-accent-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-accent-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-accent-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
