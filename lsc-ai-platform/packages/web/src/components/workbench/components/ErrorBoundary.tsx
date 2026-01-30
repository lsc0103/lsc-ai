/**
 * Workbench 组件错误边界
 *
 * 防止单个组件错误导致整个 Workbench 崩溃
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  componentId?: string;
  componentType?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ComponentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 调用外部错误处理器
    this.props.onError?.(error, errorInfo);

    // 在开发环境下打印详细错误
    if (process.env.NODE_ENV === 'development') {
      console.error('[Workbench Component Error]', {
        componentId: this.props.componentId,
        componentType: this.props.componentType,
        error,
        errorInfo,
      });
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误显示
      return (
        <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--glass-bg-light)]">
          <Alert
            type="error"
            showIcon
            message={`组件渲染错误${this.props.componentType ? ` (${this.props.componentType})` : ''}`}
            description={
              <div className="mt-2">
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  {this.state.error?.message || '未知错误'}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="text-xs text-[var(--text-tertiary)]">
                    <summary className="cursor-pointer mb-1">查看详细信息</summary>
                    <pre className="overflow-auto max-h-32 p-2 bg-[var(--glass-bg-medium)] rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={this.handleRetry}
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 高阶组件：为任意组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentType?: string
): React.FC<P & { componentId?: string }> {
  const WithErrorBoundary: React.FC<P & { componentId?: string }> = (props) => {
    return (
      <ComponentErrorBoundary
        componentId={props.componentId}
        componentType={componentType}
      >
        <WrappedComponent {...props} />
      </ComponentErrorBoundary>
    );
  };

  WithErrorBoundary.displayName = `WithErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithErrorBoundary;
}
