/**
 * Workbench Col 列组件
 */

import React from 'react';
import clsx from 'clsx';
import type { ColSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const Col: React.FC<WorkbenchComponentProps<ColSchema>> = ({
  schema,
  renderChildren,
}) => {
  const { span, offset, flex, style, className, children } = schema;

  // 计算宽度（基于 24 栅格）
  const width = span ? `${(span / 24) * 100}%` : undefined;
  const marginLeft = offset ? `${(offset / 24) * 100}%` : undefined;

  return (
    <div
      className={clsx('workbench-col', className)}
      style={{
        width,
        marginLeft,
        flex: flex ?? (span ? undefined : 1),
        ...style,
      }}
    >
      {children && renderChildren?.(children)}
    </div>
  );
};

Col.displayName = 'WorkbenchCol';
