/**
 * Workbench Collapse 折叠面板布局组件
 *
 * 用于在 Workbench 内部创建可折叠的内容区域
 */

import React from 'react';
import { Collapse as AntCollapse } from 'antd';
import clsx from 'clsx';
import type { CollapseSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { SchemaRenderer } from '../../schema/renderer';

export const Collapse: React.FC<WorkbenchComponentProps<CollapseSchema>> = ({
  schema,
}) => {
  const {
    items,
    defaultActiveKey,
    accordion = false,
    style,
    className,
  } = schema;

  if (!items || items.length === 0) {
    return null;
  }

  const collapseItems = items.map((item) => ({
    key: item.key,
    label: item.label,
    children: (
      <div className="workbench-collapse-content">
        {item.children?.map((child, childIndex) => (
          <SchemaRenderer key={childIndex} schema={child} />
        ))}
      </div>
    ),
  }));

  return (
    <div
      className={clsx(
        'workbench-collapse',
        'rounded-lg overflow-hidden',
        className
      )}
      style={style}
    >
      <AntCollapse
        defaultActiveKey={defaultActiveKey}
        accordion={accordion}
        items={collapseItems}
      />
    </div>
  );
};

Collapse.displayName = 'WorkbenchCollapse';
