/**
 * Workbench Button 按钮组件
 */

import React, { useCallback } from 'react';
import { Button as AntButton } from 'antd';
import * as Icons from '@ant-design/icons';
import type { ButtonSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { useWorkbenchStore } from '../../context';

// 图标映射
function getIcon(iconName?: string): React.ReactNode {
  if (!iconName) return null;
  const IconsMap = Icons as unknown as Record<string, React.ComponentType>;
  const IconComponent = IconsMap[iconName] || IconsMap[`${iconName}Outlined`];
  return IconComponent ? <IconComponent /> : null;
}

export const Button: React.FC<WorkbenchComponentProps<ButtonSchema>> = ({
  schema,
}) => {
  const {
    text,
    variant = 'default',
    icon,
    danger = false,
    disabled = false,
    loading = false,
    action,
    style,
    className,
  } = schema;

  const { handleAction } = useWorkbenchStore();

  const handleClick = useCallback(() => {
    if (action) {
      handleAction(action);
    }
  }, [action, handleAction]);

  return (
    <AntButton
      type={variant === 'default' ? 'default' : variant}
      icon={getIcon(icon)}
      danger={danger}
      disabled={disabled}
      loading={loading}
      onClick={handleClick}
      style={style}
      className={className}
    >
      {text}
    </AntButton>
  );
};

Button.displayName = 'WorkbenchButton';
