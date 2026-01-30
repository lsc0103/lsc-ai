/**
 * Workbench Row 行组件
 */

import React from 'react';
import clsx from 'clsx';
import type { RowSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const Row: React.FC<WorkbenchComponentProps<RowSchema>> = ({
  schema,
  renderChildren,
}) => {
  const { gutter, align, justify, style, className, children } = schema;

  // 计算间距
  const gap = Array.isArray(gutter)
    ? `${gutter[1]}px ${gutter[0]}px`
    : gutter
    ? `${gutter}px`
    : '16px';

  // 对齐映射
  const alignItems = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
  }[align ?? 'top'];

  const justifyContent = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    'space-around': 'space-around',
    'space-between': 'space-between',
  }[justify ?? 'start'];

  return (
    <div
      className={clsx('workbench-row', 'flex flex-wrap', className)}
      style={{
        gap,
        alignItems,
        justifyContent,
        ...style,
      }}
    >
      {children && renderChildren?.(children)}
    </div>
  );
};

Row.displayName = 'WorkbenchRow';
