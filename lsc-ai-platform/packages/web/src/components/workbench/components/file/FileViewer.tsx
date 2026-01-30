/**
 * Workbench FileViewer 文件查看器组件
 *
 * 通过 filePath 加载文件内容，自动选择合适的预览器
 * - 代码文件 → Monaco Editor
 * - Markdown → Markdown 渲染
 * - 图片 → 图片预览
 * - 其他 → 显示文件信息
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  LoadingOutlined,
  FileOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePptOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, message } from 'antd';
import Editor from '@monaco-editor/react';

import type { FileViewerSchema, FileType } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import {
  useFileContent,
  detectFileType,
  detectLanguage,
  getFilename,
  FileService,
} from '../../services/FileService';

// ============================================================================
// 类型定义
// ============================================================================

/** 文件类型图标映射 */
const fileTypeIcons: Record<FileType, React.ReactNode> = {
  code: <FileTextOutlined />,
  text: <FileTextOutlined />,
  markdown: <FileTextOutlined />,
  image: <FileImageOutlined />,
  pdf: <FilePdfOutlined />,
  word: <FileWordOutlined />,
  excel: <FileExcelOutlined />,
  ppt: <FilePptOutlined />,
  video: <FileOutlined />,
  audio: <FileOutlined />,
  unknown: <FileOutlined />,
};

// ============================================================================
// 子组件：代码预览
// ============================================================================

interface CodePreviewProps {
  code: string;
  language: string;
  height: number | string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

const CodePreview: React.FC<CodePreviewProps> = ({
  code,
  language,
  height,
  readOnly = true,
  onChange,
}) => {
  return (
    <Editor
      value={code}
      language={language}
      theme="vs-dark"
      height={height}
      onChange={(value) => onChange?.(value || '')}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontLigatures: true,
        tabSize: 2,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        lineHeight: 20,
        renderLineHighlight: 'line',
        contextmenu: true,
        folding: true,
        showFoldingControls: 'mouseover',
        bracketPairColorization: { enabled: true },
      }}
      loading={
        <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
          <LoadingOutlined className="mr-2" />
          <span>加载编辑器...</span>
        </div>
      }
    />
  );
};

// ============================================================================
// 子组件：Markdown 预览
// ============================================================================

interface MarkdownPreviewProps {
  content: string;
  height: number | string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, height }) => {
  // 使用简单的 Markdown 渲染（后续可以用 react-markdown 等库增强）
  return (
    <div
      className="prose prose-invert max-w-none p-4 overflow-auto"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <pre className="whitespace-pre-wrap text-sm">{content}</pre>
    </div>
  );
};

// ============================================================================
// 子组件：图片预览
// ============================================================================

interface ImagePreviewProps {
  src: string;
  alt?: string;
  height: number | string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, alt, height }) => {
  return (
    <div
      className="flex items-center justify-center p-4 overflow-auto"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <img
        src={src}
        alt={alt || '图片预览'}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};

// ============================================================================
// 子组件：PDF 预览
// ============================================================================

interface PdfPreviewProps {
  src: string;
  height: number | string;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ src, height }) => {
  return (
    <div
      className="w-full"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <iframe
        src={src}
        className="w-full h-full border-0"
        title="PDF 预览"
      />
    </div>
  );
};

// ============================================================================
// 子组件：视频预览
// ============================================================================

