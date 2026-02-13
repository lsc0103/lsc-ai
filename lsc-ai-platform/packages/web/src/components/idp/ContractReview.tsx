import { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  List,
  Typography,
  Space,
  Collapse,
  Statistic,
  Empty,
} from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import type { ContractRisk } from '../../services/idp-api';

const { Text, Paragraph } = Typography;

interface ContractReviewProps {
  elements: Record<string, string | null>;
  risks: ContractRisk[];
  summary: {
    totalElements: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

const RISK_CONFIG = {
  high: {
    color: '#ff4d4f',
    tag: 'red',
    icon: <WarningOutlined />,
    label: '高风险',
  },
  medium: {
    color: '#faad14',
    tag: 'orange',
    icon: <ExclamationCircleOutlined />,
    label: '中风险',
  },
  low: {
    color: '#52c41a',
    tag: 'green',
    icon: <CheckCircleOutlined />,
    label: '低风险',
  },
} as const;

function computeRiskScore(summary: ContractReviewProps['summary']): number {
  const total = summary.highRisk + summary.mediumRisk + summary.lowRisk;
  if (total === 0) return 100;
  // Higher score = safer. High risk deducts 30, medium deducts 15, low deducts 5
  const deduction = summary.highRisk * 30 + summary.mediumRisk * 15 + summary.lowRisk * 5;
  return Math.max(0, Math.min(100, 100 - deduction));
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
}

export default function ContractReview({
  elements,
  risks,
  summary,
}: ContractReviewProps) {
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const riskScore = computeRiskScore(summary);
  const scoreColor = getScoreColor(riskScore);

  const filteredRisks = riskFilter === 'all'
    ? risks
    : risks.filter((r) => r.level === riskFilter);

  if (!risks || risks.length === 0) {
    return (
      <Card style={{ background: 'var(--glass-bg-medium)' }}>
        <Empty description="暂无合同审查结果" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dashboard header */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
            <div className="text-center">
              <Progress
                type="dashboard"
                percent={riskScore}
                size={100}
                strokeColor={scoreColor}
                format={(pct) => (
                  <span style={{ color: scoreColor, fontSize: 20, fontWeight: 600 }}>
                    {pct}
                  </span>
                )}
              />
              <div
                className="mt-2 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                安全评分
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              background: 'var(--glass-bg-medium)',
              borderLeft: '3px solid #ff4d4f',
            }}
          >
            <Statistic
              title="高风险"
              value={summary.highRisk}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              background: 'var(--glass-bg-medium)',
              borderLeft: '3px solid #faad14',
            }}
          >
            <Statistic
              title="中风险"
              value={summary.mediumRisk}
              valueStyle={{ color: '#faad14' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{
              background: 'var(--glass-bg-medium)',
              borderLeft: '3px solid #52c41a',
            }}
          >
            <Statistic
              title="低风险"
              value={summary.lowRisk}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main content: Risk list + Suggestions */}
      <div className="flex gap-4">
        {/* Left: Risk list (60%) */}
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined />
              <span>风险项</span>
            </Space>
          }
          extra={
            <Space>
              <Tag
                color={riskFilter === 'all' ? 'blue' : 'default'}
                className="cursor-pointer"
                onClick={() => setRiskFilter('all')}
              >
                全部 ({risks.length})
              </Tag>
              <Tag
                color={riskFilter === 'high' ? 'red' : 'default'}
                className="cursor-pointer"
                onClick={() => setRiskFilter('high')}
              >
                高 ({summary.highRisk})
              </Tag>
              <Tag
                color={riskFilter === 'medium' ? 'orange' : 'default'}
                className="cursor-pointer"
                onClick={() => setRiskFilter('medium')}
              >
                中 ({summary.mediumRisk})
              </Tag>
              <Tag
                color={riskFilter === 'low' ? 'green' : 'default'}
                className="cursor-pointer"
                onClick={() => setRiskFilter('low')}
              >
                低 ({summary.lowRisk})
              </Tag>
            </Space>
          }
          style={{ flex: '0 0 60%', background: 'var(--glass-bg-medium)' }}
        >
          <List
            dataSource={filteredRisks}
            renderItem={(risk, idx) => {
              const config = RISK_CONFIG[risk.level];
              return (
                <Collapse
                  key={idx}
                  ghost
                  className="mb-2"
                  items={[
                    {
                      key: String(idx),
                      label: (
                        <Space>
                          <Tag color={config.tag}>
                            {config.icon} {config.label}
                          </Tag>
                          <Tag>{risk.category}</Tag>
                          <Text style={{ color: 'var(--text-primary)' }}>
                            {risk.description}
                          </Text>
                        </Space>
                      ),
                      children: (
                        <div
                          className="p-3 rounded"
                          style={{ background: 'var(--glass-bg-subtle)' }}
                        >
                          <Paragraph
                            style={{
                              color: 'var(--text-secondary)',
                              margin: 0,
                            }}
                          >
                            {risk.description}
                          </Paragraph>
                        </div>
                      ),
                    },
                  ]}
                />
              );
            }}
          />
        </Card>

        {/* Right: Suggestions (40%) */}
        <Card
          title={
            <Space>
              <BulbOutlined />
              <span>审查建议</span>
            </Space>
          }
          style={{ flex: '0 0 40%', background: 'var(--glass-bg-medium)' }}
        >
          <div className="space-y-3">
            {risks.map((risk, idx) => {
              const config = RISK_CONFIG[risk.level];
              return (
                <div
                  key={idx}
                  className="p-3 rounded"
                  style={{
                    background: 'var(--glass-bg-subtle)',
                    borderLeft: `3px solid ${config.color}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Tag color={config.tag} style={{ margin: 0 }}>
                      {risk.category}
                    </Tag>
                  </div>
                  <Text
                    className="text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {risk.suggestion}
                  </Text>
                </div>
              );
            })}
          </div>

          {/* Key elements summary */}
          {elements && Object.keys(elements).length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
              <Text
                strong
                className="text-sm mb-2 block"
                style={{ color: 'var(--text-secondary)' }}
              >
                关键要素（已识别 {summary.totalElements} 项）
              </Text>
              <div className="flex flex-wrap gap-1">
                {Object.entries(elements)
                  .filter(([, v]) => v !== null)
                  .slice(0, 10)
                  .map(([key]) => (
                    <Tag key={key} color="blue" style={{ margin: 0 }}>
                      {key.replace(/_/g, ' ')}
                    </Tag>
                  ))}
                {Object.values(elements).filter((v) => v !== null).length > 10 && (
                  <Tag style={{ margin: 0 }}>
                    +{Object.values(elements).filter((v) => v !== null).length - 10} 更多
                  </Tag>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
