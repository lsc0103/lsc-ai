import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Table,
  Tabs,
  Tag,
  Spin,
  Empty,
  Input,
  Upload,
  Modal,
  Popconfirm,
  Breadcrumb,
  Statistic,
  Progress,
  message,
  List,
  Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UploadOutlined,
  DeleteOutlined,
  InboxOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  knowledgeApi,
  type KnowledgeBase,
  type KnowledgeDocument,
  type SearchResult,
} from '../services/knowledge-api';

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '等待处理' },
  processing: { color: 'blue', label: '处理中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
};

const acceptTypes = '.txt,.md,.pdf,.docx,.xlsx';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

  // 上传相关
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // 搜索相关
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loadKb = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await knowledgeApi.getById(id);
      setKb((res.data as any)?.data || res.data);
    } catch {
      message.error('加载知识库信息失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDocuments = useCallback(async () => {
    if (!id) return;
    setDocsLoading(true);
    try {
      const res = await knowledgeApi.getDocuments(id);
      const list = (res.data as any)?.data || res.data || [];
      setDocuments(Array.isArray(list) ? list : []);
    } catch {
      message.error('加载文档列表失败');
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadKb();
    loadDocuments();
  }, [loadKb, loadDocuments]);

  const handleUpload = async (file: File) => {
    if (!id) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      await knowledgeApi.uploadDocument(id, file, (percent) => {
        setUploadProgress(percent);
      });
      message.success(`${file.name} 上传成功`);
      setUploadModalOpen(false);
      loadDocuments();
      loadKb();
    } catch {
      message.error(`${file.name} 上传失败`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await knowledgeApi.deleteDocument(docId);
      message.success('文档已删除');
      loadDocuments();
      loadKb();
    } catch {
      message.error('删除文档失败');
    }
  };

  const handleSearch = async () => {
    if (!id || !searchQuery.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await knowledgeApi.search(id, searchQuery.trim());
      const results = (res.data as any)?.data || res.data || [];
      setSearchResults(Array.isArray(results) ? results : []);
    } catch {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const highlightText = (text: string, keyword: string) => {
    if (!keyword.trim()) return text;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} style={{ background: '#ffd666', padding: 0 }}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const columns: ColumnsType<KnowledgeDocument> = [
    {
      title: '文件名',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (name: string) => (
        <span className="flex items-center gap-1.5">
          <FileTextOutlined />
          {name}
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = statusConfig[status] || statusConfig.pending;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '分块数',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 80,
      render: (count: number) => count ?? '-',
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) =>
        new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认删除此文档？"
          onConfirm={() => handleDeleteDoc(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'documents',
      label: '文档列表',
      children: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-400">
              共 {documents.length} 篇文档
            </span>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              上传文档
            </Button>
          </div>
          <Table
            columns={columns}
            dataSource={documents}
            rowKey="id"
            loading={docsLoading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="暂无文档，点击上方按钮上传" /> }}
          />
        </div>
      ),
    },
    {
      key: 'search',
      label: '搜索测试',
      children: (
        <div>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="输入搜索内容，测试知识库检索效果..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
              style={{ maxWidth: 500 }}
              prefix={<SearchOutlined className="text-gray-400" />}
            />
            <Button
              type="primary"
              onClick={handleSearch}
              loading={searching}
            >
              搜索
            </Button>
          </div>

          <Spin spinning={searching}>
            {!hasSearched ? (
              <Empty
                description="输入关键词测试知识库检索能力"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : searchResults.length === 0 ? (
              <Empty description="没有找到相关内容" />
            ) : (
              <List
                dataSource={searchResults}
                renderItem={(item, index) => (
                  <Card
                    size="small"
                    className="mb-3 shadow-sm"
                    key={index}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Tag color="blue">{item.documentName}</Tag>
                      <Tag>
                        相关度：{(item.score * 100).toFixed(1)}%
                      </Tag>
                    </div>
                    <div className="text-sm leading-relaxed text-gray-300">
                      {highlightText(item.content, searchQuery)}
                    </div>
                  </Card>
                )}
              />
            )}
          </Spin>
        </div>
      ),
    },
  ];

  if (loading && !kb) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* 面包屑导航 */}
        <Breadcrumb
          className="mb-4"
          items={[
            {
              title: (
                <Link to="/knowledge" className="flex items-center gap-1">
                  <ArrowLeftOutlined /> 知识库
                </Link>
              ),
            },
            { title: kb?.name || '加载中...' },
          ]}
        />

        {/* 标题和统计 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-accent-800">
              {kb?.name}
            </h1>
            {kb?.description && (
              <p className="text-sm text-accent-500 mt-1">{kb.description}</p>
            )}
          </div>
          <div className="flex gap-6">
            <Statistic
              title="文档数"
              value={kb?.documentCount ?? 0}
              prefix={<FileTextOutlined />}
            />
            <Statistic
              title="分块数"
              value={kb?.chunkCount ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </div>
        </div>

        {/* Tab 内容 */}
        <Tabs items={tabItems} />
      </motion.div>

      {/* 上传弹窗 */}
      <Modal
        title="上传文档"
        open={uploadModalOpen}
        onCancel={() => {
          if (!uploading) setUploadModalOpen(false);
        }}
        footer={null}
        destroyOnClose
        maskClosable={!uploading}
      >
        <Upload.Dragger
          accept={acceptTypes}
          showUploadList={false}
          customRequest={({ file }) => handleUpload(file as File)}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 .txt, .md, .pdf, .docx, .xlsx 格式
          </p>
        </Upload.Dragger>
        {uploading && (
          <div className="mt-4">
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}
      </Modal>
    </div>
  );
}
