/**
 * Workbench Office 文档预览组件
 *
 * 支持预览 Word、Excel、PPT 等 Office 文档
 * - 本地文件通过 Client Agent 读取并转换
 * - 远程文件通过 URL 加载（支持 Office Online Viewer）
 * - 拖放文件通过 base64 数据直接解析
 */

import React, { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  LoadingOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  FullscreenOutlined,
  DownloadOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, Modal, message, Table, Empty, Tabs } from 'antd';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

import type {
  WordPreviewSchema,
  ExcelPreviewSchema,
  PPTPreviewSchema,
} from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import {
  useFileContent,
  getFilename,
} from '../../services/FileService';

// ============================================================================
// 通用样式和工具
// ============================================================================

const containerClasses = clsx(
  'rounded-lg overflow-hidden',
  'border border-[var(--border-light)]',
  'bg-[var(--glass-bg-medium)]'
);

const headerClasses = clsx(
  'flex items-center justify-between',
  'h-10 px-3',
  'border-b border-[var(--border-light)]',
  'bg-[var(--glass-bg-subtle)]'
);

// ============================================================================
// 子组件：Office Online Viewer (iframe 模式)
// ============================================================================

interface OfficeOnlineViewerProps {
  url: string;
  height: number;
  type: 'word' | 'excel' | 'ppt';
}

const OfficeOnlineViewer: React.FC<OfficeOnlineViewerProps> = ({
  url,
  height,
  type,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 使用 Office Online Viewer 嵌入
  // 需要文件是公开可访问的 URL
  const viewerUrl = useMemo(() => {
    // Office Online Viewer URL
    // 注意：这需要文件是公开可访问的
    const encodedUrl = encodeURIComponent(url);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
  }, [url]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError('无法加载文档预览');
  };

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <ExclamationCircleOutlined className="text-3xl text-[var(--accent-warning)] mb-2" />
        <div className="text-[var(--text-secondary)] mb-2">{error}</div>
        <div className="text-[var(--text-tertiary)] text-xs">
          Office Online Viewer 需要文件是公开可访问的 URL
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: `${height}px` }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--glass-bg-medium)]">
          <LoadingOutlined className="mr-2 text-lg" />
          <span className="text-[var(--text-tertiary)]">正在加载文档...</span>
        </div>
      )}
      <iframe
        src={viewerUrl}
        width="100%"
        height={height}
        frameBorder="0"
        onLoad={handleLoad}
        onError={handleError}
        className={clsx('w-full', loading && 'opacity-0')}
        title={`${type} document preview`}
      />
    </div>
  );
};

// ============================================================================
// 子组件：本地文件预览占位
// ============================================================================

interface LocalFilePreviewProps {
  filePath: string;
  filename: string;
  height: number;
  type: 'word' | 'excel' | 'ppt';
  icon: React.ReactNode;
}

