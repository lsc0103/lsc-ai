/**
 * Workbench ImagePreview 图片预览组件
 *
 * 支持：
 * - 缩放查看
 * - 拖拽平移
 * - 全屏预览
 * - 自适应/滚动模式
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Image } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  CompressOutlined,
  DragOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';
import type { ImagePreviewSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const ImagePreview: React.FC<WorkbenchComponentProps<ImagePreviewSchema>> = ({
  schema,
}) => {
  const {
    src,
    alt = '',
    width,
    height,
    zoomable = true,
    style,
    className,
  } = schema;

  const [previewVisible, setPreviewVisible] = useState(false);
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<'fit' | 'scroll'>('fit'); // fit: 适应容器, scroll: 原始大小可滚动
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 重置缩放和位置
  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.25));
  }, []);

  const toggleFitMode = useCallback(() => {
    setFitMode((m) => m === 'fit' ? 'scroll' : 'fit');
    handleReset();
  }, [handleReset]);

  // 移除滚轮缩放，避免与浏览器缩放冲突
  // 用户可以通过按钮或全屏模式来缩放图片

  // 拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1 || fitMode === 'scroll') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, fitMode, position]);

  // 拖拽移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // 拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 切换模式时重置
  useEffect(() => {
    handleReset();
  }, [fitMode, handleReset]);

  const containerHeight = height === 'auto' ? '100%' : (typeof height === 'number' ? `${height}px` : height);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'workbench-image-preview',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-medium)]',
        'flex flex-col',
        height === 'auto' && 'h-full',
        className
      )}
      style={style}
    >
      {/* 图片容器 */}
      <div
        className={clsx(
          'relative group flex-1 min-h-0',
          fitMode === 'scroll' ? 'overflow-auto' : 'overflow-hidden',
          isDragging ? 'cursor-grabbing' : (scale > 1 || fitMode === 'scroll') ? 'cursor-grab' : 'cursor-default'
        )}
        style={{
          width: width || '100%',
          height: containerHeight,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className={clsx(
            'w-full h-full flex items-center justify-center',
            fitMode === 'scroll' && 'min-w-max min-h-max'
          )}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <img
            src={src}
            alt={alt}
            className={clsx(
              fitMode === 'fit' ? 'max-w-full max-h-full object-contain' : ''
            )}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            draggable={false}
          />
        </div>

        {/* 悬浮工具栏 */}
        {zoomable && (
          <div
            className={clsx(
              'absolute bottom-3 left-1/2 -translate-x-1/2 z-10',
              'flex items-center gap-1 px-2 py-1.5 rounded-lg',
              'bg-[var(--glass-bg-solid)]',
              'backdrop-filter backdrop-blur-xl',
              'border border-[var(--border-light)]',
              'opacity-0 group-hover:opacity-100',
              'transition-opacity duration-200'
            )}
          >
            <button
              onClick={handleZoomOut}
              className={clsx(
                'p-1.5 rounded',
                'text-[var(--text-secondary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              title="缩小"
            >
              <ZoomOutOutlined />
            </button>

            <span className="text-xs text-[var(--text-tertiary)] min-w-[45px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              className={clsx(
                'p-1.5 rounded',
                'text-[var(--text-secondary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              title="放大"
            >
              <ZoomInOutlined />
            </button>

            <div className="w-px h-4 bg-[var(--border-light)] mx-0.5" />

            <button
              onClick={toggleFitMode}
              className={clsx(
                'p-1.5 rounded',
                'text-[var(--text-secondary)]',
                fitMode === 'scroll' && 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              title={fitMode === 'fit' ? '切换到原始大小（可滚动）' : '切换到适应容器'}
            >
              {fitMode === 'fit' ? <DragOutlined /> : <CompressOutlined />}
            </button>

            <button
              onClick={handleReset}
              className={clsx(
                'px-2 py-1 rounded text-xs',
                'text-[var(--text-secondary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              title="重置"
            >
              重置
            </button>

            <div className="w-px h-4 bg-[var(--border-light)] mx-0.5" />

            <button
              onClick={() => setPreviewVisible(true)}
              className={clsx(
                'p-1.5 rounded',
                'text-[var(--text-secondary)]',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                'transition-colors duration-150'
              )}
              title="全屏查看"
            >
              <ExpandOutlined />
            </button>
          </div>
        )}
      </div>

      {/* 图片信息 */}
      {alt && (
        <div className="px-3 py-2 text-xs text-[var(--text-tertiary)] border-t border-[var(--border-light)] flex-shrink-0">
          {alt}
        </div>
      )}

      {/* 全屏预览模态框 */}
      <Image
        src={src}
        alt={alt}
        style={{ display: 'none' }}
        preview={{
          visible: previewVisible,
          onVisibleChange: setPreviewVisible,
          scaleStep: 0.25,
        }}
      />
    </div>
  );
};

ImagePreview.displayName = 'WorkbenchImagePreview';
