import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../services/api';

interface LoginFormData {
  username: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (values: LoginFormData) => {
    setLoading(true);
    try {
      const response = await authApi.login(values.username, values.password);
      const { user, accessToken, refreshToken } = response.data;

      setAuth({ user, accessToken, refreshToken });
      message.success('登录成功');
      navigate('/chat');
    } catch (error: any) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4" data-theme="default">
      {/* 主题背景 */}
      <div className="theme-background" />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-primary)] mb-4 shadow-[0_4px_16px_rgba(0,113,227,0.4)]"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <span className="text-white font-bold text-2xl">AI</span>
          </motion.div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
            LSC-AI
          </h1>
          <p className="text-[var(--text-secondary)]">
            企业级智能工作平台
          </p>
        </div>

        {/* 登录表单 - 玻璃效果 */}
        <motion.div
          className={clsx(
            'glass-panel rounded-2xl p-8',
            'border border-[var(--border-light)]',
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Form
            name="login"
            onFinish={handleSubmit}
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined className="text-[var(--text-tertiary)]" />}
                placeholder="用户名"
                className="h-11"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-[var(--text-tertiary)]" />}
                placeholder="密码"
                className="h-11"
              />
            </Form.Item>

            <Form.Item className="mb-0 mt-6">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="h-11 font-medium"
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </motion.div>

        {/* 底部信息 */}
        <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
          默认账户: admin / Admin@123
        </p>
      </motion.div>
    </div>
  );
}
