/**
 * LSC-AI Workbench 分屏布局组件
 *
 * 实现左侧聊天 + 右侧工作台的分屏布局
 * - 可拖拽调整宽度
 * - 平滑动画过渡
 * - 响应式适配
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useWorkbenchStore, useWorkbenchVisible, useWorkbenchWidthRatio } from './context';
import { Workbench } from './Workbench';

// ============================================================================
// 类型定义
// ============================================================================

interface WorkbenchLayoutProps {
  /** 聊天区域内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

// ============================================================================
// 常量
// ============================================================================

/** 最小宽度比例 */
const MIN_WIDTH_RATIO = 0.25;
/** 最大宽度比例 */
const MAX_WIDTH_RATIO = 0.75;
/** 拖拽条宽度 */
const RESIZER_WIDTH = 6;

// ============================================================================
// 主组件
// ============================================================================

export const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({
  children,
  className,
}) => {
  const visible = useWorkbenchVisible();
  const widthRatio = useWorkbenchWidthRatio();
  const { setWidthRatio } = useWorkbenchStore();

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 处理拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // 处理拖拽移动
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;
      const mouseX = e.clientX - rect.left;

      // 计算聊天区域的比例（左侧）
      const chatRatio = mouseX / containerWidth;
      // Workbench 占右侧，所以 widthRatio = 1 - chatRatio
      const newWorkbenchRatio = 1 - chatRatio;

      // 限制在合理范围
      const clampedRatio = Math.max(
        MIN_WIDTH_RATIO,
        Math.min(MAX_WIDTH_RATIO, newWorkbenchRatio)
      );

      setWidthRatio(clampedRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // 拖拽时禁止选择文本
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, setWidthRatio]);

  // 计算宽度
  const chatWidth = visible ? `${(1 - widthRatio) * 100}%` : '100%';
  const workbenchWidth = visible ? `${widthRatio * 100}%` : '0%';

  return (
    <div
      ref={containerRef}
      data-testid="workbench-layout"
      className={clsx(
        'workbench-layout',
        'flex h-full w-full',
        'overflow-hidden',
        className
      )}
    >
      {/* 聊天区域 */}
      <motion.div
        className="chat-area h-full overflow-hidden"
        initial={false}
        animate={{ width: chatWidth }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>

      {/* 分隔线（可拖拽） */}
      <AnimatePresence>
        {visible && (
          <motion.div
            data-testid="workbench-resizer"
            className={clsx(
              'workbench-resizer',
              'relative flex-shrink-0 cursor-col-resize',
              'transition-colors duration-150',
              isDragging
                ? 'bg-[var(--accent-primary)]'
                : 'bg-[var(--border-light)] hover:bg-[var(--accent-primary)]'
            )}
            style={{ width: RESIZER_WIDTH }}
            onMouseDown={handleDragStart}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* 拖拽指示器 */}
            <div
              className={clsx(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                'w-1 h-8 rounded-full',
                'transition-all duration-150',
                isDragging
                  ? 'bg-white opacity-80'
                  : 'bg-[var(--text-tertiary)] opacity-50'
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workbench 区域 */}
      <AnimatePresence>
        {visible && (
          <motion.div
            data-testid="workbench-area"
            className="workbench-area h-full overflow-hidden"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: workbenchWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Workbench />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

WorkbenchLayout.displayName = 'WorkbenchLayout';

export default WorkbenchLayout;