const LocalFilePreview: React.FC<LocalFilePreviewProps> = ({
  filePath,
  filename,
  height,
  type,
  icon,
}) => {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  // 加载文件内容
  const { content, loading, error, reload } = useFileContent(filePath);

  // 调试日志 - 更新于 2026-01-26 16:20
  console.log('=== [LocalFilePreview 调试 v2] ===');
  console.log('[LocalFilePreview] filePath:', filePath);
  console.log('[LocalFilePreview] type:', type);
  console.log('[LocalFilePreview] loading:', loading);
  console.log('[LocalFilePreview] error:', error);
  console.log('[LocalFilePreview] content 对象:', content);
  console.log('[LocalFilePreview] content?.base64 存在:', !!content?.base64);
  console.log('[LocalFilePreview] content?.base64 长度:', content?.base64?.length);
  console.log('=== [LocalFilePreview 调试结束] ===');

  // 类型名称映射
  const typeNames: Record<string, string> = {
    word: 'Word 文档',
    excel: 'Excel 表格',
    ppt: 'PowerPoint 演示',
  };

  // 打开本地应用
  const handleOpenLocal = () => {
    // TODO: 通过 Client Agent 打开本地应用
    message.info('此功能需要 Client Agent 支持');
  };

  // 显示内容
  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <LoadingOutlined className="mr-2 text-lg" />
        <span className="text-[var(--text-tertiary)]">正在加载文档...</span>
      </div>
    );
  }

  if (error && !content?.base64) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <ExclamationCircleOutlined className="text-3xl text-[var(--accent-error)] mb-2" />
        <div className="text-[var(--text-secondary)] mb-2">{error}</div>
        <Button size="small" icon={<ReloadOutlined />} onClick={reload}>
          重试
        </Button>
      </div>
    );
  }

  // 如果有 base64 数据，使用对应的渲染器
  if (content?.base64) {
    if (type === 'word') {
      return (
        <WordContentRenderer
          fileData={content.base64}
          filename={filename}
          height={height}
        />
      );
    }
    if (type === 'excel') {
      return (
        <ExcelContentRenderer
          fileData={content.base64}
          filename={filename}
          height={height}
        />
      );
    }
    if (type === 'ppt') {
      return (
        <PPTContentRenderer
          fileData={content.base64}
          filename={filename}
          height={height}
        />
      );
    }
  }

  // 默认显示：文件信息和操作按钮
  return (
    <div
      className="flex flex-col items-center justify-center p-8"
      style={{ height: `${height}px` }}
    >
      <div
        className={clsx(
          'w-20 h-20 rounded-xl flex items-center justify-center mb-4',
          'bg-[var(--glass-bg-medium)]',
          'border border-[var(--border-light)]',
          'text-4xl'
        )}
      >
        {icon}
      </div>
      <div className="text-[var(--text-primary)] font-medium mb-1">
        {filename}
      </div>
      <div className="text-[var(--text-tertiary)] text-sm mb-4">
        {typeNames[type]}
      </div>
      <div className="text-[var(--text-tertiary)] text-xs mb-6 max-w-md text-center">
        {filePath}
      </div>
      <div className="flex gap-2">
        <Button icon={<DownloadOutlined />} onClick={handleOpenLocal}>
          在本地打开
        </Button>
        <Tooltip title="全屏预览（需要公开 URL）">
          <Button
            icon={<FullscreenOutlined />}
            onClick={() => setFullscreenVisible(true)}
            disabled
          />
        </Tooltip>
      </div>

      {/* 全屏预览模态框 */}
      <Modal
        title={filename}
        open={fullscreenVisible}
        onCancel={() => setFullscreenVisible(false)}
        footer={null}
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { height: 'calc(90vh - 108px)', padding: 0 } }}
      >
        <Empty
          description="本地文件暂不支持全屏预览"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Modal>
    </div>
  );
};

// ============================================================================
// 子组件：Word 内容渲染（从 base64 数据）
// ============================================================================

interface WordContentRendererProps {
  fileData: string;
  filename: string;
  height: number;
}

const WordContentRenderer: React.FC<WordContentRendererProps> = ({
  fileData,
  filename: _filename,
  height,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');

  // height 为 0 表示使用 flex 填满
  const hasFixedHeight = height > 0;

  useEffect(() => {
    const parseWord = async () => {
      try {
        setLoading(true);
        setError(null);

        // base64 转 ArrayBuffer
        const binaryString = atob(fileData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        // 使用 mammoth 解析 Word 文档
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(result.value);

        if (result.messages.length > 0) {
          console.log('[WordPreview] 解析警告:', result.messages);
        }
      } catch (err) {
        console.error('[WordPreview] 解析失败:', err);
        setError(err instanceof Error ? err.message : '解析 Word 文档失败');
      } finally {
        setLoading(false);
      }
    };

    parseWord();
  }, [fileData]);

  if (loading) {
    return (
      <div
        className={clsx('flex items-center justify-center', !hasFixedHeight && 'h-full')}
        style={hasFixedHeight ? { height: `${height}px` } : undefined}
      >
        <LoadingOutlined className="mr-2 text-lg" />
        <span className="text-[var(--text-tertiary)]">正在解析 Word 文档...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center', !hasFixedHeight && 'h-full')}
        style={hasFixedHeight ? { height: `${height}px` } : undefined}
      >
        <ExclamationCircleOutlined className="text-3xl text-[var(--accent-error)] mb-2" />
        <div className="text-[var(--text-secondary)] mb-2">{error}</div>
        <div className="text-[var(--text-tertiary)] text-xs">
          仅支持 .docx 格式，.doc 格式暂不支持
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('overflow-auto p-6 bg-white', !hasFixedHeight && 'h-full')}
      style={hasFixedHeight ? { height: `${height}px` } : undefined}
    >
      <div
        className="word-content prose max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{
          color: '#333',
          lineHeight: 1.6,
        }}
      />
    </div>
  );
};

