/**
 * Workbench Alert 警告提示组件
 */

import React from 'react';
import clsx from 'clsx';
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { AlertSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

const alertConfig = {
  success: {
    icon: CheckCircleOutlined,
    bgClass: 'bg-[var(--status-success-bg)]',
    borderClass: 'border-[var(--status-success-border)]',
    iconColor: 'var(--accent-success)',
  },
  info: {
    icon: InfoCircleOutlined,
    bgClass: 'bg-[var(--status-info-bg)]',
    borderClass: 'border-[var(--status-info-border)]',
    iconColor: 'var(--accent-info)',
  },
  warning: {
    icon: ExclamationCircleOutlined,
    bgClass: 'bg-[var(--status-warning-bg)]',
    borderClass: 'border-[var(--status-warning-border)]',
    iconColor: 'var(--accent-warning)',
  },
  error: {
    icon: CloseCircleOutlined,
    bgClass: 'bg-[var(--status-error-bg)]',
    borderClass: 'border-[var(--status-error-border)]',
    iconColor: 'var(--accent-error)',
  },
};

export const Alert: React.FC<WorkbenchComponentProps<AlertSchema>> = ({
  schema,
}) => {
  const { alertType, message, description, showIcon = true, style, className } = schema;

  const config = alertConfig[alertType];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'workbench-alert',
        'flex gap-3 p-4 rounded-lg border',
        config.bgClass,
        config.borderClass,
        className
      )}
      style={style}
    >
      {showIcon && (
        <Icon
          className="flex-shrink-0 text-lg mt-0.5"
          style={{ color: config.iconColor }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)]">
          {message}
        </div>
        {description && (
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

Alert.displayName = 'WorkbenchAlert';
