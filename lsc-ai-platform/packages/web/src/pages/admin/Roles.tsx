import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import { roleApi } from '../../services/api';

interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions?: string[];
  createdAt: string;
}

export default function RolesPage() {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<RoleRecord[]>([]);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [editForm] = Form.useForm();

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await roleApi.list();
      const data = res.data?.data || res.data;
      setRoles(Array.isArray(data) ? data : data?.items || []);
    } catch {
      message.error('加载角色列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // --- Create ---
  const handleCreate = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      await roleApi.create(values);
      message.success('角色创建成功');
      setCreateOpen(false);
      loadRoles();
    } catch {
      // validation or API error
    } finally {
      setCreateSubmitting(false);
    }
  };

  // --- Edit ---
  const handleEdit = (record: RoleRecord) => {
    setEditingRole(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingRole) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      await roleApi.update(editingRole.id, values);
      message.success('角色已更新');
      setEditOpen(false);
      loadRoles();
    } catch {
      // validation or API error
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (record: RoleRecord) => {
    try {
      await roleApi.delete(record.id);
      message.success('角色已删除');
      loadRoles();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<RoleRecord> = [
    {
      title: '角色代码',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (val) => val || '-',
    },
    {
      title: '类型',
      key: 'isSystem',
      width: 100,
      render: (_, record) =>
        record.isSystem ? (
          <Tag color="gold">系统角色</Tag>
        ) : (
          <Tag>自定义</Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该角色？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
            disabled={record.isSystem}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.isSystem}
            >
              删除
            </Button>
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-accent-800">角色管理</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理系统角色和权限配置
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建角色
          </Button>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 700 }}
        />
      </motion.div>

      {/* Create Modal */}
      <Modal
        title="新建角色"
        open={createOpen}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={createSubmitting}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item
            name="code"
            label="角色代码"
            rules={[
              { required: true, message: '请输入角色代码' },
              { pattern: /^[a-z][a-z0-9_-]*$/, message: '只允许小写字母、数字、下划线和连字符' },
            ]}
          >
            <Input placeholder="例如：editor, viewer" />
          </Form.Item>
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="例如：编辑者、查看者" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="角色用途描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑角色"
        open={editOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={editSubmitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item label="角色代码">
            <Input value={editingRole?.code} disabled />
          </Form.Item>
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="例如：编辑者、查看者" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="角色用途描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
