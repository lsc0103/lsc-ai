import { Card, Form, Input, Button, Switch, Divider, message } from 'antd';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth';

/**
 * 设置页面
 * TODO: 实现完整功能
 */
export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);

  const handleSave = () => {
    message.success('设置已保存');
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
          <Form layout="vertical">
            <Form.Item label="用户名">
              <Input value={user?.username} disabled />
            </Form.Item>
            <Form.Item label="显示名称">
              <Input defaultValue={user?.displayName} placeholder="输入显示名称" />
            </Form.Item>
            <Form.Item label="邮箱">
              <Input defaultValue={user?.email} placeholder="输入邮箱地址" />
            </Form.Item>
          </Form>
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
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button type="primary" onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
