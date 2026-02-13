import { Card, Descriptions, Tag, Empty } from 'antd';
import { ProfileOutlined } from '@ant-design/icons';

interface ElementViewProps {
  elements: Record<string, string | null>;
  title?: string;
}

// Group definitions for element categorization
const GROUPS: Record<string, { label: string; keys: string[] }> = {
  basic: {
    label: '基本信息',
    keys: [
      'contract_no', 'contract_name', 'contract_type',
      'party_a', 'party_b', 'project_name',
      'ship_name', 'ship_type', 'hull_no',
    ],
  },
  time: {
    label: '时间条款',
    keys: [
      'sign_date', 'start_date', 'end_date', 'delivery_date',
      'warranty_period', 'validity_period',
    ],
  },
  payment: {
    label: '付款条款',
    keys: [
      'total_amount', 'currency', 'payment_method',
      'advance_payment', 'milestone_payment', 'final_payment',
      'invoice_type',
    ],
  },
  risk: {
    label: '风险条款',
    keys: [
      'penalty_clause', 'liability_limit', 'force_majeure',
      'dispute_resolution', 'governing_law', 'confidentiality',
      'termination_clause', 'insurance_requirement',
    ],
  },
};

export default function ElementView({ elements, title }: ElementViewProps) {
  if (!elements || Object.keys(elements).length === 0) {
    return (
      <Card style={{ background: 'var(--glass-bg-medium)' }}>
        <Empty description="未提取到要素" />
      </Card>
    );
  }

  // Categorize elements into groups
  const groupedKeys = new Set<string>();
  const groups = Object.entries(GROUPS).map(([groupKey, group]) => {
    const items = group.keys
      .filter((key) => key in elements)
      .map((key) => {
        groupedKeys.add(key);
        return { key, value: elements[key] };
      });
    return { groupKey, label: group.label, items };
  }).filter((g) => g.items.length > 0);

  // Uncategorized elements
  const uncategorized = Object.entries(elements)
    .filter(([key]) => !groupedKeys.has(key))
    .map(([key, value]) => ({ key, value }));

  if (uncategorized.length > 0) {
    groups.push({
      groupKey: 'other',
      label: '其他',
      items: uncategorized,
    });
  }

  const formatKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ProfileOutlined />
          {title || '要素提取结果'}
        </span>
      }
      style={{ background: 'var(--glass-bg-medium)' }}
    >
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.groupKey}>
            <h4
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              {group.label}
            </h4>
            <Descriptions
              bordered
              size="small"
              column={2}
              labelStyle={{
                background: 'var(--glass-bg-subtle)',
                color: 'var(--text-secondary)',
                width: 160,
              }}
              contentStyle={{
                background: 'var(--glass-bg-light)',
                color: 'var(--text-primary)',
              }}
            >
              {group.items.map((item) => (
                <Descriptions.Item key={item.key} label={formatKey(item.key)}>
                  {item.value ? (
                    <span style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                  ) : (
                    <Tag color="default">未识别</Tag>
                  )}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        ))}
      </div>
    </Card>
  );
}
