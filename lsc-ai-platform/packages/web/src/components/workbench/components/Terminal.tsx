/**
 * Workbench 终端面板组件
 *
 * 显示命令执行的实时输出
 */

import React, { useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import {
  CloseOutlined,
  ClearOutlined,
  DownOutlined,
  UpOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import {
  useTerminalStore,
  useTerminalCommands,
  type CommandRecord,
  type CommandStatus,
} from '../context/TerminalStore';

// ============================================================================
// 状态图标
// ============================================================================

const StatusIcon: React.FC<{ status: CommandStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <LoadingOutlined className="text-[var(--accent-primary)]" spin />;
    case 'success':
      return <CheckCircleOutlined className="text-[var(--accent-success)]" />;
    case 'error':
      return <CloseCircleOutlined className="text-[var(--accent-error)]" />;
    case 'cancelled':
      return <CloseCircleOutlined className="text-[var(--text-tertiary)]" />;
    default:
      return null;
  }
};

// ============================================================================
// 单条命令输出
// ============================================================================

interface CommandOutputProps {
  record: CommandRecord;
  isLast: boolean;
}

const CommandOutput: React.FC<CommandOutputProps> = ({ record, isLast }) => {
  const outputRef = useRef<HTMLPreElement>(null);

  // 自动滚动到底部（仅当是最后一条且正在运行时）
  useEffect(() => {
    if (isLast && record.status === 'running' && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [record.output, record.status, isLast]);

  const duration = record.endTime
    ? ((record.endTime - record.startTime) / 1000).toFixed(1)
    : null;

  return (
    <div className="mb-3">
      {/* 命令行 */}
      <div className="flex items-center gap-2 mb-1">
        <StatusIcon status={record.status} />
        <span className="text-[var(--accent-primary)] font-mono text-xs">$</span>
        <span className="font-mono text-xs text-[var(--text-primary)] flex-1 truncate">
          {record.command}
        </span>
        {duration && (
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {duration}s
          </span>
        )}
      </div>

      {/* 输出内容 */}
      {record.output && (
        <pre
          ref={outputRef}
          className={clsx(
            'font-mono text-xs leading-relaxed',
            'pl-5 max-h-[300px] overflow-auto',
            'text-[var(--text-secondary)]',
            'whitespace-pre-wrap break-all'
          )}
        >
          {record.output}
        </pre>
      )}

      {/* 错误信息 */}
      {record.error && (
        <div className="pl-5 text-xs text-[var(--accent-error)]">
          {record.error}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 终端面板
// ============================================================================

export const TerminalPanel: React.FC = () => {
  const commands = useTerminalCommands();
  const { isExpanded, height, toggleExpanded, setExpanded, setHeight, clearHistory } =
    useTerminalStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // 如果没有命令历史，不显示面板
  if (commands.length === 0) {
    return null;
  }

  // 自动滚动到底部
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [commands, isExpanded]);

  // 拖拽调整高度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY - e.clientY;
      setHeight(startHeight + delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, setHeight]);

  // 统计
  const runningCount = commands.filter((c) => c.status === 'running').length;
  const hasRunning = runningCount > 0;

  return (
    <div
      ref={panelRef}
      className={clsx(
        'terminal-panel',
        'border-t border-[var(--border-light)]',
        'bg-[var(--glass-bg-solid)]',
        'flex flex-col',
        'transition-all duration-200'
      )}
      style={{ height: isExpanded ? height : 32 }}
    >
      {/* 拖拽条 */}
      {isExpanded && (
        <div
          ref={resizeRef}
          className={clsx(
            'h-1 cursor-ns-resize',
            'hover:bg-[var(--accent-primary)]/30',
            'transition-colors duration-150'
          )}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* 标题栏 */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'h-8 px-3',
          'border-b border-[var(--border-light)]',
          'bg-[var(--glass-bg-subtle)]',
          'cursor-pointer',
          'select-none'
        )}
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <DownOutlined className="text-[10px] text-[var(--text-tertiary)]" />
          ) : (
            <UpOutlined className="text-[10px] text-[var(--text-tertiary)]" />
          )}
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            终端输出
          </span>
          {hasRunning && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--accent-primary)]">
              <LoadingOutlined spin />
              {runningCount} 个任务执行中
            </span>
          )}
          {!hasRunning && commands.length > 0 && (
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {commands.length} 条记录
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="清空历史">
            <button
              className={clsx(
                'w-6 h-6 flex items-center justify-center rounded',
                'text-[var(--text-tertiary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              onClick={clearHistory}
            >
              <ClearOutlined style={{ fontSize: 12 }} />
            </button>
          </Tooltip>
          <Tooltip title="关闭">
            <button
              className={clsx(
                'w-6 h-6 flex items-center justify-center rounded',
                'text-[var(--text-tertiary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              onClick={() => setExpanded(false)}
            >
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 内容区 */}
      {isExpanded && (
        <div
          ref={contentRef}
          className={clsx(
            'flex-1 overflow-auto',
            'px-3 py-2',
            'bg-[#0d1117]' // 深色终端背景
          )}
        >
          {commands.map((record, index) => (
            <CommandOutput
              key={record.id}
              record={record}
              isLast={index === commands.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;
