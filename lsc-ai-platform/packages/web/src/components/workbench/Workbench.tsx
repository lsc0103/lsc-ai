/**
 * LSC-AI Workbench 主容器组件
 *
 * 万能工作台的核心容器
 * - 玻璃拟态风格
 * - 多标签页管理
 * - Schema 驱动渲染
 * - 拖放文件支持
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  CloseOutlined,
  UndoOutlined,
  RedoOutlined,
  AppstoreOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { Tooltip, Button, Empty, message } from 'antd';
import { useWorkbenchStore, useWorkbenchSchema, useActiveTab } from './context';
import { TabContentRenderer } from './schema/renderer';
import { WorkbenchTabs } from './WorkbenchTabs';
import { useKeyboardShortcuts } from './hooks';
import { TerminalPanel } from './components/Terminal';
import { useTerminalStore } from './context/TerminalStore';
import { registerCommandListener, unregisterCommandListener } from '../../services/socket';

// ============================================================================
// 类型定义
// ============================================================================

interface WorkbenchProps {
  /** 自定义类名 */
  className?: string;
}

// ============================================================================
// 空状态组件
// ============================================================================

const EmptyState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8">
    <div
      className={clsx(
        'w-20 h-20 rounded-2xl flex items-center justify-center mb-4',
        'bg-[var(--glass-bg-medium)]',
        'border border-[var(--border-light)]'
      )}
    >
      <AppstoreOutlined className="text-3xl text-[var(--text-tertiary)]" />
    </div>
    <Empty
      description={
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-1">工作台已准备就绪</p>
          <p className="text-xs text-[var(--text-tertiary)]">
            与 AI 对话时，生成的内容将显示在这里
          </p>
        </div>
      }
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    />
  </div>
);

// ============================================================================
// 主组件
// ============================================================================

