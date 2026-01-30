/**
 * LSC-AI Workbench Schema 渲染器
 *
 * 核心渲染引擎：将 JSON Schema 转换为 React 组件树
 */

import React, { useMemo, useCallback, memo } from 'react';
import type { ComponentSchema, WorkbenchTab } from './types';
import { ComponentRegistry, type WorkbenchComponentProps } from '../registry';
import { ComponentErrorBoundary } from '../components/ErrorBoundary';

// ============================================================================
// 类型定义
// ============================================================================

interface SchemaRendererProps {
  /** 要渲染的 Schema */
  schema: ComponentSchema;
  /** 组件唯一键（用于列表渲染） */
  uniqueKey?: string;
  /** 渲染深度（防止无限递归） */
  depth?: number;
}

interface TabRendererProps {
  /** 标签页 Schema */
  tab: WorkbenchTab;
}

// ============================================================================
// 常量
// ============================================================================

/** 最大递归深度 */
const MAX_RENDER_DEPTH = 20;

// ============================================================================
// 组件渲染器
// ============================================================================

/**
 * Schema 渲染器
 * 递归渲染组件树
 */
export const SchemaRenderer: React.FC<SchemaRendererProps> = memo(({
  schema,
  uniqueKey,
  depth = 0,
}) => {
  // 防止无限递归
  if (depth > MAX_RENDER_DEPTH) {
    console.error(`SchemaRenderer: 超过最大渲染深度 (${MAX_RENDER_DEPTH})`);
    return (
      <div
        style={{
          padding: '8px',
          background: 'var(--status-error-bg)',
          borderRadius: '4px',
          color: 'var(--accent-error)',
          fontSize: '12px',
        }}
      >
        渲染深度超限，请检查 Schema 是否存在循环引用
      </div>
    );
  }

  // 获取组件渲染器
  const Renderer = ComponentRegistry.get(schema.type);

  // 如果没有找到渲染器，返回 null（FallbackComponent 会处理）
  if (!Renderer) {
    return null;
  }

  // 渲染子组件的函数
  const renderChildren = useCallback(
    (children: ComponentSchema[]): React.ReactNode => {
      if (!children || children.length === 0) return null;
      return children.map((child, index) => (
        <SchemaRenderer
          key={child.id || `${uniqueKey}-child-${index}`}
          schema={child}
          uniqueKey={`${uniqueKey}-child-${index}`}
          depth={depth + 1}
        />
      ));
    },
    [uniqueKey, depth]
  );

  // 组件 Props
  const componentProps: WorkbenchComponentProps = useMemo(
    () => ({
      schema,
      id: schema.id,
      renderChildren,
    }),
    [schema, renderChildren]
  );

  return (
    <ComponentErrorBoundary
      componentId={schema.id}
      componentType={schema.type}
    >
      <Renderer {...componentProps} />
    </ComponentErrorBoundary>
  );
});

SchemaRenderer.displayName = 'SchemaRenderer';

/**
 * 标签页内容渲染器
 */
export const TabContentRenderer: React.FC<TabRendererProps> = memo(({ tab }) => {
  if (!tab.components || tab.components.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: 'var(--text-tertiary)',
        }}
      >
        此标签页暂无内容
      </div>
    );
  }

  // 如果只有一个组件，让它填满整个空间
  const isSingleComponent = tab.components.length === 1;

  return (
    <div
      className={
        isSingleComponent
          ? 'workbench-tab-content h-full flex flex-col'
          : 'workbench-tab-content flex flex-col gap-4'
      }
    >
      {tab.components.map((component, index) => (
        <div
          key={component.id || `${tab.key}-component-${index}`}
          className={isSingleComponent ? 'flex-1 min-h-0' : ''}
        >
          <SchemaRenderer
            schema={component}
            uniqueKey={`${tab.key}-component-${index}`}
          />
        </div>
      ))}
    </div>
  );
});

TabContentRenderer.displayName = 'TabContentRenderer';

// ============================================================================
// 批量渲染辅助函数
// ============================================================================

/**
 * 批量渲染多个 Schema
 */
export function renderSchemas(
  schemas: ComponentSchema[],
  keyPrefix: string = 'schema'
): React.ReactNode[] {
  return schemas.map((schema, index) => (
    <SchemaRenderer
      key={schema.id || `${keyPrefix}-${index}`}
      schema={schema}
      uniqueKey={`${keyPrefix}-${index}`}
    />
  ));
}

/**
 * 条件渲染 Schema
 */
export function renderSchemaIf(
  condition: boolean,
  schema: ComponentSchema,
  key: string = 'conditional'
): React.ReactNode | null {
  if (!condition) return null;
  return <SchemaRenderer schema={schema} uniqueKey={key} />;
}
