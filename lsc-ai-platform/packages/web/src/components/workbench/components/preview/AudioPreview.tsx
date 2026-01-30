/**
 * Workbench AudioPreview 音频预览组件
 *
 * 使用浏览器原生 audio 标签，带有简洁的 UI
 */

import React from 'react';
import clsx from 'clsx';
import { CustomerServiceOutlined } from '@ant-design/icons';
import type { AudioPreviewSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const AudioPreview: React.FC<WorkbenchComponentProps<AudioPreviewSchema>> = ({
  schema,
}) => {
  const {
    src,
    filename = '音频文件',
    height = 200,
    autoPlay = false,
    loop = false,
    style,
    className,
  } = schema;

  const containerHeight = height === 'auto' ? '100%' : (typeof height === 'number' ? `${height}px` : height);

  if (!src) {
    return (
      <div
        className={clsx(
          'workbench-audio-preview',
          'flex items-center justify-center',
          'rounded-lg',
          'border border-[var(--border-light)]',
          'bg-[var(--glass-bg-medium)]',
          'text-[var(--text-tertiary)]',
          className
        )}
        style={{ ...style, height: containerHeight }}
      >
        未提供音频文件
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'workbench-audio-preview',
        'flex flex-col items-center justify-center gap-6 p-8',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-medium)]',
        height === 'auto' && 'h-full',
        className
      )}
      style={{ ...style, height: containerHeight }}
    >
      {/* 图标 */}
      <div
        className={clsx(
          'w-24 h-24 rounded-full flex items-center justify-center',
          'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]',
          'text-4xl text-white shadow-lg'
        )}
      >
        <CustomerServiceOutlined />
      </div>

      {/* 文件名 */}
      <div className="text-[var(--text-primary)] font-medium text-center max-w-xs truncate">
        {filename}
      </div>

      {/* 音频播放器 */}
      <audio
        src={src}
        controls
        autoPlay={autoPlay}
        loop={loop}
        className="w-full max-w-md"
      >
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
};

AudioPreview.displayName = 'WorkbenchAudioPreview';
