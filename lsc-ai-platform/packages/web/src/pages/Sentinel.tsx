import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Tabs,
  Tag,
  Badge,
  Statistic,
  Card,
  Space,
  Select,
  Drawer,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Empty,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  EditOutlined,
  DeleteOutlined,
  DesktopOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import ReactECharts from 'echarts-for-react';
import {
  sentinelApi,
  type SentinelAgent,
  type AlertRule,
  type AlertHistoryItem,
  type SentinelMetric,
} from '../services/sentinel-api';

dayjs.extend(relativeTime);

// --------------- API Response Unwrap ---------------
// The server may wrap responses in { data: ... } or return directly.
// Axios already wraps in .data, so res.data could be T or { data: T }.
function unwrap<T>(resData: unknown): T {
  if (resData && typeof resData === 'object' && 'data' in resData) {
    return (resData as Record<string, unknown>)['data'] as T;
  }
  return resData as T;
}

// --------------- Condition Display Helpers ---------------

const conditionLabels: Record<string, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  eq: '=',
  neq: '!=',
};

const severityColors: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
};

const statusColors: Record<string, string> = {
  firing: 'red',
  acknowledged: 'gold',
  resolved: 'green',
};

const containerStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'auto',
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--glass-bg-medium)',
  border: '1px solid var(--glass-border)',
  borderRadius: 12,
};

const headerStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
};

// --------------- Main Component ---------------

