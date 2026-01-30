/**
 * Workbench VideoPreview 视频预览组件
 *
 * 使用浏览器原生 video 标签
 */

import React from 'react';
import clsx from 'clsx';
import type { VideoPreviewSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const VideoPreview: React.FC<WorkbenchComponentProps<VideoPreviewSchema>> = ({
  schema,
}) => {
  const {
    src,
    height = 400,
    autoPlay = false,
    loop = false,
    muted = false,
    style,
    className,
  } = schema;

  const containerHeight = height === 'auto' ? '100%' : (typeof height === 'number' ? `${height}px` : height);

  if (!src) {
    return (
      <div
        className={clsx(
          'workbench-video-preview',
          'flex items-center justify-center',
          'rounded-lg',
          'border border-[var(--border-light)]',
          'bg-[var(--glass-bg-medium)]',
          'text-[var(--text-tertiary)]',
          className
        )}
        style={{ ...style, height: containerHeight }}
      >
        未提供视频文件
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'workbench-video-preview',
        'flex items-center justify-center',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-black',
        height === 'auto' && 'h-full',
        className
      )}
      style={{ ...style, height: containerHeight }}
    >
      <video
        src={src}
        controls
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        className="max-w-full max-h-full"
        style={{ maxHeight: containerHeight }}
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
};

VideoPreview.displayName = 'WorkbenchVideoPreview';
