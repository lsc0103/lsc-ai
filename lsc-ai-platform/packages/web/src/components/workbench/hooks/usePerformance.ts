/**
 * Workbench 性能优化 Hooks
 *
 * 提供防抖、节流等性能优化工具
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 防抖 Hook
 * 延迟执行值更新，适用于输入框等场景
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 * 延迟执行回调函数
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // 更新回调引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * 节流 Hook
 * 限制函数执行频率
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdated.current;

    if (elapsed >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - elapsed);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * 节流回调 Hook
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): T {
  const callbackRef = useRef(callback);
  const lastExecuted = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const elapsed = now - lastExecuted.current;

      if (elapsed >= interval) {
        lastExecuted.current = now;
        callbackRef.current(...args);
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          lastExecuted.current = Date.now();
          callbackRef.current(...args);
          timerRef.current = undefined;
        }, interval - elapsed);
      }
    },
    [interval]
  ) as T;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * 懒加载 Hook
 * 延迟初始化昂贵的计算
 */
export function useLazy<T>(factory: () => T): T {
  const ref = useRef<T | null>(null);

  if (ref.current === null) {
    ref.current = factory();
  }

  return ref.current;
}

/**
 * 前一个值 Hook
 * 获取上一次渲染的值
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * 稳定回调 Hook
 * 返回一个稳定的回调引用，避免不必要的重渲染
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}

/**
 * 组件是否挂载 Hook
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

/**
 * 异步安全状态 Hook
 * 只在组件挂载时更新状态，避免内存泄漏
 */
export function useSafeState<T>(
  initialValue: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  const isMounted = useIsMounted();
  const [state, setState] = useState(initialValue);

  const safeSetState = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (isMounted()) {
        setState(value);
      }
    },
    [isMounted]
  );

  return [state, safeSetState];
}

/**
 * 间隔执行 Hook
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/**
 * 超时执行 Hook
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
