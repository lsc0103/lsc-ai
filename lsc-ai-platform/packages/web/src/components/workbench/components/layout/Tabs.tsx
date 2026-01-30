/**
 * Workbench Tabs 标签页布局组件
 *
 * 用于在 Workbench 内部创建嵌套的标签页布局
 */

import React, { useState } from 'react';
import { Tabs as AntTabs } from 'antd';
import clsx from 'clsx';
import type { TabsSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { SchemaRenderer } from '../../schema/renderer';

export const Tabs: React.FC<WorkbenchComponentProps<TabsSchema>> = ({
  schema,
}) => {
  const {
    items,
    defaultActiveKey,
    style,
    className,
  } = schema;

  const [activeKey, setActiveKey] = useState(
    defaultActiveKey || items[0]?.key || '0'
  );

  if (!items || items.length === 0) {
    return null;
  }

  const tabItems = items.map((item) => ({
    key: item.key,
    label: item.label,
    children: (
      <div className="workbench-tab-content">
        {item.children?.map((child, childIndex) => (
          <SchemaRenderer key={childIndex} schema={child} />
        ))}
      </div>
    ),
    disabled: item.disabled,
  }));

  return (
    <div
      className={clsx(
        'workbench-tabs',
        'rounded-lg overflow-hidden',
        className
      )}
      style={style}
    >
      <AntTabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={tabItems}
        className="workbench-inner-tabs"
      />
    </div>
  );
};

Tabs.displayName = 'WorkbenchTabs';
