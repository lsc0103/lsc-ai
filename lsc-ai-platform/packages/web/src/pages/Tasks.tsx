import { Button, Card, Empty, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

/**
 * RPA/定时任务页面
 * TODO: 实现完整功能
 */
export default function TasksPage() {
  const items = [
    {
      key: 'scheduled',
      label: '定时任务',
      children: (
        <Card className="shadow-sm">
          <Empty
            description="暂无定时任务"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary">创建定时任务</Button>
          </Empty>
        </Card>
      ),
    },
    {
      key: 'rpa',
      label: 'RPA 流程',
      children: (
        <Card className="shadow-sm">
          <Empty
            description="暂无 RPA 流程"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary">创建 RPA 流程</Button>
          </Empty>
        </Card>
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
            <h1 className="text-xl font-semibold text-accent-800">RPA/定时任务</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理自动化流程和定时任务
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />}>
            新建任务
          </Button>
        </div>

        {/* 标签页 */}
        <Tabs items={items} />
      </motion.div>
    </div>
  );
}
