import { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Tag, Empty } from 'antd';
import { DownloadOutlined, TableOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableResult } from '../../services/idp-api';

interface TableViewProps {
  tables: TableResult[];
  filename?: string;
}

function exportCsv(headers: string[], rows: string[][], filename: string) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, '') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function TableView({ tables, filename = 'document' }: TableViewProps) {
  const [activeTab, setActiveTab] = useState('0');

  if (!tables || tables.length === 0) {
    return (
      <Card style={{ background: 'var(--glass-bg-medium)' }}>
        <Empty description="未提取到表格" />
      </Card>
    );
  }

  const renderTable = (table: TableResult, tableIdx: number) => {
    const columns: ColumnsType<Record<string, string>> = table.headers.map(
      (header, colIdx) => ({
        title: header || `列 ${colIdx + 1}`,
        dataIndex: `col_${colIdx}`,
        key: `col_${colIdx}`,
        ellipsis: true,
      })
    );

    const dataSource = table.rows.map((row, rowIdx) => {
      const record: Record<string, string> = { key: String(rowIdx) };
      row.forEach((cell, colIdx) => {
        record[`col_${colIdx}`] = cell;
      });
      return record;
    });

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <Space>
            <Tag color="blue">第 {table.page} 页</Tag>
            <Tag>
              {table.rows.length} 行 x {table.headers.length} 列
            </Tag>
          </Space>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() =>
              exportCsv(
                table.headers,
                table.rows,
                `${filename}_table_${tableIdx + 1}`
              )
            }
          >
            导出 CSV
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={dataSource.length > 20 ? { pageSize: 20 } : false}
          scroll={{ x: 'max-content' }}
          size="small"
          bordered
        />
      </div>
    );
  };

  if (tables.length === 1) {
    return (
      <Card
        title={
          <Space>
            <TableOutlined />
            <span>提取的表格</span>
          </Space>
        }
        style={{ background: 'var(--glass-bg-medium)' }}
      >
        {renderTable(tables[0], 0)}
      </Card>
    );
  }

  const tabItems = tables.map((table, idx) => ({
    key: String(idx),
    label: `表格 ${idx + 1} (第${table.page}页)`,
    children: renderTable(table, idx),
  }));

  return (
    <Card
      title={
        <Space>
          <TableOutlined />
          <span>已提取 {tables.length} 个表格</span>
        </Space>
      }
      extra={
        <Button
          icon={<DownloadOutlined />}
          size="small"
          onClick={() => {
            tables.forEach((table, idx) => {
              exportCsv(table.headers, table.rows, `${filename}_table_${idx + 1}`);
            });
          }}
        >
          全部导出
        </Button>
      }
      style={{ background: 'var(--glass-bg-medium)' }}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Card>
  );
}
