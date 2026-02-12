/**
 * Workbench SQLEditor SQL编辑器组件
 *
 * 用于数据分析场景
 * - SQL 语法高亮
 * - 执行查询按钮
 * - 结果展示
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { Button, Table, Tabs, Empty, Skeleton } from 'antd';
import {
  PlayCircleOutlined,
  LoadingOutlined,
  CopyOutlined,
  CheckOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import clsx from 'clsx';
import type { SQLEditorSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { useActionContext } from '../../context';

// Monaco editor type
type IStandaloneCodeEditor = Parameters<OnMount>[0];

// SQL 方言到 Monaco 语言的映射
const dialectToLanguage: Record<string, string> = {
  mysql: 'mysql',
  postgresql: 'pgsql',
  sqlite: 'sql',
  mssql: 'sql',
};

export const SQLEditor: React.FC<WorkbenchComponentProps<SQLEditorSchema>> = ({
  schema,
}) => {
  const {
    id = 'sqlEditor',
    sql = '',
    dialect = 'mysql',
    height = 400,
    readOnly = false,
    onExecuteAction,
    result,
    style,
    className,
  } = schema;

  const { executeAction } = useActionContext(id, 'SQLEditor');
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const [currentSql, setCurrentSql] = useState(sql);
  const [copied, setCopied] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'result'>('editor');

  // 更新 SQL
  useEffect(() => {
    setCurrentSql(sql);
  }, [sql]);

  // 编辑器挂载
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // P2-19: 设置 data-monaco-loaded 属性，供 Playwright 测试检测
    if (containerRef.current) {
      containerRef.current.setAttribute('data-monaco-loaded', 'true');
    }

    // 自定义深色主题
    monaco.editor.defineTheme('sql-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'FF7B72', fontStyle: 'bold' },
        { token: 'string', foreground: 'A5D6FF' },
        { token: 'number', foreground: '79C0FF' },
        { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
        { token: 'operator', foreground: 'FFA657' },
        { token: 'identifier', foreground: 'E6EDF3' },
      ],
      colors: {
        'editor.background': '#0d1b2a00',
        'editor.foreground': '#E6EDF3',
        'editor.lineHighlightBackground': '#1e3a5f40',
        'editor.selectionBackground': '#264F7840',
        'editorLineNumber.foreground': '#6E7681',
        'editorLineNumber.activeForeground': '#E6EDF3',
        'editorCursor.foreground': '#58A6FF',
      },
    });

    monaco.editor.setTheme('sql-dark');

    // 快捷键：Ctrl+Enter 执行
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        handleExecute();
      }
    );

    editor.layout();
  }, []);

  // 内容变化
  const handleChange: OnChange = useCallback((value) => {
    setCurrentSql(value || '');
  }, []);

  // 执行 SQL
  const handleExecute = useCallback(async () => {
    if (!currentSql.trim()) {
      message.warning('请输入 SQL 语句');
      return;
    }

    if (onExecuteAction) {
      setExecuting(true);
      try {
        await executeAction(onExecuteAction, { sql: currentSql });
        setActiveTab('result');
      } catch (error) {
        message.error('执行失败');
      } finally {
        setExecuting(false);
      }
    } else {
      message.info('未配置执行动作');
    }
  }, [currentSql, onExecuteAction, executeAction]);

  // 复制代码
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentSql);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败');
    }
  }, [currentSql]);

  // 表格列定义
  const tableColumns = result?.columns.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
  })) || [];

  // 计算高度分配
  const totalHeight = typeof height === 'number' ? height : 400;
  const editorHeight = result ? Math.floor(totalHeight * 0.5) : totalHeight - 48;
  const resultHeight = result ? Math.floor(totalHeight * 0.5) - 48 : 0;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'workbench-sql-editor',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-medium)]',
        className
      )}
      style={{
        ...style,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      {/* 顶部工具栏 */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'h-12 px-3',
          'border-b border-[var(--border-light)]',
          'bg-[var(--glass-bg-subtle)]'
        )}
      >
        {/* 左侧：数据库类型 */}
        <div className="flex items-center gap-2">
          <DatabaseOutlined className="text-[var(--accent-primary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {dialect.toUpperCase()}
          </span>
        </div>

        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded',
              'text-xs text-[var(--text-secondary)]',
              'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
              'transition-colors duration-150'
            )}
          >
            {copied ? (
              <>
                <CheckOutlined style={{ fontSize: 12 }} />
                <span>已复制</span>
              </>
            ) : (
              <>
                <CopyOutlined style={{ fontSize: 12 }} />
                <span>复制</span>
              </>
            )}
          </button>

          <Button
            type="primary"
            size="small"
            icon={executing ? <LoadingOutlined /> : <PlayCircleOutlined />}
            onClick={handleExecute}
            disabled={executing || readOnly}
            className="flex items-center gap-1"
          >
            {executing ? '执行中' : '执行'}
          </Button>
        </div>
      </div>

      {/* 标签页（当有结果时显示） */}
      {result ? (
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'editor' | 'result')}
          size="small"
          className="workbench-sql-tabs px-2"
          items={[
            {
              key: 'editor',
              label: 'SQL',
              children: (
                <div style={{ height: editorHeight }}>
                  <Editor
                    height="100%"
                    value={currentSql}
                    language={dialectToLanguage[dialect] || 'sql'}
                    theme="sql-dark"
                    onMount={handleEditorMount}
                    onChange={handleChange}
                    loading={
                      <div className="p-4">
                        <Skeleton active paragraph={{ rows: 6 }} title={false} />
                      </div>
                    }
                    options={{
                      readOnly,
                      lineNumbers: 'on',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                      tabSize: 2,
                      wordWrap: 'on',
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'result',
              label: `结果 (${result.rows.length} 行)`,
              children: (
                <div
                  style={{ height: resultHeight }}
                  className="overflow-auto"
                >
                  {result.rows.length > 0 ? (
                    <Table
                      columns={tableColumns}
                      dataSource={result.rows.map((row, idx) => ({
                        ...row,
                        key: idx,
                      }))}
                      size="small"
                      pagination={{
                        pageSize: 50,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 行`,
                      }}
                      scroll={{ x: 'max-content' }}
                    />
                  ) : (
                    <Empty
                      description="查询无结果"
                      className="py-8"
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      ) : (
        // 没有结果时，只显示编辑器
        <div style={{ height: totalHeight - 48 }}>
          <Editor
            height="100%"
            value={currentSql}
            language={dialectToLanguage[dialect] || 'sql'}
            theme="sql-dark"
            onMount={handleEditorMount}
            onChange={handleChange}
            loading={
              <div className="p-4">
                <Skeleton active paragraph={{ rows: 6 }} title={false} />
              </div>
            }
            options={{
              readOnly,
              lineNumbers: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              tabSize: 2,
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      )}
    </div>
  );
};

SQLEditor.displayName = 'WorkbenchSQLEditor';
