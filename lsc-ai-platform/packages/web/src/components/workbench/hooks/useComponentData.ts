/**
 * 组件数据 Hooks
 *
 * 提供组件间数据联动的能力
 */

import { useCallback, useMemo } from 'react';
import { useWorkbenchStore } from '../context/WorkbenchStore';
import type { WorkbenchAction } from '../schema/types';
import type { ActionContext } from '../actions/types';

// ============================================================================
// useComponentData - 获取和更新组件数据
// ============================================================================

/**
 * 组件数据 Hook
 *
 * @param componentId 组件 ID
 * @returns 组件数据和更新方法
 */
export function useComponentData<T = unknown>(componentId: string) {
  const componentStates = useWorkbenchStore((state) => state.componentStates);
  const setComponentState = useWorkbenchStore((state) => state.setComponentState);
  const updateComponentData = useWorkbenchStore((state) => state.updateComponentData);

  // 获取当前组件状态
  const componentState = componentStates[componentId];
  const data = componentState?.data as T | undefined;
  const isLoading = componentState?.loading ?? false;
  const error = componentState?.error;

  // 更新数据
  const setData = useCallback(
    (newData: T) => {
      updateComponentData(componentId, newData);
    },
    [componentId, updateComponentData]
  );

  // 设置加载状态
  const setLoading = useCallback(
    (loading: boolean) => {
      setComponentState(componentId, { loading });
    },
    [componentId, setComponentState]
  );

  // 设置错误
  const setError = useCallback(
    (error: string | undefined) => {
      setComponentState(componentId, { error });
    },
    [componentId, setComponentState]
  );

  return {
    data,
    isLoading,
    error,
    setData,
    setLoading,
    setError,
  };
}

// ============================================================================
// useSelectedRows - 管理选中行数据
// ============================================================================

/**
 * 选中行数据 Hook
 *
 * @param componentId 组件 ID（通常是 DataTable）
 * @returns 选中行数据和更新方法
 */
export function useSelectedRows<T = unknown>(componentId: string) {
  const componentStates = useWorkbenchStore((state) => state.componentStates);
  const setComponentState = useWorkbenchStore((state) => state.setComponentState);

  const componentState = componentStates[componentId];
  const selectedRows = (componentState?.selectedRows as T[]) || [];
  const selectedKeys = (componentState?.selectedKeys as React.Key[]) || [];

  // 更新选中行
  const setSelectedRows = useCallback(
    (keys: React.Key[], rows: T[]) => {
      setComponentState(componentId, {
        selectedKeys: keys,
        selectedRows: rows,
      });
    },
    [componentId, setComponentState]
  );

  // 清空选中
  const clearSelection = useCallback(() => {
    setComponentState(componentId, {
      selectedKeys: [],
      selectedRows: [],
    });
  }, [componentId, setComponentState]);

  return {
    selectedRows,
    selectedKeys,
    setSelectedRows,
    clearSelection,
    hasSelection: selectedRows.length > 0,
    selectedCount: selectedRows.length,
  };
}

// ============================================================================
// useFormValues - 管理表单值
// ============================================================================

/**
 * 表单值 Hook
 *
 * @param componentId 组件 ID（Form 组件）
 * @returns 表单值和更新方法
 */
export function useFormValues<T extends Record<string, unknown> = Record<string, unknown>>(
  componentId: string
) {
  const componentStates = useWorkbenchStore((state) => state.componentStates);
  const setComponentState = useWorkbenchStore((state) => state.setComponentState);

  const componentState = componentStates[componentId];
  const values = (componentState?.formValues as T) || ({} as T);

  // 更新单个字段
  const setFieldValue = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      const currentValues = useWorkbenchStore.getState().componentStates[componentId]?.formValues || {};
      setComponentState(componentId, {
        formValues: {
          ...currentValues,
          [field]: value,
        },
      });
    },
    [componentId, setComponentState]
  );

  // 更新多个字段
  const setValues = useCallback(
    (newValues: Partial<T>) => {
      const currentValues = useWorkbenchStore.getState().componentStates[componentId]?.formValues || {};
      setComponentState(componentId, {
        formValues: {
          ...currentValues,
          ...newValues,
        },
      });
    },
    [componentId, setComponentState]
  );

  // 重置表单
  const resetForm = useCallback(
    (initialValues?: T) => {
      setComponentState(componentId, {
        formValues: initialValues || {},
      });
    },
    [componentId, setComponentState]
  );

  return {
    values,
    setFieldValue,
    setValues,
    resetForm,
  };
}

// ============================================================================
// useActionContext - 构建动作上下文
// ============================================================================

/**
 * 动作上下文 Hook
 *
 * 构建执行动作时所需的上下文数据
 *
 * @param componentId 触发动作的组件 ID
 * @param componentType 组件类型
 * @returns 上下文数据和执行动作方法
 */
export function useActionContext(componentId: string, componentType?: string) {
  const componentStates = useWorkbenchStore((state) => state.componentStates);
  const schema = useWorkbenchStore((state) => state.schema);
  const handleAction = useWorkbenchStore((state) => state.handleAction);

  // 构建动作上下文
  const context = useMemo((): ActionContext => {
    const state = componentStates[componentId];

    return {
      sourceComponentId: componentId,
      sourceComponentType: componentType,
      data: {
        selectedRows: state?.selectedRows,
        selectedKeys: state?.selectedKeys,
        formValues: state?.formValues,
        componentData: state?.data,
      },
      componentData: Object.fromEntries(
        Object.entries(componentStates).map(([id, s]) => [id, s?.data])
      ),
      schema,
    };
  }, [componentId, componentType, componentStates, schema]);

  // 执行动作
  const executeAction = useCallback(
    async (action: WorkbenchAction, additionalData?: Record<string, unknown>) => {
      const mergedContext = {
        ...context,
        data: {
          ...context.data,
          ...additionalData,
        },
      };
      return handleAction(action, mergedContext.data);
    },
    [context, handleAction]
  );

  return {
    context,
    executeAction,
  };
}

// ============================================================================
// useDataReference - 数据引用解析
// ============================================================================

/**
 * 数据引用 Hook
 *
 * 解析 ${componentData.xxx} 格式的数据引用
 *
 * @param reference 数据引用字符串，如 "${componentData.table-1}"
 * @returns 引用的数据
 */
export function useDataReference<T = unknown>(reference: string): T | undefined {
  const componentStates = useWorkbenchStore((state) => state.componentStates);

  return useMemo(() => {
    // 解析引用格式
    const match = reference.match(/^\$\{componentData\.([^}]+)\}$/);
    if (!match) {
      return undefined;
    }

    const componentId = match[1];
    return componentStates[componentId]?.data as T | undefined;
  }, [reference, componentStates]);
}

// ============================================================================
// 导出
// ============================================================================

export default {
  useComponentData,
  useSelectedRows,
  useFormValues,
  useActionContext,
  useDataReference,
};
