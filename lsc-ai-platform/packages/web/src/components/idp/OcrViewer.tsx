import { useState, useMemo } from 'react';
import {
  Card,
  Switch,
  Slider,
  Pagination,
  Tag,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { OcrResponse, OcrPageResult } from '../../services/idp-api';

const { Text } = Typography;

interface OcrViewerProps {
  ocrResult: OcrResponse;
  imageUrl?: string;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.95) return '#52c41a';
  if (confidence >= 0.80) return '#faad14';
  return '#ff4d4f';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.95) return 'high';
  if (confidence >= 0.80) return 'medium';
  return 'low';
}

export default function OcrViewer({ ocrResult, imageUrl }: OcrViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [showBbox, setShowBbox] = useState(true);
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100]);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);

  const pageData: OcrPageResult | undefined = ocrResult.pages?.[currentPage - 1];

  const filteredBlocks = useMemo(() => {
    if (!pageData?.blocks) return [];
    const [min, max] = confidenceRange;
    return pageData.blocks.filter(
      (b) => b.confidence * 100 >= min && b.confidence * 100 <= max
    );
  }, [pageData, confidenceRange]);

  const stats = useMemo(() => {
    const allBlocks = ocrResult.pages?.flatMap((p) => p.blocks) ?? [];
    const totalChars = allBlocks.reduce((sum, b) => sum + b.text.length, 0);
    const avgConfidence =
      allBlocks.length > 0
        ? allBlocks.reduce((sum, b) => sum + b.confidence, 0) / allBlocks.length
        : 0;
    const lowConfCount = allBlocks.filter((b) => b.confidence < 0.8).length;
    return { totalChars, avgConfidence, lowConfCount, totalBlocks: allBlocks.length };
  }, [ocrResult]);

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
            <Statistic
              title="总字符数"
              value={stats.totalChars}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
            <Statistic
              title="平均置信度"
              value={(stats.avgConfidence * 100).toFixed(1)}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
            <Statistic
              title="低置信度"
              value={stats.lowConfCount}
              valueStyle={{ color: stats.lowConfCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
            <Statistic title="总页数" value={ocrResult.total_pages} />
          </Card>
        </Col>
      </Row>

      {/* Controls */}
      <Card size="small" style={{ background: 'var(--glass-bg-medium)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Space size="middle">
            <Space>
              <Text style={{ color: 'var(--text-secondary)' }}>显示识别框</Text>
              <Switch
                checked={showBbox}
                onChange={setShowBbox}
                checkedChildren={<EyeOutlined />}
                unCheckedChildren={<EyeInvisibleOutlined />}
              />
            </Space>
            <Space>
              <Text style={{ color: 'var(--text-secondary)' }}>置信度筛选</Text>
              <Slider
                range
                min={0}
                max={100}
                value={confidenceRange}
                onChange={(val) => setConfidenceRange(val as [number, number])}
                style={{ width: 200 }}
                tooltip={{ formatter: (val) => `${val}%` }}
              />
            </Space>
          </Space>
          <Pagination
            current={currentPage}
            total={ocrResult.total_pages}
            pageSize={1}
            onChange={setCurrentPage}
            size="small"
            showSizeChanger={false}
          />
        </div>
      </Card>

      {/* Main content: Image + Text side by side */}
      <div className="flex gap-4" style={{ minHeight: 500 }}>
        {/* Left: Image with bbox overlay */}
        {imageUrl && (
          <Card
            size="small"
            title="原始文档"
            style={{ flex: 1, background: 'var(--glass-bg-medium)', overflow: 'hidden' }}
            styles={{ body: { padding: 0, position: 'relative' } }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <img
                src={imageUrl}
                alt={`Page ${currentPage}`}
                style={{ width: '100%', display: 'block' }}
              />
              {showBbox && (
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                >
                  {filteredBlocks.map((block, idx) => {
                    if (!block.bbox || block.bbox.length < 4) return null;
                    const [[x1, y1], , [x3, y3]] = block.bbox;
                    const color = getConfidenceColor(block.confidence);
                    return (
                      <rect
                        key={idx}
                        x={x1}
                        y={y1}
                        width={x3 - x1}
                        height={y3 - y1}
                        fill={`${color}20`}
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </Card>
        )}

        {/* Right: OCR text results */}
        <Card
          size="small"
          title={`OCR 识别结果 - 第 ${currentPage} 页`}
          style={{
            flex: 1,
            background: 'var(--glass-bg-medium)',
            overflow: 'auto',
            maxHeight: 600,
          }}
        >
          {filteredBlocks.length === 0 ? (
            <Text style={{ color: 'var(--text-tertiary)' }}>
              当前页无文本块（或已被筛选过滤）
            </Text>
          ) : (
            <div className="space-y-2">
              {filteredBlocks.map((block, idx) => {
                const confColor = getConfidenceColor(block.confidence);
                const confLabel = getConfidenceLabel(block.confidence);
                const isEditing = editingBlockIdx === idx;

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded"
                    style={{
                      background: 'var(--glass-bg-subtle)',
                      borderLeft: `3px solid ${confColor}`,
                    }}
                    onDoubleClick={() => setEditingBlockIdx(idx)}
                  >
                    <Tag
                      color={confLabel === 'high' ? 'green' : confLabel === 'medium' ? 'orange' : 'red'}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    >
                      {(block.confidence * 100).toFixed(0)}%
                    </Tag>
                    {isEditing ? (
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={() => setEditingBlockIdx(null)}
                        className="flex-1 text-sm outline-none"
                        style={{
                          color: 'var(--text-primary)',
                          background: 'var(--glass-bg-light)',
                          padding: '2px 4px',
                          borderRadius: 4,
                          minHeight: 20,
                        }}
                      >
                        {block.text}
                      </div>
                    ) : (
                      <Text
                        className="flex-1 text-sm cursor-text"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {block.text}
                      </Text>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Full text for current page */}
      {pageData?.full_text && (
        <Card
          size="small"
          title="整页文本"
          style={{ background: 'var(--glass-bg-medium)' }}
        >
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text-secondary)',
              fontSize: 13,
              margin: 0,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {pageData.full_text}
          </pre>
        </Card>
      )}
    </div>
  );
}
