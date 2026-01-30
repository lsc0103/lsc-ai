/**
 * Workbench FileBrowser 文件浏览器组件
 *
 * 显示目录结构，支持：
 * - 展开/折叠目录
 * - 点击文件打开预览
 * - 文件类型图标
 */

import React, { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePptOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RightOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Button, Empty, Tooltip, Input } from 'antd';

import type { FileBrowserSchema, FileTreeNode, FileType, ComponentType, ComponentSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import {
  useFileList,
  detectFileType,
  getFilename,
} from '../../services/FileService';
import { useWorkbenchStore } from '../../context';

// ============================================================================
// 类型定义
// ============================================================================

/** 文件类型图标映射 */
const getFileIcon = (node: FileTreeNode): React.ReactNode => {
  if (node.isDirectory) {
    return null; // 目录图标在渲染时动态决定
  }

  const fileType = detectFileType(node.path);
  const iconMap: Record<FileType, React.ReactNode> = {
    code: <FileTextOutlined className="text-blue-400" />,
    text: <FileTextOutlined className="text-gray-400" />,
    markdown: <FileTextOutlined className="text-purple-400" />,
    image: <FileImageOutlined className="text-green-400" />,
    pdf: <FilePdfOutlined className="text-red-400" />,
    word: <FileWordOutlined className="text-blue-500" />,
    excel: <FileExcelOutlined className="text-green-500" />,
    ppt: <FilePptOutlined className="text-orange-400" />,
    video: <FileOutlined className="text-pink-400" />,
    audio: <FileOutlined className="text-yellow-400" />,
    unknown: <FileOutlined className="text-gray-400" />,
  };

  return iconMap[fileType] || <FileOutlined className="text-gray-400" />;
};

// ============================================================================
// 子组件：文件树节点
// ============================================================================

interface FileTreeNodeItemProps {
  node: FileTreeNode;
  depth: number;
  expandedKeys: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (node: FileTreeNode) => void;
  selectedPath?: string;
  showSize?: boolean;
  showModifiedTime?: boolean;
}

const FileTreeNodeItem: React.FC<FileTreeNodeItemProps> = ({
  node,
  depth,
  expandedKeys,
  onToggle,
  onSelect,
  selectedPath,
  showSize,
  showModifiedTime,
}) => {
  const isExpanded = expandedKeys.has(node.path);
  const isSelected = selectedPath === node.path;
  const paddingLeft = depth * 16 + 8;

  const handleClick = () => {
    if (node.isDirectory) {
      onToggle(node.path);
    } else {
      onSelect(node);
    }
  };

  const formatSize = (bytes?: number): string => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div
        className={clsx(
          'flex items-center gap-2 py-1.5 px-2 cursor-pointer',
          'hover:bg-[var(--glass-bg-hover)]',
          'transition-colors duration-100',
          isSelected && 'bg-[var(--glass-bg-hover)]'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
      >
        {/* 展开/折叠图标（仅目录） */}
        <span className="w-4 flex-shrink-0">
          {node.isDirectory && (
            isExpanded ? (
              <DownOutlined className="text-[10px] text-[var(--text-tertiary)]" />
            ) : (
              <RightOutlined className="text-[10px] text-[var(--text-tertiary)]" />
            )
          )}
        </span>

        {/* 文件/目录图标 */}
        <span className="flex-shrink-0 text-sm">
          {node.isDirectory ? (
            isExpanded ? (
              <FolderOpenOutlined className="text-yellow-400" />
            ) : (
              <FolderOutlined className="text-yellow-400" />
            )
          ) : (
            getFileIcon(node)
          )}
        </span>

        {/* 文件名 */}
        <span
          className={clsx(
            'flex-1 text-sm truncate',
            isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
          )}
        >
          {node.name}
        </span>

        {/* 文件大小 */}
        {showSize && !node.isDirectory && node.size !== undefined && (
          <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </div>

      {/* 子节点 */}
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedPath={selectedPath}
              showSize={showSize}
              showModifiedTime={showModifiedTime}
            />
          ))}
        </div>
      )}
    </>
  );
};

// ============================================================================
// 主组件
// ============================================================================

