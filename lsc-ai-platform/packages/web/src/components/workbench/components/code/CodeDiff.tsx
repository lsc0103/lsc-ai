/**
 * Workbench CodeDiff 代码对比组件
 *
 * 基于 Monaco Editor 的 Diff 功能
 * - 并排对比视图
 * - 内联对比视图
 * - 语法高亮
 * - 变更导航
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { DiffEditor, DiffOnMount } from '@monaco-editor/react';
import clsx from 'clsx';
import { Skeleton } from 'antd';
import {
  SwapOutlined,
  ColumnWidthOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import type { CodeDiffSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

// Monaco editor type
type IStandaloneDiffEditor = Parameters<DiffOnMount>[0];

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
// 统计变更数
// ============================================================================

interface DiffStats {
  added: number;
  removed: number;
  modified: number;
}

function computeDiffStats(original: string, modified: string): DiffStats {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // 简单统计（实际的 diff 算法会更复杂）
  const originalSet = new Set(originalLines);
  const modifiedSet = new Set(modifiedLines);

  let added = 0;
  let removed = 0;

  for (const line of modifiedLines) {
    if (!originalSet.has(line) && line.trim()) {
      added++;
    }
  }

  for (const line of originalLines) {
    if (!modifiedSet.has(line) && line.trim()) {
      removed++;
    }
  }

  return {
    added,
    removed,
    modified: Math.min(added, removed),
  };
}

// ============================================================================
// 主组件
// ============================================================================

export const CodeDiff: React.FC<WorkbenchComponentProps<CodeDiffSchema>> = ({
  schema,
}) => {
  const {
    original,
    modified,
    language,
    originalTitle = '原始版本',
    modifiedTitle = '修改版本',
    height = 400,
    style,
    className,
  } = schema;

  const editorRef = useRef<IStandaloneDiffEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderSideBySide, setRenderSideBySide] = useState(true);
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
        // 减去工具栏高度和边距
        const availableHeight = rect.height - 72;
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
  const handleEditorMount: DiffOnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // P2-19: 设置 data-monaco-loaded 属性，供 Playwright 测试检测
    if (containerRef.current) {
      containerRef.current.setAttribute('data-monaco-loaded', 'true');
    }

    // 自定义深色主题
    monaco.editor.defineTheme('lsc-diff-dark', {
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
        'editor.background': '#0d1b2a00',
        'editor.foreground': '#E6EDF3',
        'editor.lineHighlightBackground': '#1e3a5f40',
        'diffEditor.insertedTextBackground': '#3fb95030',
        'diffEditor.removedTextBackground': '#f8514930',
        'diffEditor.insertedLineBackground': '#23863620',
        'diffEditor.removedLineBackground': '#da363320',
        'editorLineNumber.foreground': '#6E7681',
        'editorLineNumber.activeForeground': '#E6EDF3',
      },
    });

    monaco.editor.setTheme('lsc-diff-dark');
    editor.layout();
  }, []);

  // 切换视图模式
  const toggleViewMode = useCallback(() => {
    setRenderSideBySide((prev) => !prev);
  }, []);

  // 计算变更统计
  const stats = computeDiffStats(original, modified);

  // 计算高度
  const editorHeight = isAutoHeight
    ? `${dynamicHeight}px`
    : typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'workbench-code-diff',
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
        {/* 左侧：文件标题 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-tertiary)]">{originalTitle}</span>
            <SwapOutlined className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }} />
            <span className="text-xs text-[var(--text-tertiary)]">{modifiedTitle}</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">
            {normalizeLanguage(language)}
          </span>
        </div>

        {/* 右侧：统计和工具 */}
        <div className="flex items-center gap-3">
          {/* 变更统计 */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#3fb950]">+{stats.added}</span>
            <span className="text-[#f85149]">-{stats.removed}</span>
          </div>

          {/* 视图切换 */}
          <button
            onClick={toggleViewMode}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded',
              'text-xs text-[var(--text-secondary)]',
              'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
              'transition-colors duration-150'
            )}
            title={renderSideBySide ? '切换为内联视图' : '切换为并排视图'}
          >
            {renderSideBySide ? (
              <>
                <MenuOutlined style={{ fontSize: 12 }} />
                <span>内联</span>
              </>
            ) : (
              <>
                <ColumnWidthOutlined style={{ fontSize: 12 }} />
                <span>并排</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diff 编辑器 */}
      <div className={isAutoHeight ? 'flex-1 min-h-0' : ''} style={{ height: isAutoHeight ? undefined : editorHeight }}>
        <DiffEditor
          height={isAutoHeight ? '100%' : editorHeight}
          original={original}
          modified={modified}
          language={normalizeLanguage(language)}
          theme="lsc-diff-dark"
          onMount={handleEditorMount}
          loading={
            <div className="p-4">
              <Skeleton active paragraph={{ rows: 8 }} title={false} />
            </div>
          }
          options={{
            readOnly: true,
            renderSideBySide,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            lineHeight: 20,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            renderIndicators: true,
            ignoreTrimWhitespace: false,
            diffWordWrap: 'on',
            originalEditable: false,
            enableSplitViewResizing: true,
          }}
        />
      </div>
    </div>
  );
};

CodeDiff.displayName = 'WorkbenchCodeDiff';