export const Workbench: React.FC<WorkbenchProps> = ({ className }) => {
  const schema = useWorkbenchSchema();
  const activeTab = useActiveTab();
  const {
    visible,
    close,
    canUndo,
    canRedo,
    undo,
    redo,
    openFile,
  } = useWorkbenchStore();

  // 启用键盘快捷键（仅在可见时）
  useKeyboardShortcuts({ enabled: visible });

  // 注册命令执行监听器
  useEffect(() => {
    if (!visible) return;

    const { appendOutput, updateStatus } = useTerminalStore.getState();

    registerCommandListener({
      onOutput: (taskId, output) => {
        appendOutput(taskId, output);
      },
      onComplete: (taskId, result) => {
        // 追加最终结果（如果有）
        if (result && result !== '命令执行完成') {
          appendOutput(taskId, '\n' + result);
        }
        updateStatus(taskId, 'success');
      },
      onError: (taskId, error) => {
        updateStatus(taskId, 'error', error);
      },
    });

    return () => {
      unregisterCommandListener();
    };
  }, [visible]);

  // 拖放状态
  const [isDragOver, setIsDragOver] = useState(false);

  // 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了容器
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // 检查是否有文件路径（从本地文件管理器拖入）
    const files = e.dataTransfer.files;
    const text = e.dataTransfer.getData('text/plain');

    if (files.length > 0) {
      // 从文件管理器拖入的文件
      // 使用 FileReader 读取内容并显示（临时预览，不依赖 Client Agent）
      const file = files[0];
      const fileName = file.name;
      const fileType = file.type;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // 检查是否是支持预览的文件类型
      const isImage = fileType.startsWith('image/');
      const isPdf = fileType === 'application/pdf' || ext === 'pdf';
      const isVideo = fileType.startsWith('video/') ||
        ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'].includes(ext);
      const isAudio = fileType.startsWith('audio/') ||
        ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext);
      const isText = fileType.startsWith('text/') ||
        ['js', 'ts', 'tsx', 'jsx', 'json', 'md', 'css', 'html', 'xml', 'yaml', 'yml',
         'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'sh', 'bat', 'sql', 'txt'].includes(ext);
      const isWord = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword' || ['doc', 'docx'].includes(ext);
      const isExcel = fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileType === 'application/vnd.ms-excel' || ['xls', 'xlsx'].includes(ext);
      const isPPT = fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        fileType === 'application/vnd.ms-powerpoint' || ['ppt', 'pptx'].includes(ext);

      if (isImage) {
        // 图片：转为 base64 显示
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const { addTab, schema, visible } = useWorkbenchStore.getState();
          const tabKey = `temp-${Date.now()}`;

          const newTab = {
            key: tabKey,
            title: `[临时] ${fileName}`,
            components: [{
              type: 'ImagePreview' as const,
              src: base64,
              alt: fileName,
              height: 'auto',
            }],
          };

          if (schema && visible) {
            addTab(newTab);
          } else {
            useWorkbenchStore.getState().open({
              type: 'workbench',
              title: '工作台',
              tabs: [newTab],
            });
          }
          message.success(`已打开临时预览: ${fileName}`);
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        // 文本文件：读取内容显示
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const { addTab, schema, visible } = useWorkbenchStore.getState();
          const tabKey = `temp-${Date.now()}`;

          // 检测语言
          const languageMap: Record<string, string> = {
            'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
            'py': 'python', 'java': 'java', 'go': 'go', 'rs': 'rust', 'c': 'c', 'cpp': 'cpp',
            'h': 'c', 'json': 'json', 'html': 'html', 'css': 'css', 'sql': 'sql',
            'sh': 'shell', 'bat': 'shell', 'md': 'markdown', 'yml': 'yaml', 'yaml': 'yaml',
          };

          const newTab = {
            key: tabKey,
            title: `[临时] ${fileName}`,
            components: [{
              type: 'CodeEditor' as const,
              code: content,
              language: languageMap[ext] || 'plaintext',
              readOnly: true,
              height: 'auto' as const,
            }],
          };

          if (schema && visible) {
            addTab(newTab);
          } else {
            useWorkbenchStore.getState().open({
              type: 'workbench',
              title: '工作台',
              tabs: [newTab],
            });
          }
          message.success(`已打开临时预览: ${fileName}`);
        };
        reader.readAsText(file);
      } else if (isPdf || isVideo || isAudio) {
        // PDF、视频、音频：转为 blob URL 显示
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const { addTab, schema, visible } = useWorkbenchStore.getState();
          const tabKey = `temp-${Date.now()}`;

          // 根据类型选择组件
          let componentType: 'PdfPreview' | 'VideoPreview' | 'AudioPreview';
          if (isPdf) {
            componentType = 'PdfPreview';
          } else if (isVideo) {
            componentType = 'VideoPreview';
          } else {
            componentType = 'AudioPreview';
          }

          const newTab = {
            key: tabKey,
            title: `[临时] ${fileName}`,
            components: [{
              type: componentType,
              src: base64,
              filename: fileName,
              height: 'auto',
            }],
          };

          if (schema && visible) {
            addTab(newTab);
          } else {
            useWorkbenchStore.getState().open({
              type: 'workbench',
              title: '工作台',
              tabs: [newTab],
            });
          }
          message.success(`已打开临时预览: ${fileName}`);
        };
        reader.readAsDataURL(file);
      } else if (isWord || isExcel || isPPT) {
        // Office 文件：读取为 ArrayBuffer
        const reader = new FileReader();
        reader.onload = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const { addTab, schema, visible } = useWorkbenchStore.getState();
          const tabKey = `temp-${Date.now()}`;

          // 根据类型选择组件
          let componentType: 'WordPreview' | 'ExcelPreview' | 'PPTPreview';
          if (isWord) {
            componentType = 'WordPreview';
          } else if (isExcel) {
            componentType = 'ExcelPreview';
          } else {
            componentType = 'PPTPreview';
          }

          // 将 ArrayBuffer 转换为 base64 以传递给组件
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);

          const newTab = {
            key: tabKey,
            title: `[临时] ${fileName}`,
            components: [{
              type: componentType,
              fileData: base64,
              filename: fileName,
              title: fileName,
              height: 'auto',
            }],
          };

          if (schema && visible) {
            addTab(newTab);
          } else {
            useWorkbenchStore.getState().open({
              type: 'workbench',
              title: '工作台',
              tabs: [newTab],
            });
          }
          message.success(`已打开临时预览: ${fileName}`);
        };
        reader.readAsArrayBuffer(file);
      } else {
        // 不支持的文件类型
        message.warning(`不支持预览此文件类型: ${fileType || ext}`);
      }
      return;
    }

    if (text) {
      // 可能是文件路径（从其他地方拖入）
      // 检查是否像是文件路径
      const pathLike = /^[a-zA-Z]:[/\\]|^\//.test(text);
      if (pathLike) {
        openFile(text.trim());
        message.success('已打开文件');
      }
    }
  }, [openFile]);

  // 不可见时不渲染
  if (!visible) {
    return null;
  }

  return (
    <motion.div
      data-testid="workbench-container"
      className={clsx(
        'workbench-container',
        'h-full flex flex-col relative',
        'glass-thick rounded-none',
        'border-l border-[var(--border-light)]',
        className
      )}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖放提示遮罩 */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            className={clsx(
              'absolute inset-0 z-50',
              'flex flex-col items-center justify-center',
              'bg-[var(--accent-primary)]/10',
              'border-2 border-dashed border-[var(--accent-primary)]',
              'pointer-events-none'
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <InboxOutlined className="text-5xl text-[var(--accent-primary)] mb-4" />
            <div className="text-lg text-[var(--accent-primary)]">
              拖放文件到这里
            </div>
            <div className="text-sm text-[var(--text-tertiary)] mt-1">
              支持代码、文档、图片等文件
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 顶部标题栏 */}
      <div
        data-testid="workbench-header"
        className={clsx(
          'workbench-header',
          'flex items-center justify-between',
          'h-12 px-4',
          'border-b border-[var(--border-light)]',
          'bg-[var(--glass-bg-subtle)]'
        )}
      >
        {/* 左侧标题 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {schema?.title || 'Workbench'}
          </span>
        </div>

        {/* 右侧工具栏 */}
        <div className="flex items-center gap-1">
          {/* 撤销/重做 - 仅在有内容时显示 */}
          {schema && (
            <>
              <Tooltip title="撤销">
                <Button
                  type="text"
                  size="small"
                  icon={<UndoOutlined />}
                  disabled={!canUndo()}
                  onClick={undo}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                />
              </Tooltip>
              <Tooltip title="重做">
                <Button
                  type="text"
                  size="small"
                  icon={<RedoOutlined />}
                  disabled={!canRedo()}
                  onClick={redo}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                />
              </Tooltip>
              <div className="w-px h-4 bg-[var(--border-light)] mx-1" />
            </>
          )}

          {/* 关闭按钮 */}
          <Tooltip title="关闭">
            <Button
              data-testid="workbench-close-btn"
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={close}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            />
          </Tooltip>
        </div>
      </div>

      {/* 有内容时显示标签页和内容，否则显示空状态 */}
      {schema ? (
        <>
          {/* 标签页 */}
          <WorkbenchTabs />

          {/* 内容区域 */}
          <div data-testid="workbench-content" className="workbench-content flex-1 min-h-0 overflow-auto p-4 flex flex-col">
            <AnimatePresence mode="wait">
              {activeTab && (
                <motion.div
                  key={activeTab.key}
                  className="flex-1 min-h-0 flex flex-col"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <TabContentRenderer tab={activeTab} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <EmptyState />
      )}

      {/* 终端输出面板 */}
      <TerminalPanel />
    </motion.div>
  );
};

Workbench.displayName = 'Workbench';

export default Workbench;