// ============================================================================
// 子组件：Excel 内容渲染（从 base64 数据）
// ============================================================================

interface ExcelContentRendererProps {
  fileData: string;
  filename: string;
  height: number;
}

interface SheetData {
  name: string;
  data: Record<string, unknown>[];
  columns: { title: string; dataIndex: string; key: string; ellipsis: boolean }[];
}

const ExcelContentRenderer: React.FC<ExcelContentRendererProps> = ({
  fileData,
  filename: _filename,
  height,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');

  // height 为 0 表示使用 flex 填满
  const hasFixedHeight = height > 0;

  useEffect(() => {
    const parseExcel = async () => {
      try {
        setLoading(true);
        setError(null);

        // base64 转 ArrayBuffer
        const binaryString = atob(fileData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // 使用 xlsx 解析 Excel 文件
        const workbook = XLSX.read(bytes, { type: 'array' });

        const parsedSheets: SheetData[] = [];
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            parsedSheets.push({
              name: sheetName,
              data: [],
              columns: [],
            });
            continue;
          }

          // 第一行作为表头
          const headers = (jsonData[0] as unknown[]).map((h, i) => String(h || `列${i + 1}`));
          const columns = headers.map((header, index) => ({
            title: header,
            dataIndex: `col_${index}`,
            key: `col_${index}`,
            ellipsis: true,
          }));

          // 转换数据
          const data = jsonData.slice(1).map((row, rowIndex) => {
            const rowData: Record<string, unknown> = { _key: rowIndex };
            (row as unknown[]).forEach((cell, colIndex) => {
              rowData[`col_${colIndex}`] = cell;
            });
            return rowData;
          });

          parsedSheets.push({
            name: sheetName,
            data,
            columns,
          });
        }

        setSheets(parsedSheets);
        if (parsedSheets.length > 0) {
          setActiveSheet(parsedSheets[0].name);
        }
      } catch (err) {
        console.error('[ExcelPreview] 解析失败:', err);
        setError(err instanceof Error ? err.message : '解析 Excel 文件失败');
      } finally {
        setLoading(false);
      }
    };

    parseExcel();
  }, [fileData]);

  if (loading) {
    return (
      <div
        className={clsx('flex items-center justify-center', !hasFixedHeight && 'h-full')}
        style={hasFixedHeight ? { height: `${height}px` } : undefined}
      >
        <LoadingOutlined className="mr-2 text-lg" />
        <span className="text-[var(--text-tertiary)]">正在解析 Excel 文件...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center', !hasFixedHeight && 'h-full')}
        style={hasFixedHeight ? { height: `${height}px` } : undefined}
      >
        <ExclamationCircleOutlined className="text-3xl text-[var(--accent-error)] mb-2" />
        <div className="text-[var(--text-secondary)] mb-2">{error}</div>
      </div>
    );
  }

  const currentSheet = sheets.find((s) => s.name === activeSheet);

  return (
    <div
      className={clsx('flex flex-col overflow-hidden', !hasFixedHeight && 'h-full')}
      style={hasFixedHeight ? { height: `${height}px` } : undefined}
    >
      {/* 工作表标签 */}
      {sheets.length > 1 && (
        <Tabs
          activeKey={activeSheet}
          onChange={setActiveSheet}
          size="small"
          className="px-2 pt-1"
          items={sheets.map((sheet) => ({
            key: sheet.name,
            label: sheet.name,
          }))}
        />
      )}

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto p-2">
        {currentSheet && currentSheet.data.length > 0 ? (
          <Table
            columns={currentSheet.columns}
            dataSource={currentSheet.data.slice(0, 500)}
            size="small"
            pagination={currentSheet.data.length > 50 ? { pageSize: 50 } : false}
            scroll={{ x: true }}
            rowKey="_key"
          />
        ) : (
          <Empty description="工作表为空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {currentSheet && currentSheet.data.length > 500 && (
          <div className="text-center text-[var(--text-tertiary)] text-xs mt-2">
            仅显示前 500 行，共 {currentSheet.data.length} 行
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 子组件：PPT 内容渲染（从 base64 数据）
// ============================================================================

interface PPTContentRendererProps {
  fileData: string;
  filename: string;
  height: number;
}

const PPTContentRenderer: React.FC<PPTContentRendererProps> = ({
  fileData,
  filename,
  height,
}) => {
  // PPT 解析较为复杂，暂时显示文件信息
  // 后续可以使用 pptx 解析库或服务端转换
  const fileSize = useMemo(() => {
    const bytes = atob(fileData).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }, [fileData]);

  return (
    <div
      className="flex flex-col items-center justify-center p-8"
      style={{ height: `${height}px` }}
    >
      <div
        className={clsx(
          'w-20 h-20 rounded-xl flex items-center justify-center mb-4',
          'bg-[var(--glass-bg-medium)]',
          'border border-[var(--border-light)]',
          'text-4xl'
        )}
      >
        <FilePptOutlined className="text-orange-500" />
      </div>
      <div className="text-[var(--text-primary)] font-medium mb-1">
        {filename}
      </div>
      <div className="text-[var(--text-tertiary)] text-sm mb-2">
        PowerPoint 演示文稿
      </div>
      <div className="text-[var(--text-tertiary)] text-xs mb-4">
        文件大小: {fileSize}
      </div>
      <div className="text-[var(--text-tertiary)] text-xs text-center max-w-md">
        PPT 在线预览功能开发中，目前可以通过「在本地打开」使用 Office 应用查看
      </div>
    </div>
  );
};

// ============================================================================
// WordPreview 组件
// ============================================================================

export const WordPreview: React.FC<
  WorkbenchComponentProps<WordPreviewSchema>
> = ({ schema }) => {
  const {
    filePath,
    url,
    fileData,
    filename: schemaFilename,
    title,
    height,
    style,
    className,
  } = schema;

  // 本地文件加载 - 直接在组件内处理
  const { content: localContent, loading: localLoading } = useFileContent(filePath);

  const filename = useMemo(() => {
    if (title) return title;
    if (schemaFilename) return schemaFilename;
    if (filePath) return getFilename(filePath);
    if (url) return getFilename(url);
    return 'Word 文档';
  }, [title, schemaFilename, filePath, url]);

  // 高度处理：如果指定了高度则使用固定高度，否则使用 flex 填满
  const hasFixedHeight = height !== undefined;
  const contentHeight = hasFixedHeight
    ? (typeof height === 'number' ? height : parseInt(height as string, 10) || 500)
    : 0;
  const headerHeight = 40;
  const innerHeight = hasFixedHeight ? contentHeight - headerHeight : 0;

  const renderContent = () => {
    const contentStyle = hasFixedHeight ? { height: `${innerHeight}px` } : {};
    const contentClass = hasFixedHeight ? '' : 'flex-1 min-h-0';

    // 优先使用 fileData（拖放预览）
    if (fileData) {
      return (
        <div className={clsx('overflow-auto', contentClass)} style={contentStyle}>
          <WordContentRenderer
            fileData={fileData}
            filename={filename}
            height={hasFixedHeight ? innerHeight : 0}
          />
        </div>
      );
    }

    // 使用 URL（支持 Office Online Viewer）
    if (url) {
      return (
        <div className={clsx(contentClass)} style={contentStyle}>
          <OfficeOnlineViewer url={url} height={hasFixedHeight ? innerHeight : 600} type="word" />
        </div>
      );
    }

    // 本地文件 - 直接使用加载的 base64 数据
    if (filePath) {
      // 加载中
      if (localLoading) {
        return (
          <div className={clsx('flex items-center justify-center', contentClass)} style={contentStyle}>
            <LoadingOutlined className="mr-2 text-lg" />
            <span className="text-[var(--text-tertiary)]">正在加载 Word 文档...</span>
          </div>
        );
      }

      // 有 base64 数据，直接渲染
      if (localContent?.base64) {
        return (
          <div className={clsx('overflow-auto', contentClass)} style={contentStyle}>
            <WordContentRenderer
              fileData={localContent.base64}
              filename={filename}
              height={hasFixedHeight ? innerHeight : 0}
            />
          </div>
        );
      }

      // 加载失败或无数据，显示文件信息
      return (
        <div className={clsx(contentClass)} style={contentStyle}>
          <LocalFilePreview
            filePath={filePath}
            filename={filename}
            height={hasFixedHeight ? innerHeight : 400}
            type="word"
            icon={<FileWordOutlined className="text-blue-500" />}
          />
        </div>
      );
    }

    return (
      <div className={clsx('flex items-center justify-center', contentClass)} style={contentStyle}>
        <Empty
          description="未指定文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  };

  return (
    <div
      className={clsx(
        'workbench-word-preview',
        containerClasses,
        'flex flex-col',
        !hasFixedHeight && 'h-full',
        className
      )}
      style={{ ...style, ...(hasFixedHeight ? { height } : {}) }}
    >
      {/* 顶部标题栏 */}
      <div className={headerClasses}>
        <div className="flex items-center gap-2">
          <FileWordOutlined className="text-blue-500" />
          <Tooltip title={filePath || url || filename}>
            <span className="text-sm text-[var(--text-primary)] truncate">
              {filename}
            </span>
          </Tooltip>
        </div>
        {url && (
          <Tooltip title="在新窗口打开">
            <Button
              type="text"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => window.open(url, '_blank')}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            />
          </Tooltip>
        )}
      </div>

      {/* 内容区域 */}
      {renderContent()}
    </div>
  );
};

WordPreview.displayName = 'WorkbenchWordPreview';

// ============================================================================
// ExcelPreview 组件
// ============================================================================

export const ExcelPreview: React.FC<
  WorkbenchComponentProps<ExcelPreviewSchema>
> = ({ schema }) => {
  const {
    filePath,
    url,
    fileData,
    filename: schemaFilename,
    title,
    // sheetName, // TODO: 支持指定工作表
    height = 500,
    style,
    className,
  } = schema;

  // 本地文件加载 - 直接在组件内处理
  const { content: localContent, loading: localLoading } = useFileContent(filePath);

  const filename = useMemo(() => {
    if (title) return title;
    if (schemaFilename) return schemaFilename;
    if (filePath) return getFilename(filePath);
    if (url) return getFilename(url);
    return 'Excel 表格';
  }, [title, schemaFilename, filePath, url]);

  // 高度处理：如果指定了高度则使用固定高度，否则使用 flex 填满
  const hasFixedHeight = height !== undefined;
  const contentHeight = hasFixedHeight
    ? (typeof height === 'number' ? height : parseInt(height as string, 10) || 500)
    : 0;
  const headerHeight = 40;
  const innerHeight = hasFixedHeight ? contentHeight - headerHeight : 0;

  const renderContent = () => {
    const contentStyle = hasFixedHeight ? { height: `${innerHeight}px` } : {};
    const contentClass = hasFixedHeight ? '' : 'flex-1 min-h-0';

    // 优先使用 fileData（拖放预览）
    if (fileData) {
      return (
        <div className={clsx('overflow-auto', contentClass)} style={contentStyle}>
          <ExcelContentRenderer
            fileData={fileData}
            filename={filename}
            height={hasFixedHeight ? innerHeight : 0}
          />
        </div>
      );
    }

    // 使用 URL（支持 Office Online Viewer）
    if (url) {
      return (
        <div className={clsx(contentClass)} style={contentStyle}>
          <OfficeOnlineViewer url={url} height={hasFixedHeight ? innerHeight : 600} type="excel" />
        </div>
      );
    }

    // 本地文件 - 直接使用加载的 base64 数据
    if (filePath) {
      // 加载中
      if (localLoading) {
        return (
          <div className={clsx('flex items-center justify-center', contentClass)} style={contentStyle}>
            <LoadingOutlined className="mr-2 text-lg" />
            <span className="text-[var(--text-tertiary)]">正在加载 Excel 文件...</span>
          </div>
        );
      }

      // 有 base64 数据，直接渲染
      if (localContent?.base64) {
        return (
          <div className={clsx('overflow-auto', contentClass)} style={contentStyle}>
            <ExcelContentRenderer
              fileData={localContent.base64}
              filename={filename}
              height={hasFixedHeight ? innerHeight : 0}
            />
          </div>
        );
      }

      // 加载失败或无数据，显示文件信息
      return (
        <div className={clsx(contentClass)} style={contentStyle}>
          <LocalFilePreview
            filePath={filePath}
            filename={filename}
            height={hasFixedHeight ? innerHeight : 400}
            type="excel"
            icon={<FileExcelOutlined className="text-green-500" />}
          />
        </div>
      );
    }

    return (
      <div className={clsx('flex items-center justify-center', contentClass)} style={contentStyle}>
        <Empty
          description="未指定文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  };

  return (
    <div
      className={clsx(
        'workbench-excel-preview',
        containerClasses,
        'flex flex-col',
        !hasFixedHeight && 'h-full',
        className
      )}
      style={{ ...style, ...(hasFixedHeight ? { height } : {}) }}
    >
      {/* 顶部标题栏 */}
      <div className={headerClasses}>
        <div className="flex items-center gap-2">
          <FileExcelOutlined className="text-green-500" />
          <Tooltip title={filePath || url || filename}>
            <span className="text-sm text-[var(--text-primary)] truncate">
              {filename}
            </span>
          </Tooltip>
        </div>
        {url && (
          <Tooltip title="在新窗口打开">
            <Button
              type="text"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => window.open(url, '_blank')}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            />
          </Tooltip>
        )}
      </div>

      {/* 内容区域 */}
      {renderContent()}
    </div>
  );
};

ExcelPreview.displayName = 'WorkbenchExcelPreview';

// ============================================================================
// PPTPreview 组件
// ============================================================================

export const PPTPreview: React.FC<
  WorkbenchComponentProps<PPTPreviewSchema>
> = ({ schema }) => {
  const {
    filePath,
    url,
    fileData,
    filename: schemaFilename,
    title,
    // currentSlide, // TODO: 支持指定幻灯片
    height = 500,
    style,
    className,
  } = schema;

  const filename = useMemo(() => {
    if (title) return title;
    if (schemaFilename) return schemaFilename;
    if (filePath) return getFilename(filePath);
    if (url) return getFilename(url);
    return 'PowerPoint 演示';
  }, [title, schemaFilename, filePath, url]);

  const contentHeight = typeof height === 'number' ? height : parseInt(height as string, 10) || 500;
  const headerHeight = 40;
  const innerHeight = contentHeight - headerHeight;

  const renderContent = () => {
    // 优先使用 fileData（拖放预览）
    if (fileData) {
      return (
        <PPTContentRenderer
          fileData={fileData}
          filename={filename}
          height={innerHeight}
        />
      );
    }

    // 使用 URL（支持 Office Online Viewer）
    if (url) {
      return <OfficeOnlineViewer url={url} height={innerHeight} type="ppt" />;
    }

    // 本地文件
    if (filePath) {
      return (
        <LocalFilePreview
          filePath={filePath}
          filename={filename}
          height={innerHeight}
          type="ppt"
          icon={<FilePptOutlined className="text-orange-500" />}
        />
      );
    }

    return (
      <div
        className="flex items-center justify-center"
        style={{ height: `${innerHeight}px` }}
      >
        <Empty
          description="未指定文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  };

  return (
    <div
      className={clsx('workbench-ppt-preview', containerClasses, className)}
      style={{ ...style, height }}
    >
      {/* 顶部标题栏 */}
      <div className={headerClasses}>
        <div className="flex items-center gap-2">
          <FilePptOutlined className="text-orange-500" />
          <Tooltip title={filePath || url || filename}>
            <span className="text-sm text-[var(--text-primary)] truncate">
              {filename}
            </span>
          </Tooltip>
        </div>
        {url && (
          <Tooltip title="在新窗口打开">
            <Button
              type="text"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => window.open(url, '_blank')}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            />
          </Tooltip>
        )}
      </div>

      {/* 内容区域 */}
      {renderContent()}
    </div>
  );
};

PPTPreview.displayName = 'WorkbenchPPTPreview';
