import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Table,
  Empty,
  Modal,
  Form,
  Input,
  Spin,
  Popconfirm,
  Space,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { projectApi } from '../services/api';

interface Project {
  id: string;
  name: string;
  description?: string;
  workingDir?: string;
  _count?: { sessions: number; knowledgeBases: number };
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectApi.list({
        search: searchText || undefined,
        page,
        pageSize,
      });
      const result = res.data?.data ?? res.data;
      if (Array.isArray(result)) {
        setProjects(result);
        setTotal(result.length);
      } else {
        setProjects(result?.data ?? []);
        setTotal(result?.total ?? 0);
      }
    } catch {
      message.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchText, page, pageSize]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = () => {
    setEditingProject(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      workingDir: project.workingDir,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await projectApi.delete(id);
      message.success('删除成功');
      loadProjects();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingProject) {
        await projectApi.update(editingProject.id, values);
        message.success('更新成功');
      } else {
        await projectApi.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadProjects();
    } catch {
      // form validation or API error
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const columns: ColumnsType<Project> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <a onClick={() => navigate(`/projects/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => desc || '-',
    },
    {
      title: '会话数',
      key: 'sessionCount',
      width: 90,
      align: 'center',
      render: (_, record) => record._count?.sessions ?? '-',
    },
    {
      title: '知识库数',
      key: 'kbCount',
      width: 90,
      align: 'center',
      render: (_, record) => record._count?.knowledgeBases ?? '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => handleEdit(record, e)}
          />
          <Popconfirm
            title="确认删除"
            description="删除项目后，关联的会话和知识库不会被删除，但会取消关联。"
            onConfirm={(e) => handleDelete(record.id, e as unknown as React.MouseEvent)}
            onCancel={(e) => e?.stopPropagation()}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
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
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-accent-800">我的项目</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理你的项目，项目内的对话可以共享文件和知识库
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建项目
          </Button>
        </div>

        {/* 搜索 */}
        <div className="mb-4">
          <Input.Search
            placeholder="搜索项目..."
            allowClear
            onSearch={(val) => {
              setSearchText(val);
              setPage(1);
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setSearchText('');
                setPage(1);
              }
            }}
            style={{ maxWidth: 360 }}
          />
        </div>

        {/* 项目列表 */}
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={projects}
            rowKey="id"
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 个项目`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: (
                <Empty
                  description={searchText ? '没有匹配的项目' : '暂无项目'}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  {!searchText && (
                    <Button type="primary" onClick={handleCreate}>
                      创建第一个项目
                    </Button>
                  )}
                </Empty>
              ),
            }}
          />
        </Spin>
      </motion.div>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingProject ? '保存' : '创建'}
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
            <Input placeholder="本地工作目录路径，如 D:\projects\demo" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
