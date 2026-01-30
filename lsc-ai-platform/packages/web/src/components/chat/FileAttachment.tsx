import { useState } from 'react';
import { Upload, message, Spin } from 'antd';
import {
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';
import { uploadApi, FileInfo } from '../../services/api';

interface FileAttachmentProps {
  sessionId?: string;
  onFileUploaded?: (file: FileInfo) => void;
  onFileRemoved?: (fileId: string) => void;
}

// 文件类型图标映射
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <FileImageOutlined className="text-blue-500" />;
  }
  if (mimeType === 'application/pdf') {
    return <FilePdfOutlined className="text-red-500" />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileWordOutlined className="text-blue-600" />;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return <FileExcelOutlined className="text-green-600" />;
  }
  return <FileOutlined className="text-gray-500" />;
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function FileAttachment({ sessionId, onFileUploaded, onFileRemoved }: FileAttachmentProps) {
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);

  // 自定义上传
  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;

    setUploading(true);
    try {
      const response = await uploadApi.upload(file, sessionId);
      const uploadedFile = response.data.data;

      setUploadedFiles((prev) => [...prev, uploadedFile]);
      onFileUploaded?.(uploadedFile);
      onSuccess(uploadedFile);
      message.success(`${file.name} 上传成功`);
    } catch (error: any) {
      console.error('上传失败:', error);
      onError(error);
      message.error(`${file.name} 上传失败`);
    } finally {
      setUploading(false);
    }
  };

  // 移除文件
  const handleRemove = async (file: FileInfo) => {
    try {
      await uploadApi.delete(file.id);
      setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
      onFileRemoved?.(file.id);
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除文件失败');
    }
  };

  return (
    <div className="file-attachment">
      {/* 已上传文件列表 */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                'bg-cream-100 border border-cream-200',
                'text-sm text-accent-600',
              )}
            >
              {getFileIcon(file.mimeType)}
              <span className="max-w-[120px] truncate">{file.originalName}</span>
              <span className="text-xs text-accent-400">({formatFileSize(file.size)})</span>
              <button
                onClick={() => handleRemove(file)}
                className="ml-1 text-accent-400 hover:text-red-500 transition-colors"
              >
                <CloseCircleOutlined />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上传中状态 */}
      {uploading && (
        <div className="flex items-center gap-2 text-sm text-accent-500 mb-2">
          <Spin indicator={<LoadingOutlined spin />} size="small" />
          <span>正在上传...</span>
        </div>
      )}

      {/* 隐藏的上传组件 - 由外部触发 */}
      <Upload
        customRequest={handleUpload}
        showUploadList={false}
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx"
        className="hidden"
        id="file-upload-input"
      >
        <span />
      </Upload>
    </div>
  );
}

// 导出工具函数
export { getFileIcon, formatFileSize };
