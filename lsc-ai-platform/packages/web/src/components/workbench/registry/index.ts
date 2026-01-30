/**
 * LSC-AI Workbench 组件注册表
 *
 * 管理所有可用的 Workbench 组件
 * Schema 中的 type 字段会映射到这里注册的组件
 */

import React from 'react';
import type { ComponentType as SchemaComponentType, ComponentSchema } from '../schema/types';

// ============================================================================
// 类型定义
// ============================================================================

/** 组件 Props 基础类型 */
export interface WorkbenchComponentProps<T extends ComponentSchema = ComponentSchema> {
  /** 组件 Schema */
  schema: T;
  /** 组件 ID */
  id?: string;
  /** 子组件渲染函数 */
  renderChildren?: (children: ComponentSchema[]) => React.ReactNode;
}

/** 组件渲染器类型 */
export type ComponentRenderer<T extends ComponentSchema = ComponentSchema> =
  React.ComponentType<WorkbenchComponentProps<T>>;

/** 组件元信息 */
export interface ComponentMeta {
  /** 组件名称 */
  name: string;
  /** 组件描述 */
  description: string;
  /** 组件分类 */
  category: 'layout' | 'code' | 'data' | 'chart' | 'file' | 'form' | 'preview' | 'other';
  /** 是否支持子组件 */
  hasChildren: boolean;
  /** 默认属性 */
  defaultProps?: Partial<ComponentSchema>;
}

/** 注册的组件信息 */
interface RegisteredComponent {
  renderer: ComponentRenderer;
  meta: ComponentMeta;
}

// ============================================================================
// 组件注册表
// ============================================================================

class ComponentRegistryClass {
  private components: Map<SchemaComponentType, RegisteredComponent> = new Map();
  private fallbackComponent: ComponentRenderer | null = null;

  /**
   * 注册组件
   */
  register<T extends ComponentSchema>(
    type: SchemaComponentType,
    renderer: ComponentRenderer<T>,
    meta: ComponentMeta
  ): void {
    this.components.set(type, {
      renderer: renderer as ComponentRenderer,
      meta,
    });
  }

  /**
   * 批量注册组件
   */
  registerAll(
    components: Array<{
      type: SchemaComponentType;
      renderer: ComponentRenderer;
      meta: ComponentMeta;
    }>
  ): void {
    for (const { type, renderer, meta } of components) {
      this.register(type, renderer, meta);
    }
  }

  /**
   * 设置回退组件（当找不到对应组件时使用）
   */
  setFallback(renderer: ComponentRenderer): void {
    this.fallbackComponent = renderer;
  }

  /**
   * 获取组件渲染器
   */
  get(type: SchemaComponentType): ComponentRenderer | null {
    const registered = this.components.get(type);
    if (registered) {
      return registered.renderer;
    }
    return this.fallbackComponent;
  }

  /**
   * 获取组件元信息
   */
  getMeta(type: SchemaComponentType): ComponentMeta | null {
    const registered = this.components.get(type);
    return registered?.meta ?? null;
  }

  /**
   * 检查组件是否已注册
   */
  has(type: SchemaComponentType): boolean {
    return this.components.has(type);
  }

  /**
   * 获取所有已注册的组件类型
   */
  getRegisteredTypes(): SchemaComponentType[] {
    return Array.from(this.components.keys());
  }

  /**
   * 按分类获取组件
   */
  getByCategory(category: ComponentMeta['category']): SchemaComponentType[] {
    const result: SchemaComponentType[] = [];
    for (const [type, { meta }] of this.components) {
      if (meta.category === category) {
        result.push(type);
      }
    }
    return result;
  }

  /**
   * 获取所有组件信息（用于调试）
   */
  getAll(): Array<{ type: SchemaComponentType; meta: ComponentMeta }> {
    return Array.from(this.components.entries()).map(([type, { meta }]) => ({
      type,
      meta,
    }));
  }
}

// 导出单例
export const ComponentRegistry = new ComponentRegistryClass();

// ============================================================================
// 回退组件（显示未实现的组件类型）
// ============================================================================

const FallbackComponent: React.FC<WorkbenchComponentProps> = ({ schema }) => {
  return React.createElement(
    'div',
    {
      style: {
        padding: '16px',
        background: 'var(--glass-bg-light)',
        borderRadius: '8px',
        border: '1px dashed var(--border-default)',
        color: 'var(--text-tertiary)',
        textAlign: 'center',
      },
    },
    [
      React.createElement(
        'div',
        { key: 'icon', style: { fontSize: '24px', marginBottom: '8px' } },
        '🚧'
      ),
      React.createElement(
        'div',
        { key: 'text', style: { fontSize: '13px' } },
        `组件 "${schema.type}" 尚未实现`
      ),
    ]
  );
};

// 设置回退组件
ComponentRegistry.setFallback(FallbackComponent);

// ============================================================================
// 辅助 Hook
// ============================================================================

/**
 * 获取组件渲染器的 Hook
 */
export function useComponentRenderer(type: SchemaComponentType): ComponentRenderer | null {
  return ComponentRegistry.get(type);
}

/**
 * 检查组件是否可用的 Hook
 */
export function useComponentAvailable(type: SchemaComponentType): boolean {
  return ComponentRegistry.has(type);
}
