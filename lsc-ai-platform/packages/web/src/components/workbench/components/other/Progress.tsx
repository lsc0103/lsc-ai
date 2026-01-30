/**
 * Workbench Progress 进度条组件
 */

import React from 'react';
import { Progress as AntProgress } from 'antd';
import clsx from 'clsx';
import type { ProgressSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const Progress: React.FC<WorkbenchComponentProps<ProgressSchema>> = ({
  schema,
}) => {
  const {
    percent,
    progressType = 'line',
    status,
    format,
    style,
    className,
  } = schema;

  // 自定义格式化
  const formatFn = format
    ? () => format.replace('{percent}', String(percent))
    : undefined;

  return (
    <div
      className={clsx('workbench-progress', className)}
      style={style}
    >
      <AntProgress
        percent={percent}
        type={progressType}
        status={status}
        format={formatFn}
        strokeColor={{
          '0%': 'var(--accent-primary)',
          '100%': 'var(--accent-info)',
        }}
      />
    </div>
  );
};

Progress.displayName = 'WorkbenchProgress';
