/**
 * Workbench PdfPreview PDF 预览组件
 *
 * 使用浏览器原生 PDF 渲染能力
 */

import React from 'react';
import clsx from 'clsx';
import type { PdfPreviewSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const PdfPreview: React.FC<WorkbenchComponentProps<PdfPreviewSchema>> = ({
  schema,
}) => {
  const {
    url,
    src,
    height = 500,
    style,
    className,
  } = schema;

  // 优先使用 src（base64 data URL），其次使用 url
  const pdfSrc = src || url || '';

  const containerHeight = height === 'auto' ? '100%' : (typeof height === 'number' ? `${height}px` : height);

  if (!pdfSrc) {
    return (
      <div
        className={clsx(
          'workbench-pdf-preview',
          'flex items-center justify-center',
          'rounded-lg',
          'border border-[var(--border-light)]',
          'bg-[var(--glass-bg-medium)]',
          'text-[var(--text-tertiary)]',
          className
        )}
        style={{ ...style, height: containerHeight }}
      >
        未提供 PDF 文件
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'workbench-pdf-preview',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-medium)]',
        height === 'auto' && 'h-full',
        className
      )}
      style={{ ...style, height: containerHeight }}
    >
      <iframe
        src={pdfSrc}
        className="w-full h-full border-0"
        title="PDF 预览"
      />
    </div>
  );
};

PdfPreview.displayName = 'WorkbenchPdfPreview';
