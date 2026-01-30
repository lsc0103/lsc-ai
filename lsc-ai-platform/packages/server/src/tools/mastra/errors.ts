/**
 * 工具错误类型枚举
 */
export enum ErrorType {
  /** 参数验证失败 */
  VALIDATION = 'validation',
  /** 权限不足 */
  PERMISSION = 'permission',
  /** 执行超时 */
  TIMEOUT = 'timeout',
  /** 网络错误 */
  NETWORK = 'network',
  /** 文件/资源不存在 */
  NOT_FOUND = 'not_found',
  /** 文件/资源已存在 */
  ALREADY_EXISTS = 'already_exists',
  /** 资源冲突（如文件被外部修改） */
  CONFLICT = 'conflict',
  /** 资源被占用 */
  RESOURCE_BUSY = 'resource_busy',
  /** 操作被用户取消 */
  CANCELLED = 'cancelled',
  /** 依赖缺失 */
  DEPENDENCY = 'dependency',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  /** 低 - 可自动恢复 */
  LOW = 'low',
  /** 中 - 需要用户注意 */
  MEDIUM = 'medium',
  /** 高 - 需要用户干预 */
  HIGH = 'high',
  /** 严重 - 可能导致数据丢失 */
  CRITICAL = 'critical',
}

/**
 * 工具错误类 - 提供详细的错误信息和恢复建议
 */
export class ToolError extends Error {
  /** 错误类型 */
  readonly type: ErrorType;
  /** 是否可重试 */
  readonly retryable: boolean;
  /** 错误严重程度 */
  readonly severity: ErrorSeverity;
  /** 原始错误 */
  readonly originalError?: Error;
  /** 相关上下文信息 */
  readonly context?: Record<string, unknown>;
  /** 恢复建议 */
  readonly suggestion?: string;
  /** 错误代码（用于文档查询） */
  readonly code: string;

