import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Table,
  Button,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Badge,
  Space,
  Popconfirm,
  Drawer,
  Tooltip,
  Skeleton,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  HistoryOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import {
  workflowApi,
  type ScheduledTask,
  type TaskLog,
  type RpaFlow,
  type RpaFlowDef,
} from '../services/workflow-api';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// ==================== Helpers ====================

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function describeCron(expr: string): string {
  if (!expr) return '';
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, day, month, weekday] = parts;

  if (min === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*')
    return '每分钟';
  if (min === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*')
    return '每小时整点';
  if (min.startsWith('*/')) {
    const n = min.slice(2);
    if (hour === '*' && day === '*' && month === '*' && weekday === '*')
      return `每 ${n} 分钟`;
  }
  if (hour.startsWith('*/')) {
    const n = hour.slice(2);
    if (min === '0' && day === '*' && month === '*' && weekday === '*')
      return `每 ${n} 小时`;
  }
  if (day === '*' && month === '*' && weekday === '*' && /^\d+$/.test(min) && /^\d+$/.test(hour))
    return `每天 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (day === '*' && month === '*' && weekday === '1-5' && /^\d+$/.test(min) && /^\d+$/.test(hour))
    return `工作日 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (day === '*' && month === '*' && weekday === '0,6' && /^\d+$/.test(min) && /^\d+$/.test(hour))
    return `周末 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (/^\d+$/.test(day) && month === '*' && weekday === '*' && /^\d+$/.test(min) && /^\d+$/.test(hour))
    return `每月 ${day} 日 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return expr;
}

const DEFAULT_FLOW_DATA = JSON.stringify(
  {
    steps: [
      { id: 'step-1', type: 'ai_chat', config: { prompt: '' } },
    ],
    variables: {},
  },
  null,
  2,
);

// ==================== Main Page ====================

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState('scheduled');

  return (
    <div className="h-full overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-accent-800">RPA/定时任务</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理自动化流程和定时任务
            </p>
          </div>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'scheduled',
              label: '定时任务',
              children: <ScheduledTaskTab />,
            },
            {
              key: 'rpa',
              label: 'RPA 流程',
              children: <RpaFlowTab />,
            },
          ]}
        />
      </motion.div>
    </div>
  );
}

// ==================== Tab 1: Scheduled Tasks ====================

