/**
 * 工具执行步骤组件
 * 类似 Claude 的可折叠步骤展示
 */
import { useState } from 'react';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  FileSearchOutlined,
  EditOutlined,
  FolderOutlined,
  ConsoleSqlOutlined,
  FileTextOutlined,
  SearchOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';
import type { ToolStep } from '../../stores/chat';

interface ToolStepsProps {
  steps: ToolStep[];
}

/**
 * 根据工具名称获取对应图标
 */
function getToolIcon(toolName: string) {
  const iconClass = 'text-sm';
  const name = toolName.toLowerCase();

  if (name.includes('read') || name.includes('file') || name.includes('view')) {
    return <FileTextOutlined className={iconClass} />;
  }
  if (name.includes('write') || name.includes('edit') || name.includes('create')) {
    return <EditOutlined className={iconClass} />;
  }
  if (name.includes('search') || name.includes('grep') || name.includes('find')) {
    return <SearchOutlined className={iconClass} />;
  }
  if (name.includes('glob') || name.includes('list') || name.includes('dir')) {
    return <FolderOutlined className={iconClass} />;
  }
  if (name.includes('bash') || name.includes('shell') || name.includes('exec') || name.includes('command')) {
    return <ConsoleSqlOutlined className={iconClass} />;
  }
  if (name.includes('analyze') || name.includes('inspect')) {
    return <FileSearchOutlined className={iconClass} />;
  }
  return <CodeOutlined className={iconClass} />;
}

/**
 * 获取状态图标
 */
function getStatusIcon(status: ToolStep['status']) {
  switch (status) {
    case 'running':
      return <LoadingOutlined className="text-brand-500" spin />;
    case 'completed':
      return <CheckCircleOutlined className="text-green-500" />;
    case 'failed':
      return <CloseCircleOutlined className="text-red-500" />;
    default:
      return null;
  }
}

/**
 * 格式化工具名称为用户友好的描述
 */
function formatToolName(name: string): string {
  // 常见工具名称映射
  const toolNameMap: Record<string, string> = {
    'Read': '读取文件',
    'Write': '写入文件',
    'Edit': '编辑文件',
    'Glob': '搜索文件',
    'Grep': '搜索内容',
    'Bash': '执行命令',
    'ListDir': '列出目录',
    'CreateDir': '创建目录',
    'DeleteFile': '删除文件',
    'MoveFile': '移动文件',
    'CopyFile': '复制文件',
    'WebSearch': '网络搜索',
    'WebFetch': '获取网页',
  };

  return toolNameMap[name] || name;
}

/**
 * 单个步骤项
 */
function StepItem({ step, isLast }: { step: ToolStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = step.arguments || step.result || step.error;

  return (
    <div className={clsx('relative', !isLast && 'pb-3')}>
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-cream-300" />
      )}

      <div className="flex items-start gap-3">
        {/* 工具图标 */}
        <div
          className={clsx(
            'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center',
            'bg-cream-100 text-accent-500',
          )}
        >
          {getToolIcon(step.name)}
        </div>

        {/* 步骤内容 */}
        <div className="flex-1 min-w-0">
          <div
            className={clsx(
              'flex items-center gap-2 cursor-pointer select-none',
              hasDetails && 'hover:text-brand-500',
            )}
            onClick={() => hasDetails && setExpanded(!expanded)}
          >
            {/* 展开/收起指示器 */}
            {hasDetails && (
              <span className="text-xs text-accent-400">
                {expanded ? <DownOutlined /> : <RightOutlined />}
              </span>
            )}

            {/* 工具描述 */}
            <span className="text-sm text-accent-600 truncate">
              {formatToolName(step.name)}
              {step.arguments?.file_path && (
                <span className="text-accent-400 ml-1">
                  {String(step.arguments.file_path).split(/[/\\]/).pop()}
                </span>
              )}
              {step.arguments?.pattern && (
                <span className="text-accent-400 ml-1">
                  "{String(step.arguments.pattern)}"
                </span>
              )}
              {step.arguments?.command && (
                <span className="text-accent-400 ml-1 font-mono text-xs">
                  {String(step.arguments.command).slice(0, 30)}
                  {String(step.arguments.command).length > 30 ? '...' : ''}
                </span>
              )}
            </span>

            {/* 状态图标 */}
            <span className="flex-shrink-0 ml-auto">
              {getStatusIcon(step.status)}
            </span>
          </div>

          {/* 展开的详情 */}
          {expanded && hasDetails && (
            <div className="mt-2 pl-4 text-xs text-accent-500 space-y-1">
              {step.arguments && (
                <div className="font-mono bg-cream-50 p-2 rounded overflow-x-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(step.arguments, null, 2)}
                  </pre>
                </div>
              )}
              {step.result && (
                <div className="bg-green-50 p-2 rounded">
                  <span className="text-green-600">结果: </span>
                  {step.result.slice(0, 200)}
                  {step.result.length > 200 ? '...' : ''}
                </div>
              )}
              {step.error && (
                <div className="bg-red-50 p-2 rounded text-red-600">
                  错误: {step.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 工具步骤组件
 */
export default function ToolSteps({ steps }: ToolStepsProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const runningCount = steps.filter((s) => s.status === 'running').length;

  return (
    <div className="mb-3 bg-cream-50 rounded-lg border border-cream-200 overflow-hidden">
      {/* 标题栏 */}
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2 cursor-pointer select-none',
          'hover:bg-cream-100 transition-colors',
        )}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs text-accent-400">
          {collapsed ? <RightOutlined /> : <DownOutlined />}
        </span>
        <span className="text-sm text-accent-600">
          {collapsed ? '显示步骤' : '隐藏步骤'}
        </span>
        <span className="text-xs text-accent-400 ml-auto">
          {runningCount > 0 ? (
            <>
              <LoadingOutlined spin className="mr-1" />
              {runningCount} 个执行中
            </>
          ) : (
            `${completedCount} 个步骤`
          )}
        </span>
      </div>

      {/* 步骤列表 */}
      {!collapsed && (
        <div className="px-3 pb-3 pt-1">
          {steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              isLast={index === steps.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
