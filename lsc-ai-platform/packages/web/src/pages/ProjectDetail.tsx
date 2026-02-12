import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Table,
  Modal,
  Form,
  Input,
  Spin,
  Descriptions,
  Empty,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { projectApi } from '../services/api';

interface Session {
  id: string;
  title: string;
  updatedAt: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  documentCount: number;
  chunkCount: number;
}

interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  workingDir?: string;
  createdAt: string;
  updatedAt: string;
  sessions?: Session[];
  knowledgeBases?: KnowledgeBase[];
  _count?: { sessions: number; knowledgeBases: number };
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await projectApi.get(id);
      const data = (res.data as any)?.data || res.data;
      setProject(data);
    } catch {
      message.error('加载项目信息失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleEdit = () => {
    if (!project) return;
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      workingDir: project.workingDir,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await projectApi.update(id, values);
      message.success('更新成功');
      setModalOpen(false);
      loadProject();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '更新项目失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sessionColumns: ColumnsType<Session> = [
    {
      title: '会话标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/chat/${record.id}`)}
        >
          跳转对话
        </Button>
      ),
    },
  ];

  const kbColumns: ColumnsType<KnowledgeBase> = [
    {
      title: '知识库名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount',
      width: 90,
      align: 'center',
      render: (count: number) => count ?? 0,
    },
    {
      title: '分块数',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 90,
      align: 'center',
      render: (count: number) => count ?? 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/knowledge/${record.id}`)}
        >
          跳转知识库
        </Button>
      ),
    },
  ];

  if (loading && !project) {
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
        {/* 返回按钮 */}
        <div className="mb-4">
          <Link to="/projects" className="flex items-center gap-1 text-accent-500 hover:text-accent-800">
            <ArrowLeftOutlined /> 返回项目列表
          </Link>
        </div>

        {/* 项目信息 */}
        <Card className="shadow-sm mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-accent-800 mb-4">
                {project?.name}
              </h1>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="描述" span={2}>
                  {project?.description || '暂无描述'}
                </Descriptions.Item>
                <Descriptions.Item label="工作目录">
                  {project?.workingDir || '未设置'}
                </Descriptions.Item>
                <Descriptions.Item label="会话数">
                  {project?._count?.sessions ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {project?.createdAt ? formatDate(project.createdAt) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {project?.updatedAt ? formatDate(project.updatedAt) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </div>
            <Button icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
          </div>
        </Card>

        {/* 关联会话 */}
        <Card
          title="关联会话"
          className="shadow-sm mb-6"
          size="small"
        >
          <Table
            columns={sessionColumns}
            dataSource={project?.sessions || []}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{
              emptyText: <Empty description="暂无关联会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </Card>

        {/* 关联知识库 */}
        <Card
          title="关联知识库"
          className="shadow-sm"
          size="small"
        >
          <Table
            columns={kbColumns}
            dataSource={project?.knowledgeBases || []}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{
              emptyText: <Empty description="暂无关联知识库" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </Card>
      </motion.div>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑项目"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如：船舶改造项目" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea
              rows={3}
              placeholder="简要描述项目内容和目标"
            />
          </Form.Item>
          <Form.Item name="workingDir" label="工作目录（可选）">
            <Input placeholder="本地工作目录路径" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
