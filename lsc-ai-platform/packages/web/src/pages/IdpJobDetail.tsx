import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Tag,
  Spin,
  Breadcrumb,
  Space,
  Progress,
  Descriptions,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  TableOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { idpApi, type IdpJob } from '../services/idp-api';
import { OcrViewer, TableView, ElementView, ContractReview } from '../components/idp';
import type { OcrResponse, TableResult, ContractRisk } from '../services/idp-api';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  queued: { color: 'default', icon: <SyncOutlined />, label: '排队中' },
  processing: { color: 'processing', icon: <SyncOutlined spin />, label: '处理中' },
  completed: { color: 'success', icon: <CheckCircleOutlined />, label: '已完成' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
};

export default function IdpJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<IdpJob | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await idpApi.getJob(jobId);
      setJob(data);
    } catch {
      // Error handled in UI
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // Poll if processing
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'processing')) return;
    const interval = setInterval(loadJob, 3000);
    return () => clearInterval(interval);
  }, [job, loadJob]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="h-full flex items-center justify-center">
        <Empty description="任务不存在" />
      </div>
    );
  }

  const results = job.results as Record<string, unknown> | null;
  const ocrData = results?.ocr as OcrResponse | undefined;
  const tablesData = results?.tables as TableResult[] | undefined;
  const elementsData = results?.elements as Record<string, string | null> | undefined;
  const risksData = results?.risks as ContractRisk[] | undefined;
  const summaryData = results?.summary as {
    totalElements: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  } | undefined;

  const progressPercent =
    job.totalDocuments > 0
      ? Math.round((job.completedDocuments / job.totalDocuments) * 100)
      : 0;

  const duration = (() => {
    if (!job.startedAt) return '-';
    const end = job.completedAt ? new Date(job.completedAt) : new Date();
    const start = new Date(job.startedAt);
    const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  })();

  // Build tabs based on available data
  const tabItems = [];

  if (ocrData) {
    tabItems.push({
      key: 'ocr',
      label: (
        <Space>
          <FileTextOutlined /> OCR 识别结果
        </Space>
      ),
      children: <OcrViewer ocrResult={ocrData} />,
    });
  }

  if (tablesData && tablesData.length > 0) {
    tabItems.push({
      key: 'tables',
      label: (
        <Space>
          <TableOutlined /> 表格数据
        </Space>
      ),
      children: <TableView tables={tablesData} />,
    });
  }

  if (elementsData && Object.keys(elementsData).length > 0) {
    tabItems.push({
      key: 'elements',
      label: (
        <Space>
          <ProfileOutlined /> 要素提取
        </Space>
      ),
      children: <ElementView elements={elementsData} />,
    });
  }

  if (risksData && risksData.length > 0 && summaryData) {
    tabItems.push({
      key: 'contract',
      label: (
        <Space>
          <SafetyCertificateOutlined /> 合同审查
        </Space>
      ),
      children: (
        <ContractReview
          elements={elementsData ?? {}}
          risks={risksData}
          summary={summaryData}
        />
      ),
    });
  }

  const statusCfg = statusConfig[job.status] || statusConfig.queued;

  return (
    <div className="h-full overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Breadcrumb */}
        <Breadcrumb
          className="mb-4"
          items={[
            {
              title: (
                <Link to="/idp" className="flex items-center gap-1">
                  <ArrowLeftOutlined /> 文档处理
                </Link>
              ),
            },
            { title: `Job ${job.id.slice(0, 8)}...` },
          ]}
        />

        {/* Job metadata */}
        <Card
          className="mb-4"
          style={{ background: 'var(--glass-bg-medium)' }}
        >
          <Descriptions column={4} size="small">
            <Descriptions.Item label="任务ID">
              <span style={{ color: 'var(--text-primary)' }}>{job.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag icon={statusCfg.icon} color={statusCfg.color}>
                {statusCfg.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(job.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">{duration}</Descriptions.Item>
          </Descriptions>

          {(job.status === 'processing' || job.status === 'queued') && (
            <div className="mt-3">
              <Progress
                percent={progressPercent}
                status={job.status === 'processing' ? 'active' : 'normal'}
                format={() => `${job.completedDocuments}/${job.totalDocuments}`}
              />
            </div>
          )}

          {job.error && (
            <div
              className="mt-3 p-3 rounded"
              style={{
                background: 'var(--status-error-bg)',
                border: '1px solid var(--status-error-border)',
              }}
            >
              <span style={{ color: '#ff4d4f' }}>Error: {job.error}</span>
            </div>
          )}
        </Card>

        {/* Results tabs */}
        {job.status === 'completed' && tabItems.length > 0 ? (
          <Card style={{ background: 'var(--glass-bg-medium)' }}>
            <Tabs items={tabItems} />
          </Card>
        ) : job.status === 'completed' && tabItems.length === 0 ? (
          <Card style={{ background: 'var(--glass-bg-medium)' }}>
            <Empty description="暂无结果数据" />
          </Card>
        ) : job.status === 'processing' || job.status === 'queued' ? (
          <Card style={{ background: 'var(--glass-bg-medium)' }}>
            <div className="text-center py-12">
              <Spin size="large" />
              <p
                className="mt-4 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                文档处理中，页面将自动更新...
              </p>
            </div>
          </Card>
        ) : null}
      </motion.div>
    </div>
  );
}
