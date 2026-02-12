import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  DatePicker,
  Input,
  Select,
  Tag,
  Space,
  message,
} from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { auditApi } from '../services/audit-api';
import type { AuditLogItem, AuditLogStats } from '../services/audit-api';

const { RangePicker } = DatePicker;

export default function AuditLogPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [searchUser, setSearchUser] = useState('');

  // Stats for filter options
  const [stats, setStats] = useState<AuditLogStats | null>(null);

  const buildParams = useCallback(() => {
    const params: Record<string, any> = { page, pageSize };
    if (actionFilter) params.action = actionFilter;
    if (resourceTypeFilter) params.resourceType = resourceTypeFilter;
    if (searchUser.trim()) params.userId = searchUser.trim();
    if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
    if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();
    return params;
  }, [page, pageSize, actionFilter, resourceTypeFilter, searchUser, dateRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list(buildParams());
      const result = res.data as any;
      const responseData = result?.data || result;
      setData(responseData?.items ?? []);
      setTotal(responseData?.total ?? 0);
    } catch {
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadStats = useCallback(async () => {
    try {
      const res = await auditApi.getStats(30);
      const result = res.data as any;
      setStats(result?.data || result);
    } catch {
      // Stats are non-critical
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleExport = async () => {
    try {
      const params = buildParams();
      delete params.page;
      delete params.pageSize;
      const res = await auditApi.exportLogs(params);
      const exportData = (res.data as any)?.data || res.data;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('Export completed');
    } catch {
      message.error('Export failed');
    }
  };

  const handleReset = () => {
    setActionFilter(undefined);
    setResourceTypeFilter(undefined);
    setDateRange(null);
    setSearchUser('');
    setPage(1);
  };

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (val: string) => val || '-',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 240,
      ellipsis: true,
      render: (val: string) => (
        <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{val}</code>
      ),
    },
    {
      title: 'Resource',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 120,
      render: (val: string) => val ? <Tag>{val}</Tag> : '-',
    },
    {
      title: 'Resource ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 140,
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: 'Status',
      dataIndex: 'success',
      key: 'success',
      width: 90,
      align: 'center',
      render: (val: boolean) =>
        val ? (
          <Tag icon={<CheckCircleOutlined />} color="success">OK</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">Fail</Tag>
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (val: string) => val || '-',
    },
  ];

  const actionOptions = (stats?.byAction ?? []).map((a) => ({
    label: `${a.action} (${a.count})`,
    value: a.action,
  }));

  const resourceTypeOptions = (stats?.byResourceType ?? [])
    .filter((r) => r.resourceType)
    .map((r) => ({
      label: `${r.resourceType} (${r.count})`,
      value: r.resourceType!,
    }));

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
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Audit Log
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {total} records total
            </p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadData(); }}>
              Refresh
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <div
          className="rounded-lg p-4 mb-4"
          style={{ background: 'var(--glass-bg-medium)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Space wrap size="middle">
            <RangePicker
              value={dateRange as any}
              onChange={(vals) => {
                setDateRange(vals as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null);
                setPage(1);
              }}
              allowClear
              placeholder={['Start Date', 'End Date']}
            />
            <Input
              placeholder="User ID"
              prefix={<SearchOutlined />}
              value={searchUser}
              onChange={(e) => { setSearchUser(e.target.value); setPage(1); }}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="Action"
              value={actionFilter}
              onChange={(val) => { setActionFilter(val); setPage(1); }}
              options={actionOptions}
              style={{ width: 260 }}
              allowClear
              showSearch
            />
            <Select
              placeholder="Resource Type"
              value={resourceTypeFilter}
              onChange={(val) => { setResourceTypeFilter(val); setPage(1); }}
              options={resourceTypeOptions}
              style={{ width: 180 }}
              allowClear
            />
            <Button onClick={handleReset}>Reset</Button>
          </Space>
        </div>

        {/* Table */}
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
            showTotal: (t) => `Total ${t} records`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          scroll={{ x: 1100 }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="p-3">
                {record.details && (
                  <div className="mb-2">
                    <strong style={{ color: 'var(--text-secondary)' }}>Details:</strong>
                    <pre
                      className="mt-1 p-3 rounded-md text-xs overflow-auto"
                      style={{
                        background: 'var(--glass-bg-light)',
                        color: 'var(--text-secondary)',
                        maxHeight: 300,
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {JSON.stringify(record.details, null, 2)}
                    </pre>
                  </div>
                )}
                {record.errorMessage && (
                  <div>
                    <strong style={{ color: '#f5222d' }}>Error:</strong>
                    <pre
                      className="mt-1 p-3 rounded-md text-xs"
                      style={{ background: 'rgba(245,34,45,0.08)', color: '#f5222d' }}
                    >
                      {record.errorMessage}
                    </pre>
                  </div>
                )}
                {record.userAgent && (
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <strong>User Agent:</strong> {record.userAgent}
                  </div>
                )}
              </div>
            ),
            rowExpandable: (record) => !!(record.details || record.errorMessage || record.userAgent),
          }}
        />
      </motion.div>
    </div>
  );
}
