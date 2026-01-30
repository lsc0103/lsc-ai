import type { Tool, ToolResult } from './types.js';
import { ToolError, Errors, isRetryableError } from './errors.js';

/**
 * 重试策略配置
 */
export interface RetryPolicy {
  /** 最大重试次数（不包括首次执行） */
  maxRetries: number;
  /** 初始退避时间（毫秒） */
  initialBackoffMs: number;
  /** 退避倍数 */
  backoffMultiplier: number;
  /** 最大退避时间（毫秒） */
  maxBackoffMs: number;
  /** 是否在重试前添加抖动（避免惊群效应） */
  jitter: boolean;
  /** 自定义重试条件（返回 true 则重试） */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 重试前的回调 */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * 默认重试策略
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  jitter: true,
};

/**
 * 针对不同错误类型的推荐重试策略
 */
export const RETRY_POLICIES: Record<string, RetryPolicy> = {
  /** 网络请求 - 更多重试，更长退避 */
  network: {
    maxRetries: 5,
    initialBackoffMs: 2000,
    backoffMultiplier: 2,
    maxBackoffMs: 60000,
    jitter: true,
  },
  /** 超时 - 适中重试 */
  timeout: {
    maxRetries: 2,
    initialBackoffMs: 5000,
    backoffMultiplier: 1.5,
    maxBackoffMs: 30000,
    jitter: false,
  },
  /** 资源占用 - 快速重试 */
  resourceBusy: {
    maxRetries: 5,
    initialBackoffMs: 500,
    backoffMultiplier: 1.5,
    maxBackoffMs: 10000,
    jitter: true,
  },
  /** 快速失败 - 基本不重试 */
  fast: {
    maxRetries: 1,
    initialBackoffMs: 500,
    backoffMultiplier: 1,
    maxBackoffMs: 500,
    jitter: false,
  },
};

/**
 * 计算退避延迟时间
 */
function calculateBackoff(
  attempt: number,
  policy: RetryPolicy
): number {
  let delay = policy.initialBackoffMs * Math.pow(policy.backoffMultiplier, attempt);
  delay = Math.min(delay, policy.maxBackoffMs);

  if (policy.jitter) {
    // 添加 0-25% 的随机抖动
    const jitterFactor = 1 + (Math.random() * 0.25);
    delay *= jitterFactor;
  }

  return Math.floor(delay);
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试执行结果
 */
export interface RetryResult<T> {
  /** 执行结果 */
  result?: T;
  /** 最终错误（如果失败） */
  error?: ToolError;
  /** 总尝试次数 */
  attempts: number;
  /** 是否成功 */
  success: boolean;
  /** 每次尝试的记录 */
  attemptLog: Array<{
    attempt: number;
    startTime: number;
    endTime: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * 带重试的函数执行器
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: Partial<RetryPolicy> = {}
): Promise<RetryResult<T>> {
  const fullPolicy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
  const attemptLog: RetryResult<T>['attemptLog'] = [];
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= fullPolicy.maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      const result = await fn();
      const endTime = Date.now();

      attemptLog.push({
        attempt,
        startTime,
        endTime,
        success: true,
      });

      return {
        result,
        attempts: attempt + 1,
        success: true,
        attemptLog,
      };
    } catch (error) {
      const endTime = Date.now();
      lastError = error as Error;

      attemptLog.push({
        attempt,
        startTime,
        endTime,
        success: false,
        error: (error as Error).message,
      });

      // 检查是否应该重试
      const shouldRetry = fullPolicy.shouldRetry
        ? fullPolicy.shouldRetry(lastError, attempt)
        : isRetryableError(lastError);

      // 已达最大重试次数或不应重试
      if (attempt >= fullPolicy.maxRetries || !shouldRetry) {
        break;
      }

      // 计算延迟
      const delayMs = calculateBackoff(attempt, fullPolicy);

      // 触发回调
      fullPolicy.onRetry?.(lastError, attempt, delayMs);

      // 等待后重试
      await sleep(delayMs);
    }
  }

  // 所有重试都失败了
  const toolError = Errors.fromError(lastError!);

  return {
    error: toolError,
    attempts: attemptLog.length,
    success: false,
    attemptLog,
  };
}

/**
 * 工具执行包装器 - 带重试的工具执行
 */
export async function executeToolWithRetry(
  tool: Tool,
  args: Record<string, unknown>,
  policy: Partial<RetryPolicy> = {}
): Promise<ToolResult> {
  const retryResult = await executeWithRetry(
    () => tool.execute(args),
    {
      ...policy,
      // 自定义重试条件：只有当 ToolResult.success 为 false 且错误可重试时才重试
      shouldRetry: (error, _attempt) => {
        return isRetryableError(error);
      },
    }
  );

  if (retryResult.success && retryResult.result) {
    // 如果工具返回了结果但 success 为 false，检查是否应该重试
    const result = retryResult.result;
    if (!result.success && result.error) {
      // 工具内部报告失败，但不是异常
      // 这种情况下尝试重试
      const errorLower = result.error.toLowerCase();
      const isRetryableByMessage =
        errorLower.includes('timeout') ||
        errorLower.includes('busy') ||
        errorLower.includes('try again');

      if (isRetryableByMessage && retryResult.attempts < (policy.maxRetries ?? 3)) {
        // 递归重试（减少剩余次数）
        return executeToolWithRetry(tool, args, {
          ...policy,
          maxRetries: (policy.maxRetries ?? 3) - retryResult.attempts,
        });
      }
    }
    return result;
  }

  // 执行失败，返回错误
  const error = retryResult.error ?? Errors.unknown('工具执行失败');
  return {
    success: false,
    output: '',
    error: error.toToolResultError(),
  };
}

/**
 * 创建带重试功能的工具包装器
 */
export function withRetry(tool: Tool, policy: Partial<RetryPolicy> = {}): Tool {
  return {
    definition: tool.definition,
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      return executeToolWithRetry(tool, args, policy);
    },
  };
}

/**
 * 批量执行工具，支持部分失败重试
 */
export async function executeToolsBatch(
  executions: Array<{ tool: Tool; args: Record<string, unknown> }>,
  options: {
    /** 并行执行的最大数量 */
    concurrency?: number;
    /** 重试策略 */
    retryPolicy?: Partial<RetryPolicy>;
    /** 是否在首个失败时停止 */
    stopOnFirstFailure?: boolean;
  } = {}
): Promise<Array<{ index: number; result: ToolResult }>> {
  const {
    concurrency = 5,
    retryPolicy = {},
    stopOnFirstFailure = false,
  } = options;

  const results: Array<{ index: number; result: ToolResult }> = [];
  const queue = executions.map((exec, index) => ({ ...exec, index }));

  // 简单的并发控制
  const executing: Promise<void>[] = [];

  for (const item of queue) {
    const promise = (async () => {
      try {
        const result = await executeToolWithRetry(item.tool, item.args, retryPolicy);
        results.push({ index: item.index, result });

        if (stopOnFirstFailure && !result.success) {
          throw new Error('Batch execution stopped due to failure');
        }
      } catch (error) {
        if (stopOnFirstFailure) {
          throw error;
        }
        results.push({
          index: item.index,
          result: {
            success: false,
            output: '',
            error: (error as Error).message,
          },
        });
      }
    })();

    executing.push(promise);

    // 控制并发
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  // 等待所有任务完成
  await Promise.allSettled(executing);

  // 按原始顺序排序
  results.sort((a, b) => a.index - b.index);

  return results;
}