function ScheduledTaskTab() {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Log drawer
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logTask, setLogTask] = useState<ScheduledTask | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // RPA flows for task config select
  const [rpaFlows, setRpaFlows] = useState<RpaFlow[]>([]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.tasks.list();
      const raw: any = res.data;
      const data = raw?.data || raw;
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      message.error('加载定时任务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load RPA flows for task config
  const loadRpaFlows = useCallback(async () => {
    try {
      const res = await workflowApi.rpa.list();
      const raw: any = res.data;
      const data = raw?.data || raw;
      setRpaFlows(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, []);

  // --- Create / Edit ---
  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({ taskType: 'prompt', status: 'active' });
    loadRpaFlows();
    setModalOpen(true);
  };

  const handleEdit = (record: ScheduledTask) => {
    setEditingTask(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      cronExpr: record.cronExpr,
      taskType: record.taskType,
      taskConfig: record.taskType === 'prompt'
        ? record.taskConfig?.prompt || ''
        : record.taskConfig?.rpaFlowId || '',
      status: record.status,
    });
    loadRpaFlows();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const taskConfig = values.taskType === 'prompt'
        ? { prompt: values.taskConfig }
        : { rpaFlowId: values.taskConfig };

      const payload = {
        name: values.name,
        description: values.description,
        cronExpr: values.cronExpr,
        taskType: values.taskType,
        taskConfig,
        status: values.status,
      };

      if (editingTask) {
        await workflowApi.tasks.update(editingTask.id, payload);
        message.success('任务已更新');
      } else {
        await workflowApi.tasks.create(payload);
        message.success('任务已创建');
      }
      setModalOpen(false);
      loadTasks();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Toggle status ---
  const handleToggleStatus = async (record: ScheduledTask) => {
    const newStatus = record.status === 'active' ? 'paused' : 'active';
    try {
      await workflowApi.tasks.update(record.id, { status: newStatus });
      message.success(newStatus === 'active' ? '任务已启用' : '任务已暂停');
      loadTasks();
    } catch {
      message.error('操作失败');
    }
  };

  // --- Execute ---
  const handleExecute = async (record: ScheduledTask) => {
    try {
      await workflowApi.tasks.execute(record.id);
      message.success('任务已触发执行');
    } catch {
      message.error('执行失败');
    }
  };

  // --- Delete ---
  const handleDelete = async (record: ScheduledTask) => {
    try {
      await workflowApi.tasks.delete(record.id);
      message.success('任务已删除');
      loadTasks();
    } catch {
      message.error('删除失败');
    }
  };

  // --- Logs ---
  const loadLogs = useCallback(async (taskId: string) => {
    setLogsLoading(true);
    try {
      const res = await workflowApi.tasks.getLogs(taskId);
      const raw: any = res.data;
      const data = raw?.data || raw;
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      message.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const handleShowLogs = (record: ScheduledTask) => {
    setLogTask(record);
    setLogDrawerOpen(true);
    loadLogs(record.id);

    // Start polling for running tasks
    if (logPollingRef.current) clearInterval(logPollingRef.current);
    logPollingRef.current = setInterval(() => {
      loadLogs(record.id);
    }, 5000);
  };

  const handleCloseLogDrawer = () => {
    setLogDrawerOpen(false);
    setLogTask(null);
    setLogs([]);
    if (logPollingRef.current) {
      clearInterval(logPollingRef.current);
      logPollingRef.current = null;
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (logPollingRef.current) clearInterval(logPollingRef.current);
    };
  }, []);

  const taskTypeWatch = Form.useWatch('taskType', form);
  const cronExprWatch = Form.useWatch('cronExpr', form);

  const columns: ColumnsType<ScheduledTask> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cronExpr',
      key: 'cronExpr',
      width: 160,
      render: (val: string) => (
        <Tooltip title={describeCron(val)}>
          <code style={{ fontFamily: 'monospace' }}>{val}</code>
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 100,
      render: (val: string) => (
        <Tag color={val === 'prompt' ? 'blue' : 'green'}>
          {val === 'prompt' ? 'AI Prompt' : 'RPA'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const map: Record<string, { status: 'success' | 'warning' | 'error'; text: string }> = {
          active: { status: 'success', text: '运行中' },
          paused: { status: 'warning', text: '已暂停' },
          disabled: { status: 'error', text: '已禁用' },
        };
        const info = map[status] || { status: 'default' as any, text: status };
        return <Badge status={info.status} text={info.text} />;
      },
    },
    {
      title: '上次执行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 150,
      render: (val) => formatDate(val),
    },
    {
      title: '下次执行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 150,
      render: (val) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
          >
            执行
          </Button>
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
            icon={record.status === 'active' ? <PauseCircleOutlined /> : <CaretRightOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? '暂停' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleShowLogs(record)}
          >
            日志
          </Button>
          <Popconfirm
            title="确认删除该任务？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建定时任务
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个任务` }}
        scroll={{ x: 1090 }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingTask ? '编辑定时任务' : '新建定时任务'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingTask ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="输入任务名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="输入任务描述（可选）" rows={2} />
          </Form.Item>
          <Form.Item
            name="cronExpr"
            label="Cron 表达式"
            rules={[{ required: true, message: '请输入 Cron 表达式' }]}
            extra={cronExprWatch ? describeCron(cronExprWatch) : '例如：0 8 * * * (每天08:00)'}
          >
            <Input placeholder="* * * * *" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item
            name="taskType"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select
              options={[
                { label: 'AI Prompt', value: 'prompt' },
                { label: 'RPA 流程', value: 'rpa' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="taskConfig"
            label={taskTypeWatch === 'rpa' ? '选择 RPA 流程' : 'AI Prompt'}
            rules={[{ required: true, message: taskTypeWatch === 'rpa' ? '请选择流程' : '请输入 Prompt' }]}
          >
            {taskTypeWatch === 'rpa' ? (
              <Select
                placeholder="选择已有 RPA 流程"
                options={rpaFlows.map((f) => ({ label: f.name, value: f.id }))}
              />
            ) : (
              <Input.TextArea placeholder="输入 AI Prompt" rows={4} />
            )}
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { label: '运行中', value: 'active' },
                { label: '暂停', value: 'paused' },
                { label: '禁用', value: 'disabled' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Log Drawer */}
      <TaskLogDrawer
        open={logDrawerOpen}
        task={logTask}
        logs={logs}
        loading={logsLoading}
        onClose={handleCloseLogDrawer}
      />
    </>
  );
}

// ==================== Tab 2: RPA Flows ====================

function RpaFlowTab() {
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState<RpaFlow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<RpaFlow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [flowJson, setFlowJson] = useState(DEFAULT_FLOW_DATA);

  // Execute modal
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [execFlow, setExecFlow] = useState<RpaFlow | null>(null);
  const [execInputData, setExecInputData] = useState('');
  const [execSubmitting, setExecSubmitting] = useState(false);
  const [execResult, setExecResult] = useState<{ status: string; result?: any; error?: string } | null>(null);

  const loadFlows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.rpa.list();
      const raw: any = res.data;
      const data = raw?.data || raw;
      setFlows(Array.isArray(data) ? data : []);
    } catch {
      message.error('加载 RPA 流程列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // --- Create / Edit ---
  const handleCreate = () => {
    setEditingFlow(null);
    form.resetFields();
    form.setFieldsValue({ status: 'draft' });
    setFlowJson(DEFAULT_FLOW_DATA);
    setModalOpen(true);
  };

  const handleEdit = (record: RpaFlow) => {
    setEditingFlow(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      status: record.status,
    });
    setFlowJson(
      typeof record.flowData === 'string'
        ? record.flowData
        : JSON.stringify(record.flowData, null, 2),
    );
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      let flowData: RpaFlowDef;
      try {
        flowData = JSON.parse(flowJson);
      } catch {
        message.error('流程定义 JSON 格式错误');
        setSubmitting(false);
        return;
      }

      const payload = {
        name: values.name,
        description: values.description,
        flowData,
        status: values.status,
      };

      if (editingFlow) {
        await workflowApi.rpa.update(editingFlow.id, payload);
        message.success('流程已更新');
      } else {
        await workflowApi.rpa.create(payload);
        message.success('流程已创建');
      }
      setModalOpen(false);
      loadFlows();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.response?.data?.message || '操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Execute ---
  const handleExecuteOpen = (record: RpaFlow) => {
    setExecFlow(record);
    setExecInputData('');
    setExecResult(null);
    setExecModalOpen(true);
  };

  const handleExecuteSubmit = async () => {
    if (!execFlow) return;
    try {
      setExecSubmitting(true);
      let inputData: Record<string, any> | undefined;
      if (execInputData.trim()) {
        try {
          inputData = JSON.parse(execInputData);
        } catch {
          message.error('输入数据 JSON 格式错误');
          setExecSubmitting(false);
          return;
        }
      }
      const res = await workflowApi.rpa.execute(execFlow.id, inputData);
      const raw: any = res.data;
      const result = raw?.data || raw;
      setExecResult(result);
      message.success('流程已触发执行');
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || '执行失败';
      setExecResult({ status: 'failed', error: errMsg });
      message.error(errMsg);
    } finally {
      setExecSubmitting(false);
    }
  };

  // --- Delete ---
  const handleDelete = async (record: RpaFlow) => {
    try {
      await workflowApi.rpa.delete(record.id);
      message.success('流程已删除');
      loadFlows();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<RpaFlow> = [
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
      width: 200,
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const map: Record<string, { color?: string; text: string }> = {
          draft: { text: '草稿' },
          active: { color: 'green', text: '启用' },
          disabled: { color: 'red', text: '禁用' },
        };
        const info = map[status] || { text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '步骤数',
      key: 'stepCount',
      width: 80,
      render: (_, record) => record.flowData?.steps?.length ?? 0,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (val) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecuteOpen(record)}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该流程？"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建 RPA 流程
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={flows}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个流程` }}
        scroll={{ x: 880 }}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingFlow ? '编辑 RPA 流程' : '新建 RPA 流程'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingFlow ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="输入流程名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="输入流程描述（可选）" rows={2} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { label: '草稿', value: 'draft' },
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item label="流程定义 (JSON)">
            <div style={{ border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Suspense fallback={<Skeleton.Input active block style={{ height: 300 }} />}>
                <MonacoEditor
                  height={300}
                  language="json"
                  value={flowJson}
                  onChange={(val) => setFlowJson(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </Suspense>
            </div>
            <div className="text-xs text-accent-500 mt-2">
              步骤类型: ai_chat | shell_command | web_fetch | file_operation | condition | loop
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Execute Modal */}
      <Modal
        title={`执行流程: ${execFlow?.name || ''}`}
        open={execModalOpen}
        onOk={handleExecuteSubmit}
        onCancel={() => setExecModalOpen(false)}
        confirmLoading={execSubmitting}
        okText="执行"
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <div className="mt-4">
          <div className="mb-2 font-medium">输入数据 (JSON, 可选)</div>
          <Input.TextArea
            value={execInputData}
            onChange={(e) => setExecInputData(e.target.value)}
            placeholder='{"key": "value"}'
            rows={4}
            style={{ fontFamily: 'monospace' }}
          />
          {execResult && (
            <div className="mt-4 p-3 rounded" style={{ background: '#f5f5f5' }}>
              <div className="font-medium mb-1">
                执行结果:
                <Badge
                  className="ml-2"
                  status={execResult.status === 'success' ? 'success' : execResult.status === 'failed' ? 'error' : 'processing'}
                  text={execResult.status}
                />
              </div>
              {execResult.result && (
                <pre className="text-xs mt-1 overflow-auto" style={{ maxHeight: 200 }}>
                  {JSON.stringify(execResult.result, null, 2)}
                </pre>
              )}
              {execResult.error && (
                <div className="text-red-500 text-sm mt-1">{execResult.error}</div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ==================== T4: Task Log Drawer ====================

interface TaskLogDrawerProps {
  open: boolean;
  task: ScheduledTask | null;
  logs: TaskLog[];
  loading: boolean;
  onClose: () => void;
}

function TaskLogDrawer({ open, task, logs, loading, onClose }: TaskLogDrawerProps) {
  const logColumns: ColumnsType<TaskLog> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { status: 'processing' | 'success' | 'error' | 'default'; text: string }> = {
          running: { status: 'processing', text: '运行中' },
          success: { status: 'success', text: '成功' },
          failed: { status: 'error', text: '失败' },
          cancelled: { status: 'default', text: '已取消' },
        };
        const info = map[status] || { status: 'default' as const, text: status };
        return <Badge status={info.status} text={info.text} />;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 150,
      render: (val) => formatDate(val),
    },
    {
      title: '结束时间',
      dataIndex: 'endedAt',
      key: 'endedAt',
      width: 150,
      render: (val) => formatDate(val),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 80,
      render: (_, record) => {
        if (!record.startedAt || !record.endedAt) return '-';
        const ms = new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime();
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
      },
    },
  ];

  return (
    <Drawer
      title={`任务日志: ${task?.name || ''}`}
      open={open}
      onClose={onClose}
      width={600}
      destroyOnClose
    >
      <Table
        columns={logColumns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        expandable={{
          expandedRowRender: (record) => (
            <div className="p-2">
              {record.error && (
                <div className="text-red-500 text-sm mb-2">
                  <strong>错误:</strong> {record.error}
                </div>
              )}
              {record.result && (
                <pre className="text-xs overflow-auto" style={{ maxHeight: 300, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(record.result, null, 2)}
                </pre>
              )}
              {!record.error && !record.result && (
                <span className="text-accent-500 text-sm">暂无详细信息</span>
              )}
            </div>
          ),
          rowExpandable: (record) => !!(record.result || record.error),
        }}
      />
    </Drawer>
  );
}
