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
  Drawer,
  Tooltip,
  Skeleton,
  Statistic,
  Progress,
  Spin,
  message,
  InputNumber,
  Dropdown,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  CaretRightOutlined,
  ReloadOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  MoreOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import {
  workflowApi,
  type ScheduledTask,
  type TaskLog,
  type RpaFlow,
  type RpaFlowDef,
  type DashboardData,
} from '../services/workflow-api';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));
const FlowEditor = lazy(() => import('../components/workflow/FlowEditor'));

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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}毫秒`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  if (secs === 0) return `${mins}分钟`;
  return `${mins}分${secs}秒`;
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

// ==================== CronSchedulePicker ====================

type ScheduleMode = 'daily' | 'workday' | 'weekly' | 'monthly' | 'hourly' | 'interval' | 'custom';

function parseCronMode(cron: string): { mode: ScheduleMode; hour: number; minute: number; weekday: number; monthDay: number; interval: number } {
  const r = { mode: 'daily' as ScheduleMode, hour: 9, minute: 0, weekday: 1, monthDay: 1, interval: 30 };
  if (!cron) return r;
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) { r.mode = 'custom'; return r; }
  const [min, hour, day, , wd] = p;
  if (/^\d+$/.test(min)) r.minute = parseInt(min);
  if (/^\d+$/.test(hour)) r.hour = parseInt(hour);
  if (min.startsWith('*/')) { r.mode = 'interval'; r.interval = parseInt(min.slice(2)); }
  else if (hour === '*' && /^\d+$/.test(min)) { r.mode = 'hourly'; }
  else if (day === '*' && wd === '1-5') r.mode = 'workday';
  else if (day === '*' && /^\d$/.test(wd)) { r.mode = 'weekly'; r.weekday = parseInt(wd); }
  else if (/^\d+$/.test(day) && wd === '*') { r.mode = 'monthly'; r.monthDay = parseInt(day); }
  else if (day === '*' && wd === '*') r.mode = 'daily';
  else r.mode = 'custom';
  return r;
}

function CronSchedulePicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const parsed = parseCronMode(value || '');
  const [mode, setMode] = useState<ScheduleMode>(parsed.mode);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekday, setWeekday] = useState(parsed.weekday);
  const [monthDay, setMonthDay] = useState(parsed.monthDay);
  const [interval, setInterval_] = useState(parsed.interval);
  const [customCron, setCustomCron] = useState(value || '');

  const buildCron = useCallback((m: ScheduleMode, h: number, min: number, wd: number, md: number, iv: number) => {
    switch (m) {
      case 'daily': return `${min} ${h} * * *`;
      case 'workday': return `${min} ${h} * * 1-5`;
      case 'weekly': return `${min} ${h} * * ${wd}`;
      case 'monthly': return `${min} ${h} ${md} * *`;
      case 'hourly': return `${min} * * * *`;
      case 'interval': return `*/${iv} * * * *`;
      default: return '';
    }
  }, []);

  const emitChange = useCallback((m: ScheduleMode, h: number, min: number, wd: number, md: number, iv: number, custom: string) => {
    if (m === 'custom') { onChange?.(custom); }
    else { onChange?.(buildCron(m, h, min, wd, md, iv)); }
  }, [onChange, buildCron]);

  const handleModeChange = (m: ScheduleMode) => { setMode(m); emitChange(m, hour, minute, weekday, monthDay, interval, customCron); };
  const handleHourChange = (v: number) => { setHour(v); emitChange(mode, v, minute, weekday, monthDay, interval, customCron); };
  const handleMinuteChange = (v: number) => { setMinute(v); emitChange(mode, hour, v, weekday, monthDay, interval, customCron); };
  const handleWeekdayChange = (v: number) => { setWeekday(v); emitChange(mode, hour, minute, v, monthDay, interval, customCron); };
  const handleMonthDayChange = (v: number) => { setMonthDay(v); emitChange(mode, hour, minute, weekday, v, interval, customCron); };
  const handleIntervalChange = (v: number | null) => { const val = v || 30; setInterval_(val); emitChange(mode, hour, minute, weekday, monthDay, val, customCron); };
  const handleCustomChange = (v: string) => { setCustomCron(v); onChange?.(v); };

  const previewCron = mode === 'custom' ? customCron : buildCron(mode, hour, minute, weekday, monthDay, interval);
  const previewText = describeCron(previewCron);

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({ label: `${i.toString().padStart(2, '0')}时`, value: i }));
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => ({ label: `${m.toString().padStart(2, '0')}分`, value: m }));

  return (
    <div className="space-y-3">
      <Select value={mode} onChange={handleModeChange} style={{ width: '100%' }} options={[
        { label: '每天定时执行', value: 'daily' },
        { label: '工作日定时执行（周一至周五）', value: 'workday' },
        { label: '每周定时执行', value: 'weekly' },
        { label: '每月定时执行', value: 'monthly' },
        { label: '每小时执行', value: 'hourly' },
        { label: '按间隔执行', value: 'interval' },
        { label: '高级设置（自定义）', value: 'custom' },
      ]} />
      {['daily', 'workday', 'weekly', 'monthly'].includes(mode) && (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>执行时间：</span>
          <Select value={hour} onChange={handleHourChange} style={{ width: 90 }} options={hourOptions} />
          <span>:</span>
          <Select value={minute} onChange={handleMinuteChange} style={{ width: 90 }} options={minuteOptions} />
        </div>
      )}
      {mode === 'weekly' && (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>星期：</span>
          <Select value={weekday} onChange={handleWeekdayChange} style={{ width: 100 }} options={[
            { label: '周一', value: 1 }, { label: '周二', value: 2 }, { label: '周三', value: 3 },
            { label: '周四', value: 4 }, { label: '周五', value: 5 }, { label: '周六', value: 6 }, { label: '周日', value: 0 },
          ]} />
        </div>
      )}
      {mode === 'monthly' && (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>日期：每月</span>
          <Select value={monthDay} onChange={handleMonthDayChange} style={{ width: 90 }}
            options={Array.from({ length: 31 }, (_, i) => ({ label: `${i + 1}日`, value: i + 1 }))} />
        </div>
      )}
      {mode === 'hourly' && (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>每小时第</span>
          <Select value={minute} onChange={handleMinuteChange} style={{ width: 80 }} options={minuteOptions} />
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>执行</span>
        </div>
      )}
      {mode === 'interval' && (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>每隔</span>
          <InputNumber value={interval} onChange={handleIntervalChange} min={1} max={59} style={{ width: 80 }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary, #666)' }}>分钟执行一次</span>
        </div>
      )}
      {mode === 'custom' && (
        <Input value={customCron} onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="分 时 日 月 星期（例: 0 8 * * *）" style={{ fontFamily: 'monospace' }} />
      )}
      {previewText && (
        <div className="text-sm px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary, #666)' }}>
          <CalendarOutlined className="mr-1" /> 预览：{previewText}
        </div>
      )}
    </div>
  );
}

// ==================== ResultDisplay ====================

function ResultDisplay({ result, error }: { result?: any; error?: string }) {
  const [showRaw, setShowRaw] = useState(false);

  if (error) {
    return <Alert type="error" showIcon message="执行失败" description={error} />;
  }
  if (!result) {
    return <span className="text-sm" style={{ color: 'var(--text-tertiary, #999)' }}>暂无结果</span>;
  }

  let displayText = '';
  if (typeof result === 'string') {
    displayText = result;
  } else if (typeof result === 'object') {
    displayText = result.text || result.message || result.summary || result.content || '';
    if (!displayText && result.result) {
      displayText = typeof result.result === 'string' ? result.result : '';
    }
    if (!displayText) {
      displayText = JSON.stringify(result, null, 2);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm whitespace-pre-wrap" style={{ maxHeight: showRaw ? 'none' : 200, overflow: 'auto', lineHeight: 1.6 }}>
        {displayText}
      </div>
      {typeof result === 'object' && (
        <Button type="link" size="small" onClick={() => setShowRaw(!showRaw)} style={{ padding: 0 }}>
          {showRaw ? '收起原始数据' : '查看原始数据'}
        </Button>
      )}
      {showRaw && typeof result === 'object' && (
        <pre className="text-xs overflow-auto p-2 rounded" style={{ maxHeight: 300, background: 'rgba(0,0,0,0.04)' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

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
            <h1 className="text-xl font-semibold text-accent-800">自动化任务中心</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理定时任务和自动化流程，查看执行状态
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
              label: '自动化流程',
              children: <RpaFlowTab />,
            },
            {
              key: 'monitor',
              label: '执行监控',
              children: <ExecutionMonitorTab />,
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
      // 自动打开日志 Drawer 并轮询执行状态
      handleShowLogs(record);
    } catch {
      message.error('执行触发失败');
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
  const prevLogStatusRef = useRef<Record<string, string>>({});

  const loadLogs = useCallback(async (taskId: string) => {
    setLogsLoading(true);
    try {
      const res = await workflowApi.tasks.getLogs(taskId);
      const raw: any = res.data;
      const data = raw?.data || raw;
      const logsList: TaskLog[] = Array.isArray(data) ? data : [];
      setLogs(logsList);

      // Check for completion notifications
      for (const log of logsList) {
        const prevStatus = prevLogStatusRef.current[log.id];
        if (prevStatus === 'running' && log.status !== 'running') {
          if (log.status === 'success') {
            message.success('任务执行完成');
          } else if (log.status === 'failed') {
            message.error(`任务执行失败${log.error ? '：' + log.error : ''}`);
          }
        }
        prevLogStatusRef.current[log.id] = log.status;
      }

      // Auto-stop polling when no recently-started running tasks remain (ignore stuck legacy entries)
      const tenMin = 10 * 60 * 1000;
      const hasRunning = logsList.some(
        (l) => l.status === 'running' && l.startedAt && (Date.now() - new Date(l.startedAt).getTime()) < tenMin,
      );
      if (!hasRunning && logPollingRef.current) {
        clearInterval(logPollingRef.current);
        logPollingRef.current = null;
      }
    } catch {
      message.error('加载执行记录失败');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const handleShowLogs = (record: ScheduledTask) => {
    setLogTask(record);
    setLogDrawerOpen(true);
    prevLogStatusRef.current = {};
    loadLogs(record.id);

    // Start polling
    if (logPollingRef.current) clearInterval(logPollingRef.current);
    logPollingRef.current = setInterval(() => {
      loadLogs(record.id);
    }, 3000);
  };

  const handleCloseLogDrawer = () => {
    setLogDrawerOpen(false);
    setLogTask(null);
    setLogs([]);
    prevLogStatusRef.current = {};
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

  const columns: ColumnsType<ScheduledTask> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (name: string, record) => (
        <div>
          <div className="font-medium">{name}</div>
          {record.description && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary, #999)' }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '执行周期',
      dataIndex: 'cronExpr',
      key: 'cronExpr',
      width: 140,
      render: (val: string) => {
        const desc = describeCron(val);
        return (
          <Tooltip title={`Cron: ${val}`}>
            <span><CalendarOutlined className="mr-1" />{desc}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 110,
      render: (val: string) => (
        <Tag color={val === 'prompt' ? 'blue' : 'green'}>
          {val === 'prompt' ? 'AI 对话' : '自动化流程'}
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
          active: { status: 'success', text: '已启用' },
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
      width: 220,
      render: (_, record) => {
        const moreItems: MenuProps['items'] = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑',
            onClick: () => handleEdit(record),
          },
          {
            key: 'toggle',
            icon: record.status === 'active' ? <PauseCircleOutlined /> : <CaretRightOutlined />,
            label: record.status === 'active' ? '暂停' : '启用',
            onClick: () => handleToggleStatus(record),
          },
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除任务"${record.name}"吗？此操作不可撤销。`,
                okText: '删除',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: () => handleDelete(record),
              });
            },
          },
        ];
        return (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={() => handleExecute(record)}
            >
              立即执行
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleShowLogs(record)}
            >
              执行记录
            </Button>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
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
            <Input placeholder="例如：每日生产报表汇总" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea placeholder="简要描述该任务的用途（可选）" rows={2} />
          </Form.Item>
          <Form.Item
            name="cronExpr"
            label="执行周期"
            rules={[{ required: true, message: '请设置执行周期' }]}
          >
            <CronSchedulePicker />
          </Form.Item>
          <Form.Item
            name="taskType"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select
              options={[
                { label: 'AI 对话任务 — 让 AI 自动执行对话指令', value: 'prompt' },
                { label: '自动化流程 — 执行预定义的多步骤流程', value: 'rpa' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="taskConfig"
            label={taskTypeWatch === 'rpa' ? '选择自动化流程' : '任务内容'}
            rules={[{ required: true, message: taskTypeWatch === 'rpa' ? '请选择流程' : '请输入任务内容' }]}
            extra={taskTypeWatch !== 'rpa' ? '请用自然语言描述你希望 AI 完成的任务' : undefined}
          >
            {taskTypeWatch === 'rpa' ? (
              <Select
                placeholder="选择已创建的自动化流程"
                options={rpaFlows.map((f) => ({ label: f.name, value: f.id }))}
              />
            ) : (
              <Input.TextArea placeholder="例如：汇总今日生产进度数据，生成周报摘要" rows={4} />
            )}
          </Form.Item>
          <Form.Item
            name="status"
            label="初始状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { label: '启用 — 创建后立即按周期执行', value: 'active' },
                { label: '暂停 — 创建后暂不执行', value: 'paused' },
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
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [flowDef, setFlowDef] = useState<RpaFlowDef>(() => JSON.parse(DEFAULT_FLOW_DATA));

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
      message.error('加载自动化流程列表失败');
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
    const defaultDef = JSON.parse(DEFAULT_FLOW_DATA);
    setFlowJson(DEFAULT_FLOW_DATA);
    setFlowDef(defaultDef);
    setEditorMode('visual');
    setModalOpen(true);
  };

  const handleEdit = (record: RpaFlow) => {
    setEditingFlow(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      status: record.status,
    });
    const jsonStr = typeof record.flowData === 'string'
      ? record.flowData
      : JSON.stringify(record.flowData, null, 2);
    setFlowJson(jsonStr);
    try {
      setFlowDef(typeof record.flowData === 'string' ? JSON.parse(record.flowData) : record.flowData);
    } catch {
      setFlowDef({ steps: [], variables: {} });
    }
    setEditorMode('visual');
    setModalOpen(true);
  };

  // Sync between visual and JSON modes
  const switchEditorMode = (mode: 'visual' | 'json') => {
    if (mode === 'json') {
      // Visual -> JSON: serialize current flowDef
      setFlowJson(JSON.stringify(flowDef, null, 2));
    } else {
      // JSON -> Visual: parse JSON into flowDef
      try {
        setFlowDef(JSON.parse(flowJson));
      } catch {
        message.warning('JSON 格式错误，无法切换到可视化模式');
        return;
      }
    }
    setEditorMode(mode);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      let flowData: RpaFlowDef;
      if (editorMode === 'visual') {
        flowData = flowDef;
      } else {
        try {
          flowData = JSON.parse(flowJson);
        } catch {
          message.error('流程定义 JSON 格式错误');
          setSubmitting(false);
          return;
        }
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
      title: '流程名称',
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
          active: { color: 'green', text: '已启用' },
          disabled: { color: 'red', text: '已禁用' },
        };
        const info = map[status] || { text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '步骤数',
      key: 'stepCount',
      width: 80,
      render: (_, record) => `${record.flowData?.steps?.length ?? 0} 步`,
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
      width: 220,
      render: (_, record) => {
        const moreItems: MenuProps['items'] = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑流程',
            onClick: () => handleEdit(record),
          },
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除流程"${record.name}"吗？此操作不可撤销。`,
                okText: '删除',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: () => handleDelete(record),
              });
            },
          },
        ];
        return (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={() => handleExecuteOpen(record)}
            >
              立即执行
            </Button>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建自动化流程
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
        title={editingFlow ? '编辑自动化流程' : '新建自动化流程'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingFlow ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
        width={960}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="例如：每周生产数据汇总" />
          </Form.Item>
          <Form.Item name="description" label="流程描述">
            <Input.TextArea placeholder="简要描述该流程的用途（可选）" rows={2} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              options={[
                { label: '草稿 — 仅保存，不可被定时任务调用', value: 'draft' },
                { label: '已启用 — 可被定时任务调用', value: 'active' },
                { label: '已禁用 — 暂停使用', value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item label="流程步骤">
            <Tabs
              size="small"
              activeKey={editorMode}
              onChange={(key) => switchEditorMode(key as 'visual' | 'json')}
              items={[
                {
                  key: 'visual',
                  label: '可视化编辑',
                  children: (
                    <Suspense fallback={<Skeleton.Input active block style={{ height: 420 }} />}>
                      <FlowEditor value={flowDef} onChange={setFlowDef} />
                    </Suspense>
                  ),
                },
                {
                  key: 'json',
                  label: '高级编辑',
                  children: (
                    <>
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
                        步骤类型：ai_chat（AI对话）| shell_command（命令执行）| web_fetch（网页请求）| file_operation（文件操作）| sql_query（数据库查询）| send_email（发送邮件）| condition（条件判断）| loop（循环）
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Execute Modal */}
      <Modal
        title={`执行流程：${execFlow?.name || ''}`}
        open={execModalOpen}
        onOk={handleExecuteSubmit}
        onCancel={() => setExecModalOpen(false)}
        confirmLoading={execSubmitting}
        okText="开始执行"
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <div className="mt-4">
          <div className="mb-2 text-sm" style={{ color: 'var(--text-secondary, #666)' }}>
            参数数据（可选，如不需要可留空直接执行）
          </div>
          <Input.TextArea
            value={execInputData}
            onChange={(e) => setExecInputData(e.target.value)}
            placeholder='如需传入参数，请输入，例如：{"数量": 100}'
            rows={3}
            style={{ fontFamily: 'monospace' }}
          />
          {execResult && (
            <div className="mt-4 p-3 rounded" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <div className="font-medium mb-2">
                执行结果：
                <Badge
                  className="ml-2"
                  status={execResult.status === 'success' ? 'success' : execResult.status === 'failed' ? 'error' : 'processing'}
                  text={execResult.status === 'success' ? '成功' : execResult.status === 'failed' ? '失败' : '执行中'}
                />
              </div>
              <ResultDisplay result={execResult.result} error={execResult.error} />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ==================== Tab 3: Execution Monitor ====================

const GLASS_CARD: React.CSSProperties = {
  background: 'var(--glass-bg-medium)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: 16,
};

function ExecutionMonitorTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workflowApi.dashboard();
      const raw: any = res.data;
      setData(raw?.data || raw);
    } catch {
      message.error('加载监控数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    pollingRef.current = setInterval(loadDashboard, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadDashboard]);

  const chartOption = data ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const },
    legend: {
      data: ['成功', '失败'],
      textStyle: { color: 'rgba(255,255,255,0.65)' },
      top: 0,
    },
    grid: { left: 40, right: 20, top: 36, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: data.trend.labels,
      axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      {
        name: '成功',
        type: 'line' as const,
        data: data.trend.success,
        smooth: true,
        itemStyle: { color: '#52c41a' },
        areaStyle: { color: 'rgba(82,196,26,0.15)' },
      },
      {
        name: '失败',
        type: 'line' as const,
        data: data.trend.failed,
        smooth: true,
        itemStyle: { color: '#f5222d' },
        areaStyle: { color: 'rgba(245,34,45,0.15)' },
      },
    ],
  } : {};

  type RecentLog = DashboardData['recentLogs'][number];

  const recentColumns: ColumnsType<RecentLog> = [
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { status: 'processing' | 'success' | 'error' | 'default'; text: string }> = {
          running: { status: 'processing', text: '执行中' },
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
      width: 160,
      render: (val: string) => formatDate(val),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_: unknown, record: RecentLog) => {
        if (!record.startedAt || !record.endedAt) return record.status === 'running' ? <SyncOutlined spin /> : '-';
        const ms = new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime();
        return formatDuration(ms);
      },
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (val: string | undefined) => val ? <span style={{ color: '#f5222d' }}>{val}</span> : '-',
    },
  ];

  if (!data && loading) {
    return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  }

  return (
    <div>
      {/* 刷新按钮 */}
      <div className="mb-4 flex justify-end">
        <Button icon={<ReloadOutlined />} loading={loading} onClick={loadDashboard}>
          刷新
        </Button>
      </div>

      {/* 队列状态卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div style={GLASS_CARD}>
          <Statistic
            title={<span style={{ color: 'var(--text-tertiary)' }}>等待中</span>}
            value={data?.queue.waiting ?? 0}
            prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{ color: '#1890ff' }}
          />
        </div>
        <div style={GLASS_CARD}>
          <Statistic
            title={<span style={{ color: 'var(--text-tertiary)' }}>执行中</span>}
            value={data?.queue.active ?? 0}
            prefix={<SyncOutlined spin={!!data?.queue.active} style={{ color: '#fa8c16' }} />}
            valueStyle={{ color: '#fa8c16' }}
          />
        </div>
        <div style={GLASS_CARD}>
          <Statistic
            title={<span style={{ color: 'var(--text-tertiary)' }}>已完成（24小时）</span>}
            value={data?.queue.completed ?? 0}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
        </div>
        <div style={GLASS_CARD}>
          <Statistic
            title={<span style={{ color: 'var(--text-tertiary)' }}>失败（24小时）</span>}
            value={data?.queue.failed ?? 0}
            prefix={<CloseCircleOutlined style={{ color: '#f5222d' }} />}
            valueStyle={{ color: '#f5222d' }}
          />
        </div>
      </div>

      {/* 执行趋势 + 运行健康度 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2" style={GLASS_CARD}>
          <div className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            执行趋势（24小时）
          </div>
          {data && (
            <ReactECharts
              option={chartOption}
              style={{ height: 260 }}
              opts={{ renderer: 'canvas' }}
            />
          )}
        </div>
        <div style={GLASS_CARD}>
          <div className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
            运行健康度
          </div>
          <div className="flex flex-col items-center mb-4">
            <Progress
              type="circle"
              percent={data?.health.successRate ?? 0}
              size={100}
              strokeColor="#52c41a"
              trailColor="rgba(255,255,255,0.08)"
              format={(pct) => <span style={{ color: 'var(--text-primary)' }}>{pct}%</span>}
            />
            <span className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>成功率</span>
          </div>
          <div className="space-y-3">
            <Statistic
              title={<span style={{ color: 'var(--text-tertiary)' }}>平均耗时</span>}
              value={data?.health.avgDuration ? formatDuration(data.health.avgDuration) : '-'}
              prefix={<DashboardOutlined />}
              valueStyle={{ color: 'var(--text-primary)', fontSize: 18 }}
            />
            <Statistic
              title={<span style={{ color: 'var(--text-tertiary)' }}>总执行次数</span>}
              value={data?.health.totalExecutions ?? 0}
              valueStyle={{ color: 'var(--text-primary)', fontSize: 18 }}
            />
          </div>
        </div>
      </div>

      {/* 最近执行记录 */}
      <div style={GLASS_CARD}>
        <div className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          最近执行记录
        </div>
        <Table
          columns={recentColumns}
          dataSource={data?.recentLogs ?? []}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      </div>
    </div>
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
  // 只对最近 10 分钟内启动的任务显示"执行中"提示，避免历史残留条目永久显示
  const TEN_MINUTES = 10 * 60 * 1000;
  const hasRecentRunning = logs.some(
    (l) => l.status === 'running' && l.startedAt && (Date.now() - new Date(l.startedAt).getTime()) < TEN_MINUTES,
  );

  const logColumns: ColumnsType<TaskLog> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { status: 'processing' | 'success' | 'error' | 'default'; text: string }> = {
          running: { status: 'processing', text: '执行中' },
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
      width: 100,
      render: (_, record) => {
        if (!record.startedAt || !record.endedAt) return record.status === 'running' ? <SyncOutlined spin /> : '-';
        const ms = new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime();
        return formatDuration(ms);
      },
    },
  ];

  return (
    <Drawer
      title={`执行记录：${task?.name || ''}`}
      open={open}
      onClose={onClose}
      width={640}
      destroyOnClose
    >
      {hasRecentRunning && (
        <Alert
          type="info"
          showIcon
          icon={<SyncOutlined spin />}
          message="任务正在执行中，请稍候..."
          className="mb-4"
        />
      )}
      <Table
        columns={logColumns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        expandable={{
          expandedRowRender: (record) => (
            <div className="p-3">
              <ResultDisplay result={record.result} error={record.error ?? undefined} />
            </div>
          ),
          rowExpandable: (record) => !!(record.result || record.error),
        }}
        locale={{ emptyText: '暂无执行记录' }}
      />
    </Drawer>
  );
}
