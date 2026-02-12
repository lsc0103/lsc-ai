import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Switch,
  Divider,
  Table,
  Modal,
  Select,
  Tag,
  Space,
  Popconfirm,
  message,
} from 'antd';
import {
  LockOutlined,
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
  ApiOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth';
import api, { userApi } from '../services/api';
import { connectorApi, type Connector } from '../services/connector-api';

interface NotifyPrefs {
  email?: string;
  taskComplete?: boolean;
  taskFailed?: boolean;
  alertTriggered?: boolean;
  reportGenerated?: boolean;
  systemEvent?: boolean;
  weeklyDigest?: boolean;
}

const notifyApi = {
  getPrefs: () => api.get('/notifications/prefs'),
  updatePrefs: (data: Partial<NotifyPrefs>) => api.patch('/notifications/prefs', data),
};

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 修改密码
  const [pwdForm] = Form.useForm();
  const [changingPwd, setChangingPwd] = useState(false);

  // 数据源连接
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addingConnector, setAddingConnector] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  // 通知偏好
  const [notifyPrefs, setNotifyPrefs] = useState<NotifyPrefs>({});
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');

  const loadNotifyPrefs = useCallback(async () => {
    try {
      setLoadingPrefs(true);
      const res = await notifyApi.getPrefs();
      const data = res.data?.data || res.data || {};
      setNotifyPrefs(data as NotifyPrefs);
      setNotifyEmail((data as NotifyPrefs).email || user?.email || '');
    } catch {
      // silently fail
    } finally {
      setLoadingPrefs(false);
    }
  }, [user?.email]);

  const handleNotifyToggle = async (key: keyof NotifyPrefs, checked: boolean) => {
    try {
      setSavingPrefs(true);
      const res = await notifyApi.updatePrefs({ [key]: checked });
      const data = res.data?.data || res.data || {};
      setNotifyPrefs(data as NotifyPrefs);
      message.success('通知设置已更新');
    } catch {
      message.error('更新通知设置失败');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleNotifyEmailSave = async () => {
    if (!notifyEmail) {
      message.warning('请输入通知邮箱');
      return;
    }
    try {
      setSavingPrefs(true);
      const res = await notifyApi.updatePrefs({ email: notifyEmail });
      const data = res.data?.data || res.data || {};
      setNotifyPrefs(data as NotifyPrefs);
      message.success('通知邮箱已更新');
    } catch {
      message.error('更新通知邮箱失败');
    } finally {
      setSavingPrefs(false);
    }
  };

  const loadConnectors = useCallback(async () => {
    try {
      setLoadingConnectors(true);
      const res = await connectorApi.list();
      const data = res.data?.data || res.data;
      setConnectors(Array.isArray(data) ? data : []);
    } catch {
      // silently fail
    } finally {
      setLoadingConnectors(false);
    }
  }, []);

  useEffect(() => {
    loadConnectors();
    loadNotifyPrefs();
  }, [loadConnectors, loadNotifyPrefs]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await userApi.update(user.id, {
        displayName: values.displayName,
        email: values.email,
      });
      const updated = res.data?.data || res.data;
      if (updated) {
        setUser({
          ...user,
          displayName: updated.displayName ?? values.displayName,
          email: updated.email ?? values.email,
        });
      }
      message.success('设置已保存');
    } catch (error: any) {
      message.error(error?.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      setChangingPwd(true);
      await userApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功，下次登录请使用新密码');
      pwdForm.resetFields();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '密码修改失败');
      }
    } finally {
      setChangingPwd(false);
    }
  };

  const handleAddConnector = async () => {
    try {
      const values = await addForm.validateFields();
      setAddingConnector(true);
      await connectorApi.create(values);
      message.success('数据源连接已创建');
      setAddModalOpen(false);
      addForm.resetFields();
      loadConnectors();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '创建失败');
      }
    } finally {
      setAddingConnector(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await connectorApi.test(id);
      const result = res.data?.data || res.data;
      setTestResults((prev) => ({ ...prev, [id]: result }));
      if (result.success) {
        message.success('连接成功');
      } else {
        message.error(`连接失败: ${result.error}`);
      }
    } catch (error: any) {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, error: '请求失败' } }));
      message.error('测试请求失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConnector = async (id: string) => {
    try {
      await connectorApi.delete(id);
      message.success('已删除');
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadConnectors();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败');
    }
  };

  const connectorColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'db_mysql' ? 'blue' : 'green'}>
          {type === 'db_mysql' ? 'MySQL' : 'PostgreSQL'}
        </Tag>
      ),
    },
    {
      title: '主机',
      key: 'host',
      render: (_: any, record: Connector) =>
        `${record.host || '-'}:${record.port || '-'}`,
    },
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Connector) => {
        const result = testResults[record.id];
        if (!result) return <Tag>未测试</Tag>;
        return result.success ? (
          <Tag color="success">连接正常</Tag>
        ) : (
          <Tag color="error">连接失败</Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Connector) => (
        <Space size="small">
          <Button
            size="small"
            icon={<ApiOutlined />}
            loading={testingId === record.id}
            onClick={() => handleTestConnection(record.id)}
          >
            测试
          </Button>
          <Popconfirm
            title="确认删除此连接？"
            onConfirm={() => handleDeleteConnector(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
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
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-accent-800">设置</h1>
          <p className="text-sm text-accent-500 mt-1">
            管理你的账户和偏好设置
          </p>
        </div>

        {/* 个人信息 */}
        <Card title="个人信息" className="shadow-sm mb-4">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              displayName: user?.displayName,
              email: user?.email,
            }}
          >
            <Form.Item label="用户名">
              <Input value={user?.username} disabled />
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
          <div className="flex justify-end">
            <Button type="primary" onClick={handleSave} loading={saving}>
              保存信息
            </Button>
          </div>
        </Card>

        {/* 修改密码 */}
        <Card
          title={<span><LockOutlined className="mr-2" />修改密码</span>}
          className="shadow-sm mb-4"
        >
          <Form form={pwdForm} layout="vertical">
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="输入当前密码" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, message: '新密码至少 8 个字符' },
              ]}
            >
              <Input.Password placeholder="输入新密码（至少 8 个字符）" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>
          </Form>
          <div className="flex justify-end">
            <Button type="primary" onClick={handleChangePassword} loading={changingPwd}>
              修改密码
            </Button>
          </div>
        </Card>

        {/* 数据源连接 */}
        <Card
          title={<span><DatabaseOutlined className="mr-2" />数据源连接</span>}
          className="shadow-sm mb-4"
          extra={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
            >
              添加连接
            </Button>
          }
        >
          <Table
            dataSource={connectors}
            columns={connectorColumns}
            rowKey="id"
            size="small"
            loading={loadingConnectors}
            pagination={false}
            locale={{ emptyText: '暂无数据源连接' }}
          />
        </Card>

        {/* 通知设置 */}
        <Card
          title={<span><BellOutlined className="mr-2" />通知设置</span>}
          className="shadow-sm mb-4"
          loading={loadingPrefs}
        >
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="通知邮箱地址"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                style={{ maxWidth: 320 }}
              />
              <Button
                type="primary"
                size="small"
                onClick={handleNotifyEmailSave}
                loading={savingPrefs}
              >
                保存邮箱
              </Button>
            </div>
            <div className="text-xs text-accent-400">
              邮件通知将发送到此邮箱。留空则使用账户邮箱。
            </div>
          </div>
          <Divider className="my-3" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">任务完成</div>
                <div className="text-sm text-accent-500">定时任务/RPA 执行成功后通知</div>
              </div>
              <Switch
                checked={notifyPrefs.taskComplete !== false}
                onChange={(checked) => handleNotifyToggle('taskComplete', checked)}
                loading={savingPrefs}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">任务失败</div>
                <div className="text-sm text-accent-500">定时任务/RPA 执行失败后通知</div>
              </div>
              <Switch
                checked={notifyPrefs.taskFailed !== false}
                onChange={(checked) => handleNotifyToggle('taskFailed', checked)}
                loading={savingPrefs}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">系统告警</div>
                <div className="text-sm text-accent-500">Sentinel 监控触发告警时通知</div>
              </div>
              <Switch
                checked={notifyPrefs.alertTriggered !== false}
                onChange={(checked) => handleNotifyToggle('alertTriggered', checked)}
                loading={savingPrefs}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">报告生成</div>
                <div className="text-sm text-accent-500">自动生成报告后发送邮件</div>
              </div>
              <Switch
                checked={notifyPrefs.reportGenerated !== false}
                onChange={(checked) => handleNotifyToggle('reportGenerated', checked)}
                loading={savingPrefs}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">系统事件</div>
                <div className="text-sm text-accent-500">接收系统运维相关通知</div>
              </div>
              <Switch
                checked={notifyPrefs.systemEvent !== false}
                onChange={(checked) => handleNotifyToggle('systemEvent', checked)}
                loading={savingPrefs}
              />
            </div>
            <Divider className="my-2" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">周报摘要</div>
                <div className="text-sm text-accent-500">每周一发送上周任务和告警汇总（默认关闭）</div>
              </div>
              <Switch
                checked={notifyPrefs.weeklyDigest === true}
                onChange={(checked) => handleNotifyToggle('weeklyDigest', checked)}
                loading={savingPrefs}
              />
            </div>
          </div>
        </Card>

        {/* 偏好设置 */}
        <Card title="偏好设置" className="shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-accent-700">深色模式</div>
              <div className="text-sm text-accent-500">启用深色主题（即将支持）</div>
            </div>
            <Switch disabled />
          </div>
        </Card>
      </motion.div>

      {/* 添加连接 Modal */}
      <Modal
        title="添加数据源连接"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          addForm.resetFields();
        }}
        onOk={handleAddConnector}
        confirmLoading={addingConnector}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={addForm}
          layout="vertical"
          initialValues={{ type: 'db_mysql', port: 3306 }}
        >
          <Form.Item
            name="name"
            label="连接名称"
            rules={[{ required: true, message: '请输入连接名称' }]}
          >
            <Input placeholder="例如：生产数据库" />
          </Form.Item>
          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select
              onChange={(val) => {
                addForm.setFieldsValue({
                  port: val === 'db_mysql' ? 3306 : 5432,
                });
              }}
            >
              <Select.Option value="db_mysql">MySQL</Select.Option>
              <Select.Option value="db_postgresql">PostgreSQL</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="host"
            label="主机地址"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="例如：192.168.1.100" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="database"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="例如：mydb" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="数据库用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="数据库密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
