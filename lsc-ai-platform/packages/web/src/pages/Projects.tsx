import { Button, Card, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

/**
 * 项目管理页面
 * TODO: 实现完整功能
 */
export default function ProjectsPage() {
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
              管理你的项目，项目内的对话可以共享文件
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />}>
            新建项目
          </Button>
        </div>

        {/* 项目列表 */}
        <Card className="shadow-sm">
          <Empty
            description="暂无项目"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary">创建第一个项目</Button>
          </Empty>
        </Card>
      </motion.div>
    </div>
  );
}
