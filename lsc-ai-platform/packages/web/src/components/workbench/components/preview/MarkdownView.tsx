/**
 * Workbench MarkdownView Markdown 渲染组件
 *
 * 支持 GFM（GitHub Flavored Markdown）
 * - 表格、任务列表、删除线
 * - 代码块语法高亮
 * - 自动链接
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import clsx from 'clsx';
import type { MarkdownViewSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

// ============================================================================
// 样式
// ============================================================================

const markdownStyles = `
.markdown-body {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.7;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  color: var(--text-primary);
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 16px;
  line-height: 1.4;
}

.markdown-body h1 { font-size: 1.75em; border-bottom: 1px solid var(--border-light); padding-bottom: 8px; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-light); padding-bottom: 6px; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1.1em; }
.markdown-body h5 { font-size: 1em; }
.markdown-body h6 { font-size: 0.9em; color: var(--text-secondary); }

.markdown-body p {
  margin-bottom: 16px;
}

.markdown-body a {
  color: var(--accent-primary);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

.markdown-body li {
  margin-bottom: 4px;
}

.markdown-body li > p {
  margin-bottom: 8px;
}

.markdown-body blockquote {
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid var(--accent-primary);
  background: var(--glass-bg-light);
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary);
}

.markdown-body blockquote p:last-child {
  margin-bottom: 0;
}

.markdown-body code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.9em;
  padding: 2px 6px;
  background: var(--glass-bg-medium);
  border-radius: 4px;
  color: var(--text-primary);
}

.markdown-body pre {
  margin: 16px 0;
  padding: 16px;
  background: var(--glass-bg-medium);
  border-radius: 8px;
  border: 1px solid var(--border-light);
  overflow-x: auto;
}

.markdown-body pre code {
  padding: 0;
  background: transparent;
  font-size: 13px;
  line-height: 1.5;
}

.markdown-body table {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
  font-size: 13px;
}

.markdown-body th,
.markdown-body td {
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  text-align: left;
}

.markdown-body th {
  background: var(--glass-bg-subtle);
  font-weight: 600;
  color: var(--text-primary);
}

.markdown-body tr:nth-child(even) {
  background: var(--glass-bg-light);
}

.markdown-body hr {
  margin: 24px 0;
  border: none;
  border-top: 1px solid var(--border-light);
}

.markdown-body img {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
}

.markdown-body input[type="checkbox"] {
  margin-right: 8px;
  accent-color: var(--accent-primary);
}

.markdown-body del {
  color: var(--text-tertiary);
}

/* 代码高亮主题适配 */
.markdown-body .hljs {
  background: transparent;
  color: var(--text-primary);
}

.markdown-body .hljs-comment,
.markdown-body .hljs-quote {
  color: #6A737D;
  font-style: italic;
}

.markdown-body .hljs-keyword,
.markdown-body .hljs-selector-tag {
  color: #FF7B72;
}

.markdown-body .hljs-string,
.markdown-body .hljs-addition {
  color: #A5D6FF;
}

.markdown-body .hljs-number {
  color: #79C0FF;
}

.markdown-body .hljs-built_in,
.markdown-body .hljs-type {
  color: #FFA657;
}

.markdown-body .hljs-function,
.markdown-body .hljs-title {
  color: #D2A8FF;
}

.markdown-body .hljs-variable,
.markdown-body .hljs-attr {
  color: #FFA657;
}

.markdown-body .hljs-deletion {
  color: #FF7B72;
  background: rgba(255, 123, 114, 0.1);
}
`;

// ============================================================================
// 主组件
// ============================================================================

export const MarkdownView: React.FC<WorkbenchComponentProps<MarkdownViewSchema>> = ({
  schema,
}) => {
  const { content, style, className } = schema;

  // 注入样式（只需要一次）
  useMemo(() => {
    if (typeof document !== 'undefined') {
      const styleId = 'workbench-markdown-styles';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = markdownStyles;
        document.head.appendChild(styleEl);
      }
    }
  }, []);

  return (
    <div
      className={clsx(
        'workbench-markdown-view',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-light)]',
        className
      )}
      style={style}
    >
      {/* 内容区域 */}
      <div className="p-6 overflow-auto">
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

MarkdownView.displayName = 'WorkbenchMarkdownView';
