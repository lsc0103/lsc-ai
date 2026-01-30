import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import clsx from 'clsx';

// 语言显示名称映射
const languageNames: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  bash: 'Bash',
  shell: 'Shell',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  plaintext: 'Text',
  text: 'Text',
};

interface CodeBlockProps {
  language: string;
  code: string;
}

/**
 * 代码块组件
 * 支持语法高亮、语言标签、复制按钮
 */
export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // 复制代码
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const displayLanguage = languageNames[language?.toLowerCase()] || language || 'Code';

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-cream-200 bg-[#fafafa]">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-cream-100 border-b border-cream-200">
        {/* 语言标签 */}
        <span className="text-xs font-medium text-accent-500">{displayLanguage}</span>

        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors',
            copied
              ? 'text-green-600 bg-green-50'
              : 'text-accent-500 hover:text-accent-700 hover:bg-cream-200',
          )}
        >
          {copied ? (
            <>
              <CheckOutlined className="text-xs" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <CopyOutlined className="text-xs" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>

      {/* 代码内容 */}
      <SyntaxHighlighter
        style={oneLight}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '12px 16px',
          fontSize: '13px',
          lineHeight: '1.5',
          background: '#fafafa',
          borderRadius: 0,
        }}
        codeTagProps={{
          style: {
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
