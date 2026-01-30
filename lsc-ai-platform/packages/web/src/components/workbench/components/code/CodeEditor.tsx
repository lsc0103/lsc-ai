/**
 * Workbench CodeEditor 代码编辑器组件
 *
 * 基于 Monaco Editor 实现
 * - 语法高亮
 * - 代码补全
 * - 多语言支持
 * - 主题适配
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import clsx from 'clsx';

// Monaco editor type
type IStandaloneCodeEditor = Parameters<OnMount>[0];
import { LoadingOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { CodeEditorSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { useWorkbenchStore } from '../../context';

// ============================================================================
// 语言映射（常见别名）
// ============================================================================

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  md: 'markdown',
  rs: 'rust',
  go: 'go',
  kt: 'kotlin',
  swift: 'swift',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
};

function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  return languageAliases[lower] || lower;
}

// ============================================================================
// 主组件
// ============================================================================

export const CodeEditor: React.FC<WorkbenchComponentProps<CodeEditorSchema>> = ({
  schema,
}) => {
  const {
    code,
    language,
    readOnly = false,
    lineNumbers = true,
    height = 400,
    highlightLines,
    filePath,
    onChangeAction,
    style,
    className,
  } = schema;

  const { handleAction, updateComponentData } = useWorkbenchStore();
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [dynamicHeight, setDynamicHeight] = useState<number>(400);

  // 当 height 为 'auto' 时，使用 ResizeObserver 动态计算高度
  const isAutoHeight = height === 'auto' || height === '100%';

  useEffect(() => {
    if (!isAutoHeight) return;

    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const parent = container.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        // 减去工具栏高度 (36px) 和一些边距
        const availableHeight = rect.height - 36 - 8;
        if (availableHeight > 100) {
          setDynamicHeight(availableHeight);
        }
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (container.parentElement) {
      resizeObserver.observe(container.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [isAutoHeight]);

  // 编辑器挂载
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // 自定义深色主题（与玻璃拟态风格匹配）
    monaco.editor.defineTheme('lsc-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'FF7B72' },
        { token: 'string', foreground: 'A5D6FF' },
        { token: 'number', foreground: '79C0FF' },
        { token: 'type', foreground: 'FFA657' },
        { token: 'function', foreground: 'D2A8FF' },
        { token: 'variable', foreground: 'FFA657' },
      ],
      colors: {
        'editor.background': '#0d1b2a00', // 透明背景
        'editor.foreground': '#E6EDF3',
        'editor.lineHighlightBackground': '#1e3a5f40',
        'editor.selectionBackground': '#264F7840',
        'editorLineNumber.foreground': '#6E7681',
        'editorLineNumber.activeForeground': '#E6EDF3',
        'editorCursor.foreground': '#58A6FF',
        'editor.inactiveSelectionBackground': '#1e3a5f30',
      },
    });

    monaco.editor.setTheme('lsc-dark');

    // 高亮指定行
    if (highlightLines && highlightLines.length > 0) {
      const decorations = highlightLines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'highlighted-line',
          linesDecorationsClassName: 'highlighted-line-margin',
        },
      }));
      editor.createDecorationsCollection(decorations);
    }

    // 自适应高度（可选）
    editor.layout();
  }, [highlightLines]);

  // 内容变化
  const handleChange: OnChange = useCallback((value) => {
    if (schema.id) {
      updateComponentData(schema.id, value);
    }
    if (onChangeAction) {
      handleAction(onChangeAction, { code: value });
    }
  }, [schema.id, onChangeAction, handleAction, updateComponentData]);

  // 复制代码
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败');
    }
  }, [code]);

  // 计算高度：如果是 auto 则使用动态计算的高度
  const editorHeight = isAutoHeight
    ? `${dynamicHeight}px`
    : typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'workbench-code-editor',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-medium)]',
        isAutoHeight && 'h-full flex flex-col',
        className
      )}
      style={style}
    >
      {/* 顶部工具栏 */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'h-9 px-3',
          'border-b border-[var(--border-light)]',
          'bg-[var(--glass-bg-subtle)]'
        )}
      >
        {/* 左侧：文件路径/语言 */}
        <div className="flex items-center gap-2">
          {filePath ? (
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              {filePath}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-tertiary)]">
              {normalizeLanguage(language)}
            </span>
          )}
        </div>

        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded',
              'text-xs text-[var(--text-secondary)]',
              'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
              'transition-colors duration-150'
            )}
          >
            {copied ? (
              <>
                <CheckOutlined style={{ fontSize: 12 }} />
                <span>已复制</span>
              </>
            ) : (
              <>
                <CopyOutlined style={{ fontSize: 12 }} />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 编辑器 */}
      <div className={isAutoHeight ? 'flex-1 min-h-0' : ''} style={{ height: isAutoHeight ? undefined : editorHeight }}>
        <Editor
          height={isAutoHeight ? '100%' : editorHeight}
          defaultValue={code}
          language={normalizeLanguage(language)}
          theme="lsc-dark"
          onMount={handleEditorMount}
          onChange={handleChange}
          loading={
            <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
              <LoadingOutlined className="mr-2" />
              <span>加载编辑器...</span>
            </div>
          }
          options={{
            readOnly,
            lineNumbers: lineNumbers ? 'on' : 'off',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            tabSize: 2,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            lineHeight: 20,
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            contextmenu: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
          }}
        />
      </div>
    </div>
  );
};

CodeEditor.displayName = 'WorkbenchCodeEditor';
