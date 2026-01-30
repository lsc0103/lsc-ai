/**
 * LSC-AI Workbench 模块导出
 *
 * 万能工作台 - 用户和 AI 共同协作的交互式工作空间
 */

// 注册所有组件（必须在最前面导入）
import './components';

// 加载演示/调试工具（开发环境）
import './demo';

// 主组件
export { Workbench } from './Workbench';
export { WorkbenchLayout } from './WorkbenchLayout';
export { WorkbenchTabs } from './WorkbenchTabs';

// Schema 相关
export * from './schema';

// 状态管理
export * from './context';

// Hooks
export * from './hooks';

// 服务
export * from './services';

// 组件注册表
export { ComponentRegistry } from './registry';
export type { WorkbenchComponentProps, ComponentMeta } from './registry';

// 错误边界
export { ComponentErrorBoundary, withErrorBoundary } from './components/ErrorBoundary';

// 演示工具
export { openDemoWorkbench, closeDemoWorkbench, toggleDemoWorkbench } from './demo';
