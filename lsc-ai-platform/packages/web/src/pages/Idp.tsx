import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Modal,
  Upload,
  Spin,
  Statistic,
  Space,
  message,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileSearchOutlined,
  TableOutlined,
  FormatPainterOutlined,
  FileProtectOutlined,
  UploadOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { idpApi, type IdpJob } from '../services/idp-api';
import { OcrViewer, TableView } from '../components/idp';
import type { OcrResponse, TableResponse } from '../services/idp-api';

type UploadType = 'ocr' | 'table' | 'painting' | 'inspection';

const uploadTypeConfig: Record<UploadType, { label: string; desc: string; icon: React.ReactNode; accept: string }> = {
  ocr: {
    label: '\u6587\u6863\u8bc6\u522b',
    desc: '\u4ece\u626b\u63cf\u6587\u6863\u548c\u56fe\u7247\u4e2d\u63d0\u53d6\u6587\u5b57',
    icon: <FileSearchOutlined style={{ fontSize: 32, color: '#0071e3' }} />,
    accept: '.pdf,.png,.jpg,.jpeg,.tiff,.bmp',
  },
  table: {
    label: '\u8868\u683c\u63d0\u53d6',
    desc: '\u4ece\u6587\u6863\u4e2d\u63d0\u53d6\u8868\u683c\u4e3a\u7ed3\u6784\u5316\u6570\u636e',
    icon: <TableOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    accept: '.pdf,.png,.jpg,.jpeg',
  },
  painting: {
    label: '\u6d82\u88c5\u6e05\u5355',
    desc: '\u5904\u7406\u8239\u8236\u6d82\u88c5\u6750\u6599\u6e05\u5355',
    icon: <FormatPainterOutlined style={{ fontSize: 32, color: '#faad14' }} />,
    accept: '.pdf,.xlsx,.xls,.docx',
  },
  inspection: {
    label: '\u68c0\u9a8c\u62a5\u544a',
    desc: '\u5206\u7c7b\u5e76\u63d0\u53d6\u68c0\u9a8c\u62a5\u544a\u6570\u636e',
    icon: <FileProtectOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />,
    accept: '.pdf,.docx,.xlsx',
  },
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  queued: { color: 'default', icon: <SyncOutlined />, label: '排队中' },
  processing: { color: 'processing', icon: <SyncOutlined spin />, label: '处理中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
};

export default function IdpPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<IdpJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>('ocr');
  const [processing, setProcessing] = useState(false);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);

  // Result modal state
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);
  const [tableResult, setTableResult] = useState<TableResponse | null>(null);
  const [resultTitle, setResultTitle] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await idpApi.listJobs(page, 20);
      setJobs(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch {
      message.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  const checkHealth = useCallback(async () => {
    try {
      const res = await idpApi.checkHealth();
      setServiceOnline(res.status === 'ok' || res.status === 'healthy');
    } catch {
      setServiceOnline(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    checkHealth();
  }, [loadJobs, checkHealth]);

  // Poll processing jobs
  useEffect(() => {
    const hasProcessing = jobs.some(
      (j) => j.status === 'queued' || j.status === 'processing'
    );
    if (!hasProcessing) return;

    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  const handleQuickProcess = (type: UploadType) => {
    setUploadType(type);
    setUploadModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setProcessing(true);
    try {
      switch (uploadType) {
        case 'ocr': {
          const result = await idpApi.uploadAndOcr(file);
          setOcrResult(result);
          setTableResult(null);
          setResultTitle(`OCR: ${file.name}`);
          setUploadModalOpen(false);
          setResultModalOpen(true);
          break;
        }
        case 'table': {
          const result = await idpApi.extractTables(file);
          setTableResult(result);
          setOcrResult(null);
          setResultTitle(`Tables: ${file.name}`);
          setUploadModalOpen(false);
          setResultModalOpen(true);
          break;
        }
        case 'painting': {
          await idpApi.processPaintingList(file);
          message.success('涂装清单已提交处理');
          setUploadModalOpen(false);
          loadJobs();
          break;
        }
        case 'inspection': {
          await idpApi.processInspectionReport(file);
          message.success('检验报告已提交处理');
          setUploadModalOpen(false);
          loadJobs();
          break;
        }
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '处理失败');
    } finally {
      setProcessing(false);
    }
  };

  // Computed stats
  const stats = {
    total: total,
    processing: jobs.filter((j) => j.status === 'processing' || j.status === 'queued').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  const columns: ColumnsType<IdpJob> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (id: string) => (
        <a onClick={() => navigate(`/idp/${id}`)} style={{ color: 'var(--accent-primary)' }}>
          {id.slice(0, 8)}...
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const cfg = statusConfig[status] || statusConfig.queued;
        return (
          <Tag icon={cfg.icon} color={cfg.color}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '文档数',
      key: 'docs',
      width: 120,
      render: (_, record) => (
        <span>
          {record.completedDocuments}/{record.totalDocuments}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) =>
        new Date(date).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_, record) => {
        if (!record.startedAt) return '-';
        const end = record.completedAt
          ? new Date(record.completedAt)
          : new Date();
        const start = new Date(record.startedAt);
        const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
        return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/idp/${record.id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              智能文档处理（IDP）
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              OCR 文字识别、表格提取、AI 驱动的文档分析
            </p>
          </div>
          <Space>
            <Badge
              status={serviceOnline === null ? 'default' : serviceOnline ? 'success' : 'error'}
              text={
                <span style={{ color: 'var(--text-secondary)' }}>
                  IDP 服务：{serviceOnline === null ? '检测中...' : serviceOnline ? '在线' : '离线'}
                </span>
              }
            />
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => handleQuickProcess('ocr')}
            >
              上传文档
            </Button>
          </Space>
        </div>

        {/* Stats cards */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
              <Statistic
                title="文档总数"
                value={stats.total}
                prefix={<FileSearchOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
              <Statistic
                title="处理中"
                value={stats.processing}
                prefix={<SyncOutlined spin={stats.processing > 0} />}
                valueStyle={{ color: stats.processing > 0 ? '#0071e3' : undefined }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
              <Statistic
                title="已完成"
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
              <Statistic
                title="IDP 服务"
                value={serviceOnline ? '在线' : '离线'}
                valueStyle={{ color: serviceOnline ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Quick process cards */}
        <h2
          className="text-base font-medium mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          快速处理
        </h2>
        <Row gutter={16} className="mb-6">
          {(Object.entries(uploadTypeConfig) as [UploadType, typeof uploadTypeConfig[UploadType]][]).map(
            ([type, config]) => (
              <Col span={6} key={type}>
                <Card
                  hoverable
                  className="text-center"
                  style={{ background: 'var(--glass-bg-medium)' }}
                  onClick={() => handleQuickProcess(type)}
                  styles={{ body: { padding: '24px 16px' } }}
                >
                  <div className="mb-3">{config.icon}</div>
                  <h3
                    className="text-sm font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {config.label}
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {config.desc}
                  </p>
                </Card>
              </Col>
            )
          )}
        </Row>

        {/* Job list */}
        <Card
          title="处理任务"
          style={{ background: 'var(--glass-bg-medium)' }}
          extra={
            <Button size="small" onClick={loadJobs} loading={loading}>
              刷新
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={jobs}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: (
                <div className="py-8">
                  <CloudUploadOutlined style={{ fontSize: 48, color: 'var(--text-tertiary)' }} />
                  <p style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
                    暂无处理任务，上传文档开始使用
                  </p>
                </div>
              ),
            }}
          />
        </Card>
      </motion.div>

      {/* Upload modal */}
      <Modal
        title={`上传 - ${uploadTypeConfig[uploadType].label}`}
        open={uploadModalOpen}
        onCancel={() => !processing && setUploadModalOpen(false)}
        footer={null}
        destroyOnClose
        maskClosable={!processing}
      >
        <Spin spinning={processing} tip="文档处理中...">
          <Upload.Dragger
            accept={uploadTypeConfig[uploadType].accept}
            showUploadList={false}
            customRequest={({ file }) => handleUpload(file as File)}
            disabled={processing}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件上传</p>
            <p className="ant-upload-hint">
              支持格式：{uploadTypeConfig[uploadType].accept}
            </p>
          </Upload.Dragger>
        </Spin>
      </Modal>

      {/* Result modal */}
      <Modal
        title={resultTitle}
        open={resultModalOpen}
        onCancel={() => setResultModalOpen(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        {ocrResult && <OcrViewer ocrResult={ocrResult} />}
        {tableResult && (
          <TableView tables={tableResult.tables} filename={tableResult.filename} />
        )}
      </Modal>
    </div>
  );
}