  constructor(options: {
    type: ErrorType;
    message: string;
    retryable?: boolean;
    severity?: ErrorSeverity;
    originalError?: Error;
    context?: Record<string, unknown>;
    suggestion?: string;
    code?: string;
  }) {
    super(options.message);
    this.name = 'ToolError';
    this.type = options.type;
    this.retryable = options.retryable ?? this.getDefaultRetryable(options.type);
    this.severity = options.severity ?? this.getDefaultSeverity(options.type);
    this.originalError = options.originalError;
    this.context = options.context;
    this.suggestion = options.suggestion;
    this.code = options.code ?? `ERR_${options.type.toUpperCase()}`;

    // 保留原始堆栈信息
    if (options.originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.originalError.stack}`;
    }
  }

  /**
   * 根据错误类型获取默认的可重试状态
   */
  private getDefaultRetryable(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.TIMEOUT:
      case ErrorType.NETWORK:
      case ErrorType.RESOURCE_BUSY:
        return true;
      case ErrorType.VALIDATION:
      case ErrorType.PERMISSION:
      case ErrorType.NOT_FOUND:
      case ErrorType.ALREADY_EXISTS:
      case ErrorType.CONFLICT:
      case ErrorType.CANCELLED:
      case ErrorType.DEPENDENCY:
      case ErrorType.UNKNOWN:
        return false;
    }
  }

  /**
   * 根据错误类型获取默认的严重程度
   */
  private getDefaultSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.CONFLICT:
        return ErrorSeverity.CRITICAL;
      case ErrorType.PERMISSION:
      case ErrorType.DEPENDENCY:
        return ErrorSeverity.HIGH;
      case ErrorType.TIMEOUT:
      case ErrorType.NETWORK:
      case ErrorType.NOT_FOUND:
      case ErrorType.ALREADY_EXISTS:
        return ErrorSeverity.MEDIUM;
      case ErrorType.VALIDATION:
      case ErrorType.RESOURCE_BUSY:
      case ErrorType.CANCELLED:
      case ErrorType.UNKNOWN:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * 转换为用户友好的错误信息
   */
  toUserFriendly(): { title: string; message: string; suggestion?: string } {
    const titles: Record<ErrorType, string> = {
      [ErrorType.VALIDATION]: '参数错误',
      [ErrorType.PERMISSION]: '权限不足',
      [ErrorType.TIMEOUT]: '执行超时',
      [ErrorType.NETWORK]: '网络错误',
      [ErrorType.NOT_FOUND]: '未找到',
      [ErrorType.ALREADY_EXISTS]: '已存在',
      [ErrorType.CONFLICT]: '冲突',
      [ErrorType.RESOURCE_BUSY]: '资源被占用',
      [ErrorType.CANCELLED]: '已取消',
      [ErrorType.DEPENDENCY]: '依赖缺失',
      [ErrorType.UNKNOWN]: '未知错误',
    };

    return {
      title: titles[this.type],
      message: this.message,
      suggestion: this.suggestion,
    };
  }

  /**
   * 转换为 JSON 格式（用于日志和调试）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      severity: this.severity,
      suggestion: this.suggestion,
      context: this.context,
      originalMessage: this.originalError?.message,
      stack: this.stack,
    };
  }

  /**
   * 格式化为工具结果中的错误信息
   */
  toToolResultError(): string {
    let error = `[${this.type.toUpperCase()}] ${this.message}`;
    if (this.suggestion) {
      error += `\n建议: ${this.suggestion}`;
    }
    if (this.retryable) {
      error += '\n(此错误可能通过重试解决)';
    }
    return error;
  }
}

/**
 * 快捷创建各类型错误的工厂函数
 */
export const Errors = {
  validation(message: string, context?: Record<string, unknown>): ToolError {
    return new ToolError({
      type: ErrorType.VALIDATION,
      message,
      context,
      suggestion: '请检查输入参数是否正确',
    });
  },

  permission(message: string, path?: string): ToolError {
    return new ToolError({
      type: ErrorType.PERMISSION,
      message,
      context: path ? { path } : undefined,
      suggestion: '请检查文件/目录权限，或尝试使用其他方式访问',
    });
  },

  timeout(message: string, timeoutMs?: number): ToolError {
    return new ToolError({
      type: ErrorType.TIMEOUT,
      message,
      context: timeoutMs ? { timeoutMs } : undefined,
      suggestion: '尝试简化操作或增加超时时间',
      retryable: true,
    });
  },

  network(message: string, originalError?: Error): ToolError {
    return new ToolError({
      type: ErrorType.NETWORK,
      message,
      originalError,
      suggestion: '请检查网络连接',
      retryable: true,
    });
  },

  notFound(message: string, path?: string): ToolError {
    return new ToolError({
      type: ErrorType.NOT_FOUND,
      message,
      context: path ? { path } : undefined,
      suggestion: '请确认路径是否正确',
    });
  },

  alreadyExists(message: string, path?: string): ToolError {
    return new ToolError({
      type: ErrorType.ALREADY_EXISTS,
      message,
      context: path ? { path } : undefined,
      suggestion: '如需覆盖，请先删除现有文件',
    });
  },

  conflict(message: string, details?: { expected?: string; actual?: string; path?: string }): ToolError {
    return new ToolError({
      type: ErrorType.CONFLICT,
      message,
      context: details,
      severity: ErrorSeverity.CRITICAL,
      suggestion: '文件可能已被外部修改，请重新读取文件后再编辑',
    });
  },

  resourceBusy(message: string, resource?: string): ToolError {
    return new ToolError({
      type: ErrorType.RESOURCE_BUSY,
      message,
      context: resource ? { resource } : undefined,
      suggestion: '请稍后重试',
      retryable: true,
    });
  },

  cancelled(message: string = '操作已被用户取消'): ToolError {
    return new ToolError({
      type: ErrorType.CANCELLED,
      message,
    });
  },

  dependency(message: string, dependency?: string): ToolError {
    return new ToolError({
      type: ErrorType.DEPENDENCY,
      message,
      context: dependency ? { dependency } : undefined,
      suggestion: '请先安装所需依赖',
    });
  },

  unknown(message: string, originalError?: Error): ToolError {
    return new ToolError({
      type: ErrorType.UNKNOWN,
      message,
      originalError,
    });
  },

  /**
   * 从原生 Error 转换为 ToolError
   */
  fromError(error: Error, defaultType: ErrorType = ErrorType.UNKNOWN): ToolError {
    // 已经是 ToolError
    if (error instanceof ToolError) {
      return error;
    }

    const message = error.message.toLowerCase();

    // 尝试根据错误消息推断类型
    if (message.includes('enoent') || message.includes('not found') || message.includes('no such file')) {
      return Errors.notFound(error.message, undefined);
    }
    if (message.includes('eacces') || message.includes('permission denied') || message.includes('eperm')) {
      return Errors.permission(error.message);
    }
    if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
      return Errors.timeout(error.message);
    }
    if (message.includes('econnrefused') || message.includes('enotfound') || message.includes('network')) {
      return Errors.network(error.message, error);
    }
    if (message.includes('eexist') || message.includes('already exists')) {
      return Errors.alreadyExists(error.message);
    }
    if (message.includes('ebusy') || message.includes('resource busy')) {
      return Errors.resourceBusy(error.message);
    }
    if (message.includes('abort') || message.includes('cancel')) {
      return Errors.cancelled(error.message);
    }

    // 默认类型
    return new ToolError({
      type: defaultType,
      message: error.message,
      originalError: error,
    });
  },
};

/**
 * 用户拒绝操作的错误 - 用于中断流程
 * 这是一个特殊的错误类型，表示用户主动拒绝了操作
 */
export class UserRejectedError extends Error {
  readonly toolName: string;
  readonly reason: string;

  constructor(toolName: string, reason: string = '用户拒绝执行此操作') {
    super(reason);
    this.name = 'UserRejectedError';
    this.toolName = toolName;
    this.reason = reason;
  }
}

/**
 * 检查错误是否为用户拒绝错误
 */
export function isUserRejectedError(error: unknown): error is UserRejectedError {
  return error instanceof UserRejectedError;
}

/**
 * 检查错误是否为指定类型
 */
export function isToolError(error: unknown): error is ToolError {
  return error instanceof ToolError;
}

/**
 * 检查错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ToolError) {
    return error.retryable;
  }
  // 对于原生错误，根据消息推断
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('ebusy')
    );
  }
  return false;
}
