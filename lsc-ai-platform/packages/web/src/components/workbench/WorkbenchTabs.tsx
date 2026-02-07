/**
 * LSC-AI Workbench 标签页管理组件
 *
 * 多标签页管理、切换、关闭
 * - 右键菜单支持关闭其他、关闭全部
 * - 标签页拖拽排序（预留）
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { CloseOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useWorkbenchStore, useWorkbenchSchema } from './context';

// ============================================================================
// 标签页组件
// ============================================================================

export const WorkbenchTabs: React.FC = () => {
  const schema = useWorkbenchSchema();
  const { activeTabKey, setActiveTab, closeTab, closeTabs, closeOtherTabs } = useWorkbenchStore();
  const [contextMenuTabKey, setContextMenuTabKey] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  if (!schema || schema.tabs.length === 0) {
    return null;
  }

  // 处理菜单点击 - 使用独立的处理函数来避免事件冒泡问题
  const handleMenuClick = useCallback((tabKey: string, menuKey: string) => {
    console.log('[WorkbenchTabs] 菜单点击:', { tabKey, menuKey });
    // 立即设置一个标记，防止菜单关闭后触发标签页切换
    const closableTabs = schema?.tabs.filter(t => t.closable !== false) ?? [];

    switch (menuKey) {
      case 'close':
        console.log('[WorkbenchTabs] 执行关闭标签页:', tabKey);
        closeTab(tabKey);
        break;
      case 'closeOthers':
        console.log('[WorkbenchTabs] 执行关闭其他标签页, 保留:', tabKey);
        closeOtherTabs?.(tabKey);
        break;
      case 'closeAll': {
        const keysToClose = closableTabs.map(t => t.key);
        closeTabs?.(keysToClose);
        break;
      }
      case 'closeLeft': {
        const tabIndex = schema?.tabs.findIndex(t => t.key === tabKey) ?? -1;
        if (tabIndex > 0) {
          const keysToClose = schema!.tabs
            .slice(0, tabIndex)
            .filter(t => t.closable !== false)
            .map(t => t.key);
          closeTabs?.(keysToClose);
        }
        break;
      }
      case 'closeRight': {
        const tabIndex = schema?.tabs.findIndex(t => t.key === tabKey) ?? -1;
        if (tabIndex >= 0 && tabIndex < (schema?.tabs.length ?? 0) - 1) {
          const keysToClose = schema!.tabs
            .slice(tabIndex + 1)
            .filter(t => t.closable !== false)
            .map(t => t.key);
          closeTabs?.(keysToClose);
        }
        break;
      }
    }
  }, [schema, closeTab, closeOtherTabs, closeTabs]);

  // 上下文菜单项
  const getContextMenuItems = useCallback((tabKey: string): MenuProps['items'] => {
    const tab = schema?.tabs.find(t => t.key === tabKey);
    const canClose = tab?.closable !== false && (schema?.tabs.length ?? 0) > 1;
    const hasOtherTabs = (schema?.tabs.length ?? 0) > 1;
    const closableTabs = schema?.tabs.filter(t => t.closable !== false) ?? [];
    const hasMultipleClosable = closableTabs.length > 1;
    const tabIndex = schema?.tabs.findIndex(t => t.key === tabKey) ?? -1;

    return [
      {
        key: 'close',
        label: '关闭',
        disabled: !canClose,
      },
      {
        key: 'closeOthers',
        label: '关闭其他',
        disabled: !hasOtherTabs,
      },
      {
        key: 'closeAll',
        label: '关闭全部',
        disabled: !hasMultipleClosable,
      },
      { type: 'divider' },
      {
        key: 'closeLeft',
        label: '关闭左侧',
        disabled: tabIndex <= 0,
      },
      {
        key: 'closeRight',
        label: '关闭右侧',
        disabled: tabIndex >= (schema?.tabs.length ?? 0) - 1,
      },
    ];
  }, [schema]);

  // 滚动活动标签页到可视区域
  useEffect(() => {
    if (activeTabKey && tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(`[data-tab-key="${activeTabKey}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTabKey]);

  return (
    <div
      ref={tabsRef}
      data-testid="workbench-tabs"
      className={clsx(
        'workbench-tabs',
        'flex items-center',
        'h-10 px-2',
        'border-b border-[var(--border-light)]',
        'bg-[var(--glass-bg-subtle)]',
        'overflow-x-auto',
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      {schema.tabs.map((tab) => {
        const isActive = tab.key === activeTabKey;
        const canClose = tab.closable !== false && schema.tabs.length > 1;

        return (
          <Dropdown
            key={tab.key}
            menu={{
              items: getContextMenuItems(tab.key),
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                handleMenuClick(tab.key, key);
              },
            }}
            trigger={['contextMenu']}
            onOpenChange={(open) => {
              if (open) {
                setContextMenuTabKey(tab.key);
              } else if (contextMenuTabKey === tab.key) {
                setContextMenuTabKey(null);
              }
            }}
          >
            <div
              data-testid="workbench-tab"
              data-tab-key={tab.key}
              className={clsx(
                'workbench-tab',
                'group flex items-center gap-2',
                'h-8 px-3 mx-0.5',
                'rounded-md cursor-pointer',
                'text-sm whitespace-nowrap',
                'transition-all duration-150',
                isActive
                  ? 'bg-[var(--glass-bg-medium)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                contextMenuTabKey === tab.key && 'ring-1 ring-[var(--accent-primary)]'
              )}
              onClick={() => setActiveTab(tab.key)}
              onDoubleClick={() => {
                // 双击可以未来扩展为重命名功能
                console.log('[WorkbenchTabs] Double click on tab:', tab.key);
              }}
            >
              {/* 图标 */}
              {tab.icon && (
                <span className="text-base">{tab.icon}</span>
              )}

              {/* 标题 */}
              <span className="max-w-[120px] truncate">{tab.title}</span>

              {/* 关闭按钮 */}
              {canClose && (
                <button
                  data-testid="workbench-tab-close"
                  className={clsx(
                    'w-4 h-4 flex items-center justify-center',
                    'rounded-sm',
                    'text-[var(--text-tertiary)]',
                    'opacity-0 group-hover:opacity-100',
                    'hover:bg-[var(--glass-bg-solid)] hover:text-[var(--text-primary)]',
                    'transition-all duration-150',
                    isActive && 'opacity-100'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.key);
                  }}
                >
                  <CloseOutlined style={{ fontSize: 10 }} />
                </button>
              )}
            </div>
          </Dropdown>
        );
      })}
    </div>
  );
};

WorkbenchTabs.displayName = 'WorkbenchTabs';

export default WorkbenchTabs;
