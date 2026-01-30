/**
 * Workbench Schema 代码块组件
 *
 * 检测 AI 输出的 workbench-schema 代码块，
 * 自动解析并打开 Workbench 渲染。
 */

import { useEffect, useState, useRef } from 'react';
import { AppstoreOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import clsx from 'clsx';
import { useWorkbenchStore, parseWorkbenchSchemaFromCodeBlock } from '../workbench';

interface WorkbenchSchemaBlockProps {
  code: string;
}

type ParseStatus = 'idle' | 'success' | 'error';

export default function WorkbenchSchemaBlock({ code }: WorkbenchSchemaBlockProps) {
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [schemaTitle, setSchemaTitle] = useState<string>('');
  const successRef = useRef(false);  // 只有成功后才停止重试

  const mergeSchema = useWorkbenchStore((state) => state.mergeSchema);
  const open = useWorkbenchStore((state) => state.open);
  const visible = useWorkbenchStore((state) => state.visible);

  useEffect(() => {
    // 已经成功解析过，不再重试
    if (successRef.current) return;

    // 检查 JSON 是否可能完整（简单判断：以 } 结尾且包含 "type"）
    const trimmedCode = code.trim();
    if (!trimmedCode.endsWith('}') || !trimmedCode.includes('"type"')) {
      // JSON 还不完整，显示加载状态
      setStatus('idle');
      return;
    }

    try {
      const schema = parseWorkbenchSchemaFromCodeBlock(code);

      if (schema) {
        successRef.current = true;  // 标记成功，不再重试
        setStatus('success');
        setSchemaTitle(schema.title || `${schema.tabs.length} 个标签页`);
        // 使用 mergeSchema 将新内容合并到现有 Workbench（而不是替换）
        mergeSchema(schema);
      } else {
        // JSON 完整但格式不对，显示错误
        setStatus('error');
        setErrorMessage('Schema 格式无效');
      }
    } catch (e) {
      // 解析失败，可能是 JSON 还不完整，保持 idle 状态等待更多内容
      if (!trimmedCode.endsWith('}')) {
        setStatus('idle');
      } else {
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'JSON 解析失败');
      }
    }
  // 注意：不要将 mergeSchema 加入依赖项，它是稳定的 store 函数
  // 加入依赖项会导致每次 zustand 状态变化时都重新执行 useEffect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleClick = () => {
    // 点击时用 open 完全替换（用户主动点击时可能希望重新打开）
    try {
      const schema = parseWorkbenchSchemaFromCodeBlock(code);
      if (schema) {
        open(schema);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={clsx(
        'workbench-schema-block',
        'my-2 px-4 py-3 rounded-lg',
        'border cursor-pointer transition-all duration-200',
        status === 'success' && [
          'bg-[var(--accent-success)]/10',
          'border-[var(--accent-success)]/30',
          'hover:bg-[var(--accent-success)]/15',
        ],
        status === 'error' && [
          'bg-[var(--accent-error)]/10',
          'border-[var(--accent-error)]/30',
        ],
        status === 'idle' && [
          'bg-[var(--glass-bg-light)]',
          'border-[var(--border-light)]',
        ],
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            status === 'success' && 'bg-[var(--accent-success)]/20 text-[var(--accent-success)]',
            status === 'error' && 'bg-[var(--accent-error)]/20 text-[var(--accent-error)]',
            status === 'idle' && 'bg-[var(--glass-bg-medium)] text-[var(--text-secondary)]',
          )}
        >
          {status === 'success' && <CheckCircleOutlined />}
          {status === 'error' && <WarningOutlined />}
          {status === 'idle' && <AppstoreOutlined />}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Workbench
            </span>
            {status === 'success' && visible && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-success)]/20 text-[var(--accent-success)]">
                已打开
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
            {status === 'success' && schemaTitle}
            {status === 'error' && errorMessage}
            {status === 'idle' && '正在解析...'}
          </p>
        </div>

        {/* 提示 */}
        {status === 'success' && !visible && (
          <span className="text-xs text-[var(--text-tertiary)]">
            点击打开
          </span>
        )}
      </div>
    </div>
  );
}
