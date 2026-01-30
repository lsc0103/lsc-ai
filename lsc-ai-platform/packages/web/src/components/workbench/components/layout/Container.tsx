/**
 * Workbench Container 容器组件
 */

import React from 'react';
import clsx from 'clsx';
import type { ContainerSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const Container: React.FC<WorkbenchComponentProps<ContainerSchema>> = ({
  schema,
  renderChildren,
}) => {
  const { padding, background, style, className, children } = schema;

  return (
    <div
      className={clsx('workbench-container', className)}
      style={{
        padding: padding ?? '16px',
        background: background ?? 'transparent',
        ...style,
      }}
    >
      {children && renderChildren?.(children)}
    </div>
  );
};

Container.displayName = 'WorkbenchContainer';