export default function SentinelPage() {
  const [activeTab, setActiveTab] = useState('agents');
  const [healthLoading, setHealthLoading] = useState(false);
  const [health, setHealth] = useState<{ total: number; online: number; offline: number }>({
    total: 0,
    online: 0,
    offline: 0,
  });
  const [firingCount, setFiringCount] = useState(0);

  // Load health overview
  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await sentinelApi.getHealth();
      setHealth(unwrap<typeof health>(res.data));
    } catch {
      // health is non-critical
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Load firing alert count
  const loadFiringCount = useCallback(async () => {
    try {
      const res = await sentinelApi.listAlerts({ status: 'firing', limit: 1 });
      const payload = unwrap<{ total?: number }>(res.data);
      setFiringCount(payload?.total ?? 0);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadFiringCount();
  }, [loadHealth, loadFiringCount]);

  const handleRefreshAll = () => {
    loadHealth();
    loadFiringCount();
  };

  return (
    <div style={containerStyle}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 className="text-xl font-semibold" style={headerStyle}>
              Sentinel Monitoring Center
            </h1>
            <p className="text-sm mt-1" style={subtitleStyle}>
              Agent monitoring, metrics & alert management
            </p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={handleRefreshAll}>
            Refresh
          </Button>
        </div>

        {/* Overview Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }} loading={healthLoading}>
            <Statistic
              title={<span style={subtitleStyle}>Total Agents</span>}
              value={health.total}
              prefix={<DesktopOutlined style={{ color: 'var(--text-secondary)' }} />}
              valueStyle={{ color: 'var(--text-primary)' }}
            />
          </Card>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }} loading={healthLoading}>
            <Statistic
              title={<span style={subtitleStyle}>Online</span>}
              value={health.online}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }} loading={healthLoading}>
            <Statistic
              title={<span style={subtitleStyle}>Offline</span>}
              value={health.offline}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: health.offline > 0 ? '#ff4d4f' : 'var(--text-primary)' }}
            />
          </Card>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<span style={subtitleStyle}>Active Alerts</span>}
              value={firingCount}
              prefix={<AlertOutlined style={{ color: firingCount > 0 ? '#ff4d4f' : 'var(--text-secondary)' }} />}
              valueStyle={{ color: firingCount > 0 ? '#ff4d4f' : 'var(--text-primary)' }}
            />
          </Card>
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'agents', label: 'Agent List', children: <AgentListTab /> },
            { key: 'alerts', label: 'Alert Center', children: <AlertCenterTab /> },
            { key: 'rules', label: 'Alert Rules', children: <AlertRulesTab /> },
          ]}
        />
      </motion.div>
    </div>
  );
}

// =====================================================
// Tab 1: Agent List
// =====================================================

function AgentListTab() {
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<SentinelAgent[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SentinelAgent | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sentinelApi.listAgents();
      const list = unwrap<SentinelAgent[]>(res.data);
      setAgents(Array.isArray(list) ? list : []);
    } catch {
      message.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleViewMetrics = (agent: SentinelAgent) => {
    setSelectedAgent(agent);
    setDrawerOpen(true);
  };

  const columns: ColumnsType<SentinelAgent> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (val: string) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{val}</span>,
    },
    {
      title: 'Hostname',
      dataIndex: 'hostname',
      key: 'hostname',
      width: 160,
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (val: string) => <Tag>{val || '-'}</Tag>,
    },
    {
      title: 'Version',
      dataIndex: 'agentVersion',
      key: 'agentVersion',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Badge
          status={val === 'online' ? 'success' : 'error'}
          text={<span style={{ color: val === 'online' ? '#52c41a' : '#ff4d4f' }}>{val}</span>}
        />
      ),
    },
    {
      title: 'Last Heartbeat',
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      width: 160,
      render: (val: string) => (val ? dayjs(val).fromNow() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button type="link" icon={<LineChartOutlined />} onClick={() => handleViewMetrics(record)}>
          Metrics
        </Button>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<ReloadOutlined />} onClick={loadAgents}>
          Refresh
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={agents}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 900 }}
        locale={{ emptyText: <Empty description="No Sentinel Agents registered" /> }}
      />
      <MetricsDrawer
        agent={selectedAgent}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAgent(null);
        }}
      />
    </>
  );
}

// =====================================================
// Metrics Drawer
// =====================================================

function MetricsDrawer({ agent, open, onClose }: { agent: SentinelAgent | null; open: boolean; onClose: () => void }) {
  const [latestMetrics, setLatestMetrics] = useState<SentinelMetric[]>([]);
  const [historyMetrics, setHistoryMetrics] = useState<SentinelMetric[]>([]);
  const [selectedMetricName, setSelectedMetricName] = useState<string | undefined>();
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load latest metrics
  useEffect(() => {
    if (!agent || !open) return;
    setLoading(true);
    sentinelApi
      .getLatestMetrics(agent.id)
      .then((res) => {
        const list = unwrap<SentinelMetric[]>(res.data);
        const arr = Array.isArray(list) ? list : [];
        setLatestMetrics(arr);
        if (arr.length > 0 && !selectedMetricName) {
          setSelectedMetricName(arr[0].name);
        }
      })
      .catch(() => {
        message.error('Failed to load latest metrics');
      })
      .finally(() => setLoading(false));
  }, [agent, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load history when metric name or time range changes
  useEffect(() => {
    if (!agent || !open || !selectedMetricName) return;
    const hoursMap: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24 };
    const hours = hoursMap[timeRange] ?? 1;
    const start = dayjs().subtract(hours, 'hour').toISOString();

    setHistoryLoading(true);
    sentinelApi
      .getMetrics(agent.id, { name: selectedMetricName, start, limit: 500 })
      .then((res) => {
        const data = unwrap<SentinelMetric[]>(res.data);
        setHistoryMetrics(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        message.error('Failed to load metric history');
      })
      .finally(() => setHistoryLoading(false));
  }, [agent, open, selectedMetricName, timeRange]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setLatestMetrics([]);
      setHistoryMetrics([]);
      setSelectedMetricName(undefined);
    }
  }, [open]);

  // Metric name options
  const metricNameOptions = useMemo(() => {
    const names = new Set(latestMetrics.map((m) => m.name));
    return Array.from(names).map((n) => ({ label: n, value: n }));
  }, [latestMetrics]);

  // ECharts option
  const chartOption = useMemo(() => {
    const sorted = [...historyMetrics].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 12 },
      },
      grid: { top: 30, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: 'category' as const,
        data: sorted.map((m) => dayjs(m.createdAt).format('HH:mm:ss')),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
      },
      series: [
        {
          name: selectedMetricName,
          type: 'line' as const,
          data: sorted.map((m) => m.value),
          smooth: true,
          symbolSize: 4,
          lineStyle: { width: 2, color: '#1677ff' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22,119,255,0.3)' },
                { offset: 1, color: 'rgba(22,119,255,0.02)' },
              ],
            },
          },
          itemStyle: { color: '#1677ff' },
        },
      ],
    };
  }, [historyMetrics, selectedMetricName]);

  const latestColumns: ColumnsType<SentinelMetric> = [
    { title: 'Metric', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: 100,
      render: (val: number) => <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{val}</span>,
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80, render: (val: string) => val || '-' },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <Drawer
      title={agent ? `Metrics - ${agent.name} (${agent.hostname})` : 'Metrics'}
      width={680}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 20, background: 'var(--glass-bg-light)' } }}
    >
      <Spin spinning={loading}>
        {/* Latest values */}
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Latest Metrics</h3>
        <Table
          columns={latestColumns}
          dataSource={latestMetrics}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="No metrics reported yet" /> }}
          style={{ marginBottom: 24 }}
        />

        {/* History chart */}
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>History Trend</h3>
        <Space style={{ marginBottom: 12 }}>
          <Select
            placeholder="Select metric"
            value={selectedMetricName}
            onChange={setSelectedMetricName}
            options={metricNameOptions}
            style={{ width: 200 }}
          />
          <Select
            value={timeRange}
            onChange={(val) => setTimeRange(val as '1h' | '6h' | '24h')}
            options={[
              { label: 'Last 1h', value: '1h' },
              { label: 'Last 6h', value: '6h' },
              { label: 'Last 24h', value: '24h' },
            ]}
            style={{ width: 120 }}
          />
        </Space>
        <Spin spinning={historyLoading}>
          {historyMetrics.length > 0 ? (
            <ReactECharts option={chartOption} style={{ height: 300 }} />
          ) : (
            <div
              style={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 8,
              }}
            >
              <Empty description="No history data for this time range" />
            </div>
          )}
        </Spin>
      </Spin>
    </Drawer>
  );
}