export const FileBrowser: React.FC<WorkbenchComponentProps<FileBrowserSchema>> = ({
  schema,
}) => {
  const {
    rootPath,
    patterns,
    // excludePatterns, // TODO: 实现排除模式
    // showHidden = false, // TODO: 实现隐藏文件显示
    showSize = false,
    showModifiedTime = false,
    height, // 不设默认值，让组件自动填满
    onSelectAction,
    style,
    className,
  } = schema;

  const { handleAction, addTab } = useWorkbenchStore();

  // 状态
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string>();
  const [searchText, setSearchText] = useState('');

  // 加载文件列表
  const { files, loading, error, reload } = useFileList(rootPath, patterns);

  // 过滤文件（搜索）
  const filteredFiles = useMemo(() => {
    if (!searchText) return files;

    const filterNode = (node: FileTreeNode): FileTreeNode | null => {
      const nameMatch = node.name.toLowerCase().includes(searchText.toLowerCase());

      if (node.isDirectory && node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter(Boolean) as FileTreeNode[];

        if (filteredChildren.length > 0 || nameMatch) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }

      return nameMatch ? node : null;
    };

    return files.map(filterNode).filter(Boolean) as FileTreeNode[];
  }, [files, searchText]);

  // 切换展开状态
  const handleToggle = useCallback((path: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // 选择文件
  const handleSelect = useCallback((node: FileTreeNode) => {
    if (node.isDirectory) return;

    setSelectedPath(node.path);

    // 触发自定义动作
    if (onSelectAction) {
      handleAction(onSelectAction, { filePath: node.path, filename: node.name });
      return;
    }

    // 根据文件类型选择组件
    const fileType = detectFileType(node.path);
    let componentType = 'FileViewer';

    // Office 文件使用专用预览组件
    if (fileType === 'word') {
      componentType = 'WordPreview';
    } else if (fileType === 'excel') {
      componentType = 'ExcelPreview';
    } else if (fileType === 'ppt') {
      componentType = 'PPTPreview';
    } else if (fileType === 'pdf') {
      componentType = 'PDFPreview';
    } else if (fileType === 'image') {
      componentType = 'ImagePreview';
    } else if (fileType === 'video') {
      componentType = 'VideoPreview';
    } else if (fileType === 'audio') {
      componentType = 'AudioPreview';
    }

    // 默认行为：在新标签页打开
    addTab({
      key: `file-${Date.now()}`,
      title: node.name,
      components: [
        {
          type: componentType as ComponentType,
          filePath: node.path,
        } as ComponentSchema,
      ],
    });
  }, [onSelectAction, handleAction, addTab]);

  // 计算高度 - 如果未指定则使用 flex 填满
  const hasFixedHeight = height !== undefined;
  const contentHeight = hasFixedHeight
    ? (typeof height === 'number' ? height : parseInt(height as string, 10) || 400)
    : 0;
  const headerHeight = 80; // 标题栏 + 搜索栏
  const innerHeight = hasFixedHeight ? contentHeight - headerHeight : 0;

  return (
    <div
      className={clsx(
        'workbench-file-browser',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-medium)]',
        'flex flex-col',
        !hasFixedHeight && 'h-full',
        className
      )}
      style={{ ...style, ...(hasFixedHeight ? { height } : {}) }}
    >
      {/* 顶部标题栏 */}
      <div
        className={clsx(
          'flex items-center justify-between',
          'h-10 px-3',
          'border-b border-[var(--border-light)]',
          'bg-[var(--glass-bg-subtle)]'
        )}
      >
        {/* 左侧：标题 */}
        <div className="flex items-center gap-2">
          <FolderOutlined className="text-[var(--text-tertiary)]" />
          <Tooltip title={rootPath}>
            <span className="text-sm text-[var(--text-primary)] truncate max-w-xs">
              {rootPath ? getFilename(rootPath) : '文件浏览器'}
            </span>
          </Tooltip>
        </div>

        {/* 右侧：刷新按钮 */}
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={reload}
          loading={loading}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        />
      </div>

      {/* 搜索栏 */}
      <div className="px-2 py-2 border-b border-[var(--border-light)]">
        <Input
          placeholder="搜索文件..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          size="small"
          className="bg-[var(--glass-bg-light)]"
        />
      </div>

      {/* 文件列表 */}
      <div
        className={clsx('overflow-auto', !hasFixedHeight && 'flex-1 min-h-0')}
        style={hasFixedHeight ? { height: `${innerHeight}px` } : undefined}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingOutlined className="mr-2 text-lg" />
            <span className="text-[var(--text-tertiary)]">正在加载...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <ExclamationCircleOutlined className="text-3xl text-[var(--accent-error)] mb-2" />
            <div className="text-[var(--text-secondary)] mb-2">{error}</div>
            <Button size="small" icon={<ReloadOutlined />} onClick={reload}>
              重试
            </Button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Empty
              description={
                searchText
                  ? '未找到匹配的文件'
                  : rootPath
                    ? '目录为空'
                    : '请指定根目录'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <div className="py-1">
            {filteredFiles.map((node) => (
              <FileTreeNodeItem
                key={node.path}
                node={node}
                depth={0}
                expandedKeys={expandedKeys}
                onToggle={handleToggle}
                onSelect={handleSelect}
                selectedPath={selectedPath}
                showSize={showSize}
                showModifiedTime={showModifiedTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

FileBrowser.displayName = 'WorkbenchFileBrowser';
