/**
 * API 动作处理器
 *
 * 处理 type: 'api' 的动作
 * 支持超时控制和自动重试
 */

import type { WorkbenchAction } from '../../schema/types';
import type { ActionContext, ActionResult, IActionHandler } from '../types';
import { parseObjectTemplates } from '../templateParser';

/** API 请求配置 */
interface ApiConfig {
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 重试延迟基数（毫秒），默认 1000 */
  retryDelay?: number;
  /** 是否在 5xx 错误时重试，默认 true */
  retryOnServerError?: boolean;
}

const DEFAULT_CONFIG: Required<ApiConfig> = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  retryOnServerError: true,
};

/**
 * API 动作处理器
 */
export class ApiActionHandler implements IActionHandler {
  private config: Required<ApiConfig>;

  constructor(config: ApiConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async handle(
    action: WorkbenchAction,
    context: ActionContext
  ): Promise<ActionResult> {
    // 验证动作类型
    if (action.type !== 'api') {
      return {
        success: false,
        error: '动作类型不是 api',
      };
    }

    // 验证端点
    if (!action.endpoint) {
      return {
        success: false,
        error: 'api 动作缺少 endpoint 参数',
      };
    }

    const method = action.method || 'GET';
    const endpoint = action.endpoint;

    // 解析参数中的模板变量
    const params = action.params
      ? parseObjectTemplates(action.params as Record<string, unknown>, context)
      : undefined;

    console.log('[ApiHandler] 调用 API:', { endpoint, method, params });

    // 使用重试机制执行请求
    return this.executeWithRetry(endpoint, method, params);
  }

  /**
   * 带重试的请求执行
   */
  private async executeWithRetry(
    endpoint: string,
    method: string,
    params?: Record<string, unknown>
  ): Promise<ActionResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeRequest(endpoint, method, params);

        // 如果成功或者是客户端错误（4xx），不重试
        if (result.success || !this.shouldRetry(result)) {
          return result;
        }

        lastError = new Error(result.error || 'Unknown error');
      } catch (error) {
        lastError = error as Error;
      }

      // 等待后重试（指数退避）
      if (attempt < this.config.maxRetries - 1) {
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        console.log(`[ApiHandler] 请求失败，${delay}ms 后重试 (${attempt + 1}/${this.config.maxRetries})`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: `API 请求失败（已重试 ${this.config.maxRetries} 次）: ${lastError?.message}`,
    };
  }

  /**
   * 执行单次请求
   */
  private async executeRequest(
    endpoint: string,
    method: string,
    params?: Record<string, unknown>
  ): Promise<ActionResult> {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // 构建请求选项
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      // 获取认证 token
      const token = localStorage.getItem('auth_token');
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }

      // 处理请求体/查询参数
      let url = endpoint;
      if (params) {
        if (method === 'GET') {
          // GET 请求：参数作为查询字符串
          const queryString = new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)])
          ).toString();
          url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
        } else {
          // POST/PUT/DELETE：参数作为请求体
          options.body = JSON.stringify(params);
        }
      }

      // 发送请求
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API 请求失败 (${response.status}): ${errorText}`,
          data: { statusCode: response.status },
        };
      }

      // 解析响应
      const contentType = response.headers.get('content-type');
      let data: unknown;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: true,
        data,
        shouldRefresh: true,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return {
          success: false,
          error: `API 请求超时 (${this.config.timeout}ms)`,
        };
      }

      console.error('[ApiHandler] API 调用失败:', error);
      return {
        success: false,
        error: `API 调用失败: ${(error as Error).message}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(result: ActionResult): boolean {
    if (!this.config.retryOnServerError) {
      return false;
    }

    // 检查是否是服务器错误 (5xx)
    const statusCode = (result.data as { statusCode?: number })?.statusCode;
    return statusCode !== undefined && statusCode >= 500;
  }

  /**
   * 延迟执行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建 API 处理器实例
 */
export const apiHandler = new ApiActionHandler();