interface VideoPreviewProps {
  src: string;
  height: number | string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ src, height }) => {
  return (
    <div
      className="flex items-center justify-center bg-black"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <video
        src={src}
        controls
        className="max-w-full max-h-full"
        style={{ maxHeight: typeof height === 'number' ? `${height}px` : height }}
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
};

// ============================================================================
// 子组件：音频预览
// ============================================================================

interface AudioPreviewProps {
  src: string;
  filename: string;
  height: number | string;
}

const AudioPreview: React.FC<AudioPreviewProps> = ({ src, filename, height }) => {
  return (
    <div
      className="flex flex-col items-center justify-center gap-6 p-8"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div
        className={clsx(
          'w-24 h-24 rounded-full flex items-center justify-center',
          'bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]',
          'text-4xl text-white shadow-lg'
        )}
      >
        <FileOutlined />
      </div>
      <div className="text-[var(--text-primary)] font-medium text-center max-w-xs truncate">
        {filename}
      </div>
      <audio src={src} controls className="w-full max-w-md">
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
};

// ============================================================================
// 子组件：未支持类型提示
// ============================================================================

interface UnsupportedPreviewProps {
  fileType: FileType;
  filename: string;
  filePath: string;
  height: number | string;
}

const UnsupportedPreview: React.FC<UnsupportedPreviewProps> = ({
  fileType,
  filename,
  filePath,
  height,
}) => {
  const handleOpenInExplorer = () => {
    // TODO: 通过 Client Agent 打开文件所在目录
    message.info('此功能需要 Client Agent 支持');
  };

  return (
    <div
      className="flex flex-col items-center justify-center p-8"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div
        className={clsx(
          'w-16 h-16 rounded-xl flex items-center justify-center mb-4',
          'bg-[var(--glass-bg-medium)]',
          'border border-[var(--border-light)]',
          'text-3xl text-[var(--text-tertiary)]'
        )}
      >
        {fileTypeIcons[fileType]}
      </div>
      <div className="text-[var(--text-primary)] font-medium mb-1">{filename}</div>
      <div className="text-[var(--text-tertiary)] text-sm mb-4">
        {fileType === 'unknown' ? '未知文件类型' : `${fileType} 文件`}
      </div>
      <div className="text-[var(--text-tertiary)] text-xs mb-4 max-w-md text-center">
        {filePath}
      </div>
      <Button
        icon={<FolderOpenOutlined />}
        onClick={handleOpenInExplorer}
        className="text-[var(--text-secondary)]"
      >
        在资源管理器中打开
      </Button>
    </div>
  );
};

// ============================================================================
// 主组件
// ============================================================================

export const FileViewer: React.FC<WorkbenchComponentProps<FileViewerSchema>> = ({
  schema,
}) => {
  const {
    filePath,
    title,
    fileType: specifiedFileType,
    language: specifiedLanguage,
    readOnly = false, // 默认允许编辑
    height, // 不设默认值，让组件自动填满
    // highlightLines, // TODO: 实现行高亮
    style,
    className,
  } = schema;

  // 动态高度计算
  const contentRef = useRef<HTMLDivElement>(null);
  const [dynamicHeight, setDynamicHeight] = useState<number>(400);

  // 编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // 监听容器大小变化
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const updateHeight = () => {
      const rect = element.getBoundingClientRect();
      if (rect.height > 0) {
        setDynamicHeight(rect.height);
      }
    };

    // 初始计算
    updateHeight();

    // 使用 ResizeObserver 监听大小变化
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 加载文件内容
  const { content, loading, error, reload } = useFileContent(filePath);

  // 计算文件类型和语言
  const fileType = useMemo(() => {
    if (specifiedFileType) return specifiedFileType;
    if (content?.fileType) return content.fileType;
    return detectFileType(filePath);
  }, [specifiedFileType, content?.fileType, filePath]);

  const language = useMemo(() => {
    if (specifiedLanguage) return specifiedLanguage;
    if (content?.language) return content.language;
    return detectLanguage(filePath);
  }, [specifiedLanguage, content?.language, filePath]);

  const filename = useMemo(() => {
    return title || getFilename(filePath);
  }, [title, filePath]);

  // 是否可以编辑（代码和文本文件）
  const canEdit = useMemo(() => {
    return !readOnly && ['code', 'text'].includes(fileType);
  }, [readOnly, fileType]);

  // 进入编辑模式
  const handleEnterEdit = () => {
    setEditedContent(content?.content || '');
    setIsEditMode(true);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedContent('');
  };

  // 保存文件
  const handleSave = async () => {
    if (!filePath || isSaving) return;

    setIsSaving(true);
    try {
      await FileService.saveFile(filePath, editedContent);
      message.success('文件保存成功');
      setIsEditMode(false);
      // 重新加载文件内容
      reload();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '保存失败';
      message.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // 计算高度 - 如果未指定则使用动态计算的高度
  const hasFixedHeight = height !== undefined;
  const contentHeight = hasFixedHeight
    ? (typeof height === 'number' ? height : parseInt(height as string, 10) || 400)
    : 0;
  const headerHeight = 40;
  const innerHeight = hasFixedHeight ? contentHeight - headerHeight : dynamicHeight;

  // 渲染内容区域
  const renderContent = () => {
    // 使用像素高度（Monaco Editor 需要明确的像素值）
    const actualHeight = `${innerHeight}px`;

    // 加载中
    if (loading) {
      return (
        <div
          className="flex items-center justify-center h-full"
          style={{ minHeight: hasFixedHeight ? `${innerHeight}px` : undefined }}
        >
          <LoadingOutlined className="mr-2 text-lg" />
          <span className="text-[var(--text-tertiary)]">正在加载文件...</span>
        </div>
      );
    }

    // 加载失败
    if (error && !content) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full"
          style={{ minHeight: hasFixedHeight ? `${innerHeight}px` : undefined }}
        >
          <ExclamationCircleOutlined className="text-3xl text-[var(--accent-error)] mb-2" />
          <div className="text-[var(--text-secondary)] mb-2">{error}</div>
          <Button size="small" icon={<ReloadOutlined />} onClick={reload}>
            重试
          </Button>
        </div>
      );
    }

    // 根据文件类型渲染
    const fileContent = content?.content || '';

    switch (fileType) {
      case 'code':
      case 'text':
        return (
          <CodePreview
            code={isEditMode ? editedContent : fileContent}
            language={language}
            height={actualHeight}
            readOnly={!isEditMode}
            onChange={isEditMode ? setEditedContent : undefined}
          />
        );

      case 'markdown':
        return <MarkdownPreview content={fileContent} height={actualHeight} />;

      case 'image':
        return (
          <ImagePreview
            src={content?.base64 ? `data:image/*;base64,${content.base64}` : filePath}
            alt={filename}
            height={actualHeight}
          />
        );

      case 'pdf':
        return (
          <PdfPreview
            src={content?.base64 ? `data:application/pdf;base64,${content.base64}` : filePath}
            height={actualHeight}
          />
        );

      case 'video':
        return (
          <VideoPreview
            src={content?.base64 ? `data:video/*;base64,${content.base64}` : filePath}
            height={actualHeight}
          />
        );

      case 'audio':
        return (
          <AudioPreview
            src={content?.base64 ? `data:audio/*;base64,${content.base64}` : filePath}
            filename={filename}
            height={actualHeight}
          />
        );

      case 'word':
      case 'excel':
      case 'ppt':
      case 'unknown':
      default:
        return (
          <UnsupportedPreview
            fileType={fileType}
            filename={filename}
            filePath={filePath}
            height={actualHeight}
          />
        );
    }
  };

  return (
    <div
      className={clsx(
        'workbench-file-viewer',
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
        {/* 左侧：文件图标和名称 */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--text-tertiary)]">
            {fileTypeIcons[fileType]}
          </span>
          <Tooltip title={filePath}>
            <span className="text-sm text-[var(--text-primary)] truncate">
              {filename}
            </span>
          </Tooltip>
          {error && (
            <span className="text-xs text-[var(--accent-warning)]">(加载失败)</span>
          )}
          {isEditMode && (
            <span className="text-xs text-[var(--accent-primary)] px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10">编辑中</span>
          )}
        </div>

        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-1">
          {/* 编辑模式按钮 */}
          {isEditMode ? (
            <>
              <Tooltip title="保存">
                <Button
                  type="text"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={isSaving}
                  className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                />
              </Tooltip>
              <Tooltip title="取消">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                />
              </Tooltip>
            </>
          ) : (
            <>
              {canEdit && (
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={handleEnterEdit}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  />
                </Tooltip>
              )}
              <Tooltip title="重新加载">
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={reload}
                  loading={loading}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div
        ref={contentRef}
        className={clsx('flex-1 min-h-0', !hasFixedHeight && 'h-0')}
      >
        {renderContent()}
      </div>
    </div>
  );
};

FileViewer.displayName = 'WorkbenchFileViewer';