// =====================================================
// Tab 2: Alert Center
// =====================================================

function AlertCenterTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AlertHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [agentFilter, setAgentFilter] = useState<string | undefined>();

  // Agent list for filter dropdown
  const [agents, setAgents] = useState<SentinelAgent[]>([]);

  useEffect(() => {
    sentinelApi
      .listAgents()
      .then((res) => {
        const list = unwrap<SentinelAgent[]>(res.data);
        setAgents(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const params: Record<string, string | number> = { limit: pageSize, offset };
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;
      if (agentFilter) params.agentId = agentFilter;

      const res = await sentinelApi.listAlerts(params);
      const payload = unwrap<{ items?: AlertHistoryItem[]; total?: number }>(res.data);
      setData(payload?.items ?? []);
      setTotal(payload?.total ?? 0);
    } catch {
      message.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, severityFilter, statusFilter, agentFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await sentinelApi.acknowledgeAlert(id);
      message.success('Alert acknowledged');
      loadAlerts();
    } catch {
      message.error('Failed to acknowledge alert');
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await sentinelApi.resolveAlert(id);
      message.success('Alert resolved');
      loadAlerts();
    } catch {
      message.error('Failed to resolve alert');
    }
  };

  const severityIcon = (severity: string) => {
    if (severity === 'critical') return <WarningOutlined />;
    if (severity === 'warning') return <ExclamationCircleOutlined />;
    return <InfoCircleOutlined />;
  };

  const columns: ColumnsType<AlertHistoryItem> = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Agent',
      key: 'agent',
      width: 140,
      render: (_, record) => record.agent?.name || record.agent?.hostname || record.agentId?.slice(0, 8) || '-',
    },
    {
      title: 'Rule',
      key: 'rule',
      width: 140,
      render: (_, record) => record.rule?.name || record.ruleId?.slice(0, 8) || '-',
    },
    {
      title: 'Metric',
      key: 'metric',
      width: 180,
      render: (_, record) => (
        <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {record.metricName} = {record.metricValue}
        </code>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (val: string) => (
        <Tag icon={severityIcon(val)} color={severityColors[val] || 'default'}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: string) => <Tag color={statusColors[val] || 'default'}>{val}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'firing' && (
            <Button size="small" onClick={() => handleAcknowledge(record.id)}>
              Acknowledge
            </Button>
          )}
          {(record.status === 'firing' || record.status === 'acknowledged') && (
            <Button size="small" type="primary" onClick={() => handleResolve(record.id)}>
              Resolve
            </Button>
          )}
          {record.status === 'resolved' && <span style={{ color: 'var(--text-tertiary)' }}>--</span>}
        </Space>
      ),
    },
  ];

  const agentOptions = agents.map((a) => ({ label: `${a.name} (${a.hostname})`, value: a.id }));

  return (
    <>
      {/* Filters */}
      <div
        className="rounded-lg p-4 mb-4"
        style={{ background: 'var(--glass-bg-medium)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Space wrap size="middle">
          <Select
            placeholder="Severity"
            value={severityFilter}
            onChange={(val) => {
              setSeverityFilter(val);
              setPage(1);
            }}
            options={[
              { label: 'Critical', value: 'critical' },
              { label: 'Warning', value: 'warning' },
              { label: 'Info', value: 'info' },
            ]}
            style={{ width: 140 }}
            allowClear
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={[
              { label: 'Firing', value: 'firing' },
              { label: 'Acknowledged', value: 'acknowledged' },
              { label: 'Resolved', value: 'resolved' },
            ]}
            style={{ width: 160 }}
            allowClear
          />
          <Select
            placeholder="Agent"
            value={agentFilter}
            onChange={(val) => {
              setAgentFilter(val);
              setPage(1);
            }}
            options={agentOptions}
            style={{ width: 240 }}
            allowClear
            showSearch
            optionFilterProp="label"
          />
          <Button
            onClick={() => {
              setSeverityFilter(undefined);
              setStatusFilter(undefined);
              setAgentFilter(undefined);
              setPage(1);
            }}
          >
            Reset
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAlerts}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} alerts`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1100 }}
        expandable={{
          expandedRowRender: (record) => (
            <div className="p-3">
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{record.message}</p>
              {record.resolvedAt && (
                <p className="mt-1" style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: '4px 0 0' }}>
                  Resolved at: {dayjs(record.resolvedAt).format('YYYY-MM-DD HH:mm:ss')}
                </p>
              )}
            </div>
          ),
          rowExpandable: (record) => !!record.message,
        }}
      />
    </>
  );
}

// =====================================================
// Tab 3: Alert Rules
// =====================================================

function AlertRulesTab() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sentinelApi.listAlertRules();
      const list = unwrap<AlertRule[]>(res.data);
      setRules(Array.isArray(list) ? list : []);
    } catch {
      message.error('Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleAdd = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ duration: 60, cooldown: 300, severity: 'warning', enabled: true });
    setModalOpen(true);
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      description: rule.description,
      metricName: rule.metricName,
      condition: rule.condition,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      cooldown: rule.cooldown,
      enabled: rule.enabled,
      actionType: rule.actions?.[0]?.type,
      actionConfig: rule.actions?.[0]?.config ? JSON.stringify(rule.actions[0].config) : '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await sentinelApi.deleteAlertRule(id);
      message.success('Rule deleted');
      loadRules();
    } catch {
      message.error('Failed to delete rule');
    }
  };

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      await sentinelApi.updateAlertRule(rule.id, { enabled: !rule.enabled });
      message.success(rule.enabled ? 'Rule disabled' : 'Rule enabled');
      loadRules();
    } catch {
      message.error('Failed to toggle rule');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // Build actions array
      const actions: { type: string; config: Record<string, string> }[] = [];
      if (values.actionType && values.actionConfig) {
        try {
          const config = JSON.parse(values.actionConfig) as Record<string, string>;
          actions.push({ type: values.actionType, config });
        } catch {
          message.error('Action config must be valid JSON');
          setSubmitting(false);
          return;
        }
      }

      const payload: Partial<AlertRule> = {
        name: values.name,
        description: values.description,
        metricName: values.metricName,
        condition: values.condition,
        threshold: values.threshold,
        duration: values.duration,
        severity: values.severity,
        cooldown: values.cooldown,
        enabled: values.enabled ?? true,
        actions,
      };

      if (editingRule) {
        await sentinelApi.updateAlertRule(editingRule.id, payload);
        message.success('Rule updated');
      } else {
        await sentinelApi.createAlertRule(payload);
        message.success('Rule created');
      }

      setModalOpen(false);
      form.resetFields();
      loadRules();
    } catch (err) {
      // Form validation failure is handled by AntD
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to save rule');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<AlertRule> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (val: string) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{val}</span>,
    },
    {
      title: 'Metric',
      dataIndex: 'metricName',
      key: 'metricName',
      width: 140,
      render: (val: string) => <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{val}</code>,
    },
    {
      title: 'Condition',
      key: 'condition',
      width: 120,
      render: (_, record) => (
        <span style={{ color: 'var(--text-primary)' }}>
          {conditionLabels[record.condition] || record.condition} {record.threshold}
        </span>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 90,
      render: (val: number) => `${val}s`,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (val: string) => <Tag color={severityColors[val] || 'default'}>{val}</Tag>,
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (val: boolean, record) => <Switch size="small" checked={val} onChange={() => handleToggleEnabled(record)} />,
    },
    {
      title: 'Alerts',
      key: 'alertCount',
      width: 80,
      render: (_, record) => record._count?.alertHistory ?? 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this rule?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Rule
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadRules}>
          Refresh
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1000 }}
        locale={{ emptyText: <Empty description="No alert rules configured" /> }}
      />

      {/* Add/Edit Rule Modal */}
      <Modal
        title={editingRule ? 'Edit Alert Rule' : 'Add Alert Rule'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={submitting}
        width={560}
        okText={editingRule ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Rule Name" rules={[{ required: true, message: 'Please enter rule name' }]}>
            <Input placeholder="e.g. High CPU Alert" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Optional description" rows={2} />
          </Form.Item>
          <Form.Item
            name="metricName"
            label="Metric Name"
            rules={[{ required: true, message: 'Please enter metric name' }]}
          >
            <Input placeholder="e.g. cpu_usage, memory_percent, disk_usage" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="condition"
              label="Condition"
              rules={[{ required: true, message: 'Please select condition' }]}
            >
              <Select
                placeholder="Select"
                options={[
                  { label: '> (greater than)', value: 'gt' },
                  { label: '>= (greater or equal)', value: 'gte' },
                  { label: '< (less than)', value: 'lt' },
                  { label: '<= (less or equal)', value: 'lte' },
                  { label: '= (equal)', value: 'eq' },
                  { label: '!= (not equal)', value: 'neq' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="threshold"
              label="Threshold"
              rules={[{ required: true, message: 'Please enter threshold' }]}
            >
              <InputNumber placeholder="e.g. 90" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="duration"
              label="Duration (seconds)"
              rules={[{ required: true, message: 'Please enter duration' }]}
            >
              <InputNumber min={0} placeholder="60" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="severity"
              label="Severity"
              rules={[{ required: true, message: 'Please select severity' }]}
            >
              <Select
                options={[
                  { label: 'Info', value: 'info' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Critical', value: 'critical' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="cooldown" label="Cooldown (seconds)">
            <InputNumber min={0} placeholder="300" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          {/* Notification action (optional) */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 16,
              marginTop: 8,
            }}
          >
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Notification Action (optional)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              <Form.Item name="actionType" label="Type">
                <Select
                  placeholder="Select"
                  allowClear
                  options={[
                    { label: 'Email', value: 'email' },
                    { label: 'Webhook', value: 'webhook' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="actionConfig"
                label="Config (JSON)"
                tooltip='e.g. {"email":"admin@example.com"} or {"url":"https://..."}'
              >
                <Input placeholder='{"email":"admin@example.com"}' />
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>
    </>
  );
}
