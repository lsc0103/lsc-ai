import { Avatar, Image } from 'antd';
import { FileOutlined, FileImageOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { useAuthStore } from '../../stores/auth';
import CodeBlock from './CodeBlock';
import ToolSteps from './ToolSteps';
import WorkbenchSchemaBlock from './WorkbenchSchemaBlock';
import type { Message } from '../../stores/chat';

// 文件类型图标映射
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <FileImageOutlined className="text-[var(--accent-info)]" />;
  }
  if (mimeType === 'application/pdf') {
    return <FilePdfOutlined className="text-[var(--accent-error)]" />;
  }
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return <FileTextOutlined className="text-[var(--accent-success)]" />;
  }
  return <FileOutlined className="text-[var(--text-tertiary)]" />;
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface MessageBubbleProps {
  message: Message;
}

/**
 * 消息气泡组件
 *
 * 玻璃拟态设计：
 * - 用户消息：强调色填充
 * - AI 消息：玻璃效果 + 边缘高光
 * - 支持 Markdown 渲染和代码高亮
 */
export default function MessageBubble({ message }: MessageBubbleProps) {
  const user = useAuthStore((state) => state.user);
  const isUser = message.role === 'user';

  return (
    <div
      className={clsx(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* 头像 */}
      <Avatar
        size={36}
        className={clsx(
          'flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
          isUser
            ? 'bg-[var(--accent-primary)]'
            : 'bg-[var(--glass-bg-medium)] backdrop-blur-sm',
        )}
      >
        {isUser
          ? (user?.displayName?.[0] || user?.username?.[0] || 'U')
          : 'AI'
        }
      </Avatar>

      {/* 消息内容 */}
      <div
        className={clsx(
          'message-bubble',
          isUser ? 'user' : 'assistant',
          message.isStreaming && 'animate-pulse',
        )}
      >
        {isUser ? (
          <div className="relative z-10">
            {/* 用户消息文本 */}
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {/* 附件显示 */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* 图片附件 - 显示缩略图 */}
                {message.attachments.filter(f => f.mimeType.startsWith('image/')).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Image.PreviewGroup>
                      {message.attachments
                        .filter(f => f.mimeType.startsWith('image/'))
                        .map(file => (
                          <Image
                            key={file.id}
                            src={file.url}
                            alt={file.originalName}
                            width={120}
                            height={120}
                            className="rounded-lg object-cover cursor-pointer"
                            style={{ objectFit: 'cover' }}
                            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwYACBUCoQk3mJYAAAAASUVORK5CYII="
                          />
                        ))}
                    </Image.PreviewGroup>
                  </div>
                )}

                {/* 非图片附件 - 显示文件卡片 */}
                {message.attachments
                  .filter(f => !f.mimeType.startsWith('image/'))
                  .map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 text-white/90"
                    >
                      {getFileIcon(file.mimeType)}
                      <span className="text-sm truncate max-w-[150px]">{file.originalName}</span>
                      <span className="text-xs opacity-70">({formatFileSize(file.size)})</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-[var(--text-primary)] relative z-10">
            {/* 工具步骤展示 */}
            {message.toolSteps && message.toolSteps.length > 0 && (
              <ToolSteps steps={message.toolSteps} />
            )}

            {/* 流式输出时用纯文本，完成后用 Markdown 渲染 */}
            {/* 流式过程中隐藏 workbench schema JSON，避免用户看到原始 JSON 闪现 */}
            {message.isStreaming ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--text-primary)] mb-0">
                {message.content?.replace(/```(?:workbench-schema|workbench|json)\s*\n\s*\{[\s\S]*?(?:```|$)/g, '').trim()}
              </pre>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const code = String(children).replace(/\n$/, '');
                  const language = match?.[1] || 'text';

                  // 判断是否为多行代码块
                  const isMultiline = code.includes('\n') || match;

                  // 检测 workbench-schema 代码块
                  if (language === 'workbench-schema' || language === 'workbench') {
                    return <WorkbenchSchemaBlock code={code} />;
                  }

                  return isMultiline ? (
                    <CodeBlock
                      language={language}
                      code={code}
                    />
                  ) : (
                    <code
                      className="px-1.5 py-0.5 rounded bg-[var(--glass-bg-medium)] text-[var(--accent-primary)] text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed text-[var(--text-primary)]">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 mb-2 text-[var(--text-primary)]">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 mb-2 text-[var(--text-primary)]">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="mb-1 text-[var(--text-primary)]">{children}</li>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] underline"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[var(--accent-primary)] pl-4 italic text-[var(--text-secondary)]">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full border-collapse border border-[var(--border-light)]">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-[var(--border-light)] px-3 py-2 bg-[var(--glass-bg-light)] text-left font-medium text-[var(--text-primary)]">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-[var(--border-light)] px-3 py-2 text-[var(--text-primary)]">
                    {children}
                  </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}

            {/* 流式输出光标 */}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 bg-[var(--accent-primary)] animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
