/**
 * Workbench Terminal 终端输出组件
 *
 * 用于显示命令执行结果
 * - ANSI 颜色代码支持
 * - 自动滚动到底部
 * - 复制功能
 * - 玻璃拟态风格
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CopyOutlined, CheckOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { TerminalSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

// ============================================================================
// ANSI 颜色解析
// ============================================================================

interface AnsiSegment {
  text: string;
  style: React.CSSProperties;
}

// ANSI 颜色映射
const ANSI_COLORS: Record<number, string> = {
  30: '#1a1a2e',   // 黑色
  31: '#f85149',   // 红色
  32: '#3fb950',   // 绿色
  33: '#d29922',   // 黄色
  34: '#58a6ff',   // 蓝色
  35: '#bc8cff',   // 洋红
  36: '#39c5cf',   // 青色
  37: '#d4d4d4',   // 白色
  90: '#6e7681',   // 亮黑（灰色）
  91: '#ff7b72',   // 亮红
  92: '#7ee787',   // 亮绿
  93: '#e3b341',   // 亮黄
  94: '#79c0ff',   // 亮蓝
  95: '#d2a8ff',   // 亮洋红
  96: '#56d4dd',   // 亮青
  97: '#ffffff',   // 亮白
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#1a1a2e',
  41: '#f8514920',
  42: '#3fb95020',
  43: '#d2992220',
  44: '#58a6ff20',
  45: '#bc8cff20',
  46: '#39c5cf20',
  47: '#d4d4d420',
};

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  // ANSI 转义序列正则: ESC[<code>m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let currentStyle: React.CSSProperties = {};
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    // 添加前面的文本
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        style: { ...currentStyle },
      });
    }

    // 解析 ANSI 代码
    const codes = match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) {
        // 重置
        currentStyle = {};
      } else if (code === 1) {
        // 粗体
        currentStyle.fontWeight = 'bold';
      } else if (code === 3) {
        // 斜体
        currentStyle.fontStyle = 'italic';
      } else if (code === 4) {
        // 下划线
        currentStyle.textDecoration = 'underline';
      } else if (code >= 30 && code <= 37) {
        // 前景色
        currentStyle.color = ANSI_COLORS[code];
      } else if (code >= 90 && code <= 97) {
        // 亮前景色
        currentStyle.color = ANSI_COLORS[code];
      } else if (code >= 40 && code <= 47) {
        // 背景色
        currentStyle.backgroundColor = ANSI_BG_COLORS[code];
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      style: { ...currentStyle },
    });
  }

  return segments;
}

// 渲染 ANSI 文本
const AnsiText: React.FC<{ content: string }> = ({ content }) => {
  const segments = useMemo(() => parseAnsi(content), [content]);

  return (
    <>
      {segments.map((segment, index) => (
        <span key={index} style={segment.style}>
          {segment.text}
        </span>
      ))}
    </>
  );
};

// ============================================================================
// 终端行组件
// ============================================================================

interface TerminalLineProps {
  line: string;
  lineNumber: number;
}

const TerminalLine: React.FC<TerminalLineProps> = React.memo(({ line }) => {
  // 检测特殊行类型
  const isPrompt = line.startsWith('$') || line.startsWith('>') || line.startsWith('#');
  const isSuccess = line.includes('✓') || line.includes('success') || line.includes('完成');
  const isError = line.includes('✗') || line.includes('error') || line.includes('Error') || line.includes('失败');
  const isWarning = line.includes('warning') || line.includes('Warning') || line.includes('warn');

  return (
    <div
      className={clsx(
        'terminal-line',
        'leading-6 whitespace-pre-wrap break-all',
        isPrompt && 'text-[#58a6ff]',
        isSuccess && !isPrompt && 'text-[#3fb950]',
        isError && !isPrompt && 'text-[#f85149]',
        isWarning && !isPrompt && 'text-[#d29922]',
      )}
    >
      <AnsiText content={line} />
    </div>
  );
});

TerminalLine.displayName = 'TerminalLine';

// ============================================================================
// 主组件
// ============================================================================

export const Terminal: React.FC<WorkbenchComponentProps<TerminalSchema>> = ({
  schema,
}) => {
  const {
    content: rawContent,
    title = '终端',
    height = 300,
    autoScroll = true,
    style,
    className,
  } = schema;

  // BUG-1 fix: content 可能是 string、string[] 或 undefined，统一转为 string
  const content: string = Array.isArray(rawContent)
    ? rawContent.join('\n')
    : (typeof rawContent === 'string' ? rawContent : '');

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, autoScroll]);

  // 复制内容（去除 ANSI 代码）
  const handleCopy = useCallback(async () => {
    // 移除 ANSI 转义序列
    const plainText = content.replace(/\x1b\[[0-9;]*m/g, '');
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败');
    }
  }, [content]);

  // 切换展开/收起
  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // 解析行
  const lines = useMemo(() => {
    return content.split('\n');
  }, [content]);

  // 计算高度
  const computedHeight = expanded
    ? 'calc(100vh - 200px)'
    : typeof height === 'number'
      ? `${height}px`
      : height;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'workbench-terminal',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[#0d1117]',
        className
      )}
      style={style}
    >
      {/* 顶部工具栏 */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'h-9 px-3',
          'border-b border-[#30363d]',
          'bg-[#161b22]'
        )}
      >
        {/* 左侧：标题 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8b949e] font-medium">
            {title}
          </span>
        </div>

        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleExpand}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded',
              'text-xs text-[#8b949e]',
              'hover:bg-[#30363d] hover:text-[#c9d1d9]',
              'transition-colors duration-150'
            )}
            title={expanded ? '收起' : '展开'}
          >
            {expanded ? (
              <CompressOutlined style={{ fontSize: 12 }} />
            ) : (
              <ExpandOutlined style={{ fontSize: 12 }} />
            )}
          </button>
          <button
            onClick={handleCopy}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded',
              'text-xs text-[#8b949e]',
              'hover:bg-[#30363d] hover:text-[#c9d1d9]',
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

      {/* 终端内容 */}
      <div
        ref={contentRef}
        className="terminal-content overflow-auto p-4"
        style={{
          height: computedHeight,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#c9d1d9',
        }}
      >
        {lines.map((line, index) => (
          <TerminalLine key={index} line={line} lineNumber={index + 1} />
        ))}
      </div>
    </div>
  );
};

Terminal.displayName = 'WorkbenchTerminal';
