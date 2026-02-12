import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Tag,
  Badge,
  Space,
  Popconfirm,
  Checkbox,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import { userApi, roleApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

interface UserRecord {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  roles: { id: string; code: string; name: string }[];
  status: string;
  lastLoginAt?: string;
  createdAt: string;
}

interface RoleRecord {
  id: string;
  code: string;
  name: string;
}

export default function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm] = Form.useForm();

  // Role assignment modal
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleTargetUser, setRoleTargetUser] = useState<UserRecord | null>(null);
  const [allRoles, setAllRoles] = useState<RoleRecord[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.list({ search: search || undefined, page, pageSize });
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setUsers(data);
        setTotal(data.length);
      } else if (data?.items) {
        setUsers(data.items);
        setTotal(data.total ?? data.items.length);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // --- Create ---
  const handleCreate = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      await userApi.create(values);
      message.success('用户创建成功');
      setCreateOpen(false);
      loadUsers();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '创建用户失败');
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  // --- Edit ---
  const handleEdit = (record: UserRecord) => {
    setEditingUser(record);
    editForm.setFieldsValue({
      displayName: record.displayName,
      email: record.email,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingUser) return;
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      await userApi.update(editingUser.id, values);
      message.success('用户信息已更新');
      setEditOpen(false);
      loadUsers();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '更新用户信息失败');
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- Role assignment ---
  const handleRoleAssign = async (record: UserRecord) => {
    setRoleTargetUser(record);
    setSelectedRoleIds(record.roles?.map((r) => r.id) || []);
    // Load all roles
    try {
      const res = await roleApi.list();
      const data = res.data?.data || res.data;
      setAllRoles(Array.isArray(data) ? data : data?.items || []);
    } catch {
      message.error('加载角色列表失败');
    }
    setRoleOpen(true);
  };

  const handleRoleSubmit = async () => {
    if (!roleTargetUser) return;
    try {
      setRoleSubmitting(true);
      await userApi.assignRoles(roleTargetUser.id, selectedRoleIds);
      message.success('角色分配成功');
      setRoleOpen(false);
      loadUsers();
    } catch {
      message.error('角色分配失败');
    } finally {
      setRoleSubmitting(false);
    }
  };

  // --- Status toggle ---
  const handleToggleStatus = async (record: UserRecord) => {
    const newStatus = record.status === 'active' ? 'disabled' : 'active';
    try {
      await userApi.update(record.id, { status: newStatus });
      message.success(newStatus === 'active' ? '已启用' : '已禁用');
      loadUsers();
    } catch {
      message.error('操作失败');
    }
  };

  // --- Delete ---
  const handleDelete = async (record: UserRecord) => {
    try {
      await userApi.delete(record.id);
      message.success('用户已删除');
      loadUsers();
    } catch {
      message.error('删除失败');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns: ColumnsType<UserRecord> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '显示名',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 120,
      render: (val) => val || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      render: (val) => val || '-',
    },
    {
      title: '角色',
      key: 'roles',
      width: 160,
      render: (_, record) =>
        record.roles?.length > 0
          ? record.roles.map((r) => (
              <Tag key={r.id} color="blue">
                {r.name}
              </Tag>
            ))
          : <Tag>无角色</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status === 'active' ? '启用' : '禁用'}
        />
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 160,
      render: (val) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => {
        const isSelf = record.id === currentUser?.id;
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<UserSwitchOutlined />}
              onClick={() => handleRoleAssign(record)}
            >
              角色
            </Button>
            <Popconfirm
              title={record.status === 'active' ? '确认禁用该用户？' : '确认启用该用户？'}
              onConfirm={() => handleToggleStatus(record)}
              okText="确认"
              cancelText="取消"
              disabled={isSelf}
            >
              <Button type="link" size="small" disabled={isSelf}>
                {record.status === 'active' ? '禁用' : '启用'}
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认删除该用户？此操作不可恢复。"
              onConfirm={() => handleDelete(record)}
              okText="确认"
              cancelText="取消"
              disabled={isSelf}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={isSelf}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
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
            <h1 className="text-xl font-semibold text-accent-800">用户管理</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理系统用户账号、角色分配和访问控制
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建用户
          </Button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <Input.Search
            placeholder="搜索用户名、显示名或邮箱..."
            allowClear
            onSearch={(val) => {
              setPage(1);
              setSearch(val);
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setPage(1);
                setSearch('');
              }
            }}
            style={{ maxWidth: 360 }}
          />
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 个用户`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 960 }}
        />
      </motion.div>

      {/* Create Modal */}
      <Modal
        title="新建用户"
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
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 个字符' },
            ]}
          >
            <Input placeholder="输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少 6 个字符' },
            ]}
          >
            <Input.Password placeholder="输入密码" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="输入显示名称（可选）" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="输入邮箱地址（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑用户"
        open={editOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={editSubmitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item label="用户名">
            <Input value={editingUser?.username} disabled />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="输入显示名称" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="输入邮箱地址" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Role Assignment Modal */}
      <Modal
        title={`分配角色 — ${roleTargetUser?.displayName || roleTargetUser?.username}`}
        open={roleOpen}
        onOk={handleRoleSubmit}
        onCancel={() => setRoleOpen(false)}
        confirmLoading={roleSubmitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <div className="mt-4">
          <Checkbox.Group
            value={selectedRoleIds}
            onChange={(vals) => setSelectedRoleIds(vals as string[])}
          >
            <div className="space-y-2">
              {allRoles.map((role) => (
                <div key={role.id}>
                  <Checkbox value={role.id}>
                    {role.name} <span className="text-accent-500 text-xs">({role.code})</span>
                  </Checkbox>
                </div>
              ))}
            </div>
          </Checkbox.Group>
          {allRoles.length === 0 && (
            <p className="text-accent-500 text-sm">暂无可用角色</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
