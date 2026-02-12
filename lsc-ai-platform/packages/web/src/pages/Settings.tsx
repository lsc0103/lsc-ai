import { useState } from 'react';
import { Card, Form, Input, Button, Switch, Divider, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth';
import { userApi } from '../services/api';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 修改密码
  const [pwdForm] = Form.useForm();
  const [changingPwd, setChangingPwd] = useState(false);

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

        {/* 偏好设置 */}
        <Card title="偏好设置" className="shadow-sm mb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">深色模式</div>
                <div className="text-sm text-accent-500">启用深色主题</div>
              </div>
              <Switch disabled />
            </div>
            <Divider className="my-4" />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-accent-700">消息通知</div>
                <div className="text-sm text-accent-500">接收任务完成通知</div>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
