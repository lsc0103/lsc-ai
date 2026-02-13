/**
 * FlowEditor -- Visual RPA flow editor built on @xyflow/react v12
 *
 * Features:
 * - Drag-and-drop node creation from left palette
 * - Visual connection between steps with animated edges
 * - Right-side property panel for selected node config
 * - Toolbar: Save, Export JSON, Import JSON
 * - Dark theme compatible
 * - Bidirectional sync with RpaFlowDef
 */

import { useState, useCallback, useRef, useMemo, useEffect, type DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Tooltip,
  Upload,
  message,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';

import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import LoopNode from './nodes/LoopNode';
import {
  rpaFlowDefToFlow,
  flowToRpaFlowDef,
  ALL_STEP_TYPES,
  STEP_LABELS,
  STEP_COLORS,
  generateStepId,
  type FlowNodeData,
} from './FlowConverter';
import type { RpaFlowDef, RpaStepType } from '../../services/workflow-api';

// ===================== Constants =====================

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  loopNode: LoopNode,
};

const PALETTE_ITEMS: { type: RpaStepType; icon: string }[] = [
  { type: 'ai_chat', icon: '\uD83E\uDD16' },
  { type: 'shell_command', icon: '\uD83D\uDCBB' },
  { type: 'web_fetch', icon: '\uD83C\uDF10' },
  { type: 'file_operation', icon: '\uD83D\uDCC1' },
  { type: 'sql_query', icon: '\uD83D\uDDC4\uFE0F' },
  { type: 'send_email', icon: '\uD83D\uDCE7' },
  { type: 'condition', icon: '\uD83D\uDD00' },
  { type: 'loop', icon: '\uD83D\uDD01' },
];

const DEFAULT_EDGE_STYLE = { stroke: '#666', strokeWidth: 1.5 };

// ===================== Props =====================

interface FlowEditorProps {
  value: RpaFlowDef;
  onChange: (flowDef: RpaFlowDef) => void;
}

// ===================== Inner component =====================

function FlowEditorInner({ value, onChange }: FlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const initialized = useRef(false);

  // ---- Initialize from value prop ----
  useEffect(() => {
    if (!initialized.current) {
      if (value?.steps?.length) {
        const { nodes: n, edges: e } = rpaFlowDefToFlow(value);
        setNodes(n);
        setEdges(e);
      } else {
        // Start with a trigger node only
        setNodes([
          {
            id: '__trigger__',
            type: 'triggerNode',
            position: { x: 300, y: 0 },
            data: { label: '流程开始', stepType: 'ai_chat', config: {}, isTrigger: true } satisfies FlowNodeData,
          },
        ]);
        setEdges([]);
      }
      initialized.current = true;
    }
  }, [value, setNodes, setEdges]);

  // ---- Sync changes back to parent (debounced) ----
  const syncToParent = useCallback(() => {
    const flowDef = flowToRpaFlowDef(nodes, edges, value?.variables);
    onChange(flowDef);
  }, [nodes, edges, value?.variables, onChange]);

  useEffect(() => {
    if (initialized.current && nodes.length > 0) {
      const timer = setTimeout(syncToParent, 300);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, syncToParent]);

  // ---- Connections ----
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: DEFAULT_EDGE_STYLE }, eds),
      ),
    [setEdges],
  );

  // ---- Selection ----
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedNode(node),
    [],
  );
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  // ---- Drag and Drop ----
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const stepType = event.dataTransfer.getData('application/reactflow-steptype') as RpaStepType;
      if (!stepType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = generateStepId(stepType);
      const nodeType =
        stepType === 'condition'
          ? 'conditionNode'
          : stepType === 'loop'
            ? 'loopNode'
            : 'actionNode';

      const newNode: Node = {
        id,
        type: nodeType,
        position,
        data: {
          label: STEP_LABELS[stepType],
          stepType,
          config: getDefaultConfig(stepType),
        } satisfies FlowNodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  // ---- Delete selected node ----
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as FlowNodeData;
    if (d.isTrigger) {
      message.warning('不能删除触发节点');
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
    );
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  // ---- Update node data ----
  const updateNodeData = useCallback(
    (field: string, fieldValue: unknown) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, [field]: fieldValue } }
            : n,
        ),
      );
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, [field]: fieldValue } } : null,
      );
    },
    [selectedNode, setNodes],
  );

  const updateNodeConfig = useCallback(
    (configKey: string, configValue: unknown) => {
      if (!selectedNode) return;
      const nd = selectedNode.data as FlowNodeData;
      const newConfig = { ...nd.config, [configKey]: configValue };
      updateNodeData('config', newConfig);
    },
    [selectedNode, updateNodeData],
  );

  // ---- Export JSON ----
  const handleExport = useCallback(() => {
    const flowDef = flowToRpaFlowDef(nodes, edges, value?.variables);
    const blob = new Blob([JSON.stringify(flowDef, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rpa-flow.json';
    a.click();
    URL.revokeObjectURL(url);
    message.success('流程已导出');
  }, [nodes, edges, value?.variables]);

  // ---- Import JSON ----
  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const flowDef = JSON.parse(e.target?.result as string) as RpaFlowDef;
          if (!flowDef.steps || !Array.isArray(flowDef.steps)) {
            message.error('无效的流程定义：缺少 steps 数组');
            return;
          }
          const { nodes: n, edges: ed } = rpaFlowDefToFlow(flowDef);
          setNodes(n);
          setEdges(ed);
          onChange(flowDef);
          message.success('流程已导入');
        } catch {
          message.error('JSON 文件解析失败');
        }
      };
      reader.readAsText(file);
      return false; // prevent antd Upload from posting
    },
    [setNodes, setEdges, onChange],
  );

  // ---- MiniMap node color ----
  const minimapNodeColor = useMemo(
    () => (node: Node) => {
      const d = node.data as FlowNodeData;
      return STEP_COLORS[d?.stepType] || '#666';
    },
    [],
  );

  const selectedNodeData = selectedNode ? (selectedNode.data as FlowNodeData) : null;
  const isTriggerSelected = selectedNodeData?.isTrigger === true;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 420,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#1a1a2e',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <Tooltip title="导出 JSON">
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Tooltip>
        <Upload
          accept=".json"
          showUploadList={false}
          beforeUpload={handleImport}
        >
          <Tooltip title="导入 JSON">
            <Button size="small" icon={<UploadOutlined />}>
              导入
            </Button>
          </Tooltip>
        </Upload>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          从左侧面板拖拽步骤到画布
        </span>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left panel: node palette */}
        <div
          style={{
            width: 160,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            padding: 8,
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 8,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            步骤
          </div>
          {PALETTE_ITEMS.map(({ type, icon }) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow-steptype', type);
                e.dataTransfer.effectAllowed = 'move';
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                marginBottom: 4,
                borderRadius: 6,
                cursor: 'grab',
                fontSize: 12,
                border: `1px solid ${STEP_COLORS[type]}30`,
                background: 'rgba(255,255,255,0.03)',
                color: '#cbd5e1',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = `${STEP_COLORS[type]}18`;
                (e.currentTarget as HTMLDivElement).style.borderColor = `${STEP_COLORS[type]}60`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
                (e.currentTarget as HTMLDivElement).style.borderColor = `${STEP_COLORS[type]}30`;
              }}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span>{STEP_LABELS[type]}</span>
            </div>
          ))}
        </div>

        {/* Center: ReactFlow canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ animated: true, style: DEFAULT_EDGE_STYLE }}
            fitView
            deleteKeyCode="Delete"
            proOptions={{ hideAttribution: true }}
            style={{ background: '#1a1a2e' }}
          >
            <Controls
              position="bottom-left"
              style={{ background: '#252542', borderColor: 'rgba(255,255,255,0.1)' }}
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />
            <MiniMap
              nodeColor={minimapNodeColor}
              style={{
                height: 80,
                width: 120,
                background: '#252542',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
              maskColor="rgba(0,0,0,0.6)"
              position="bottom-right"
            />
          </ReactFlow>
        </div>

        {/* Right panel: selected node properties */}
        <div
          style={{
            width: selectedNode ? 230 : 0,
            borderLeft: selectedNode ? '1px solid rgba(255,255,255,0.08)' : 'none',
            padding: selectedNode ? 10 : 0,
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.02)',
            transition: 'width 0.2s',
          }}
        >
          {selectedNode && selectedNodeData && (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 10,
                  color: 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                属性
              </div>

              {/* Label */}
              {!isTriggerSelected && (
                <>
                  <FieldRow label="名称">
                    <Input
                      size="small"
                      value={selectedNodeData.label}
                      onChange={(e) => updateNodeData('label', e.target.value)}
                    />
                  </FieldRow>

                  {/* Type */}
                  <FieldRow label="类型">
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={selectedNodeData.stepType}
                      onChange={(val) => updateNodeData('stepType', val)}
                      options={ALL_STEP_TYPES.map((t) => ({
                        label: STEP_LABELS[t],
                        value: t,
                      }))}
                    />
                  </FieldRow>

                  {/* Type-specific config */}
                  <ConfigFields
                    stepType={selectedNodeData.stepType as RpaStepType}
                    config={selectedNodeData.config as Record<string, any>}
                    onConfigChange={updateNodeConfig}
                  />

                  {/* Common fields */}
                  <FieldRow label="超时(毫秒)">
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={selectedNodeData.timeout as number | undefined}
                      onChange={(val) => updateNodeData('timeout', val)}
                      min={1000}
                      max={300000}
                      step={1000}
                      placeholder="30000"
                    />
                  </FieldRow>

                  <FieldRow label="重试次数">
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={selectedNodeData.retries as number | undefined}
                      onChange={(val) => updateNodeData('retries', val)}
                      min={0}
                      max={3}
                    />
                  </FieldRow>

                  <FieldRow label="错误处理">
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={(selectedNodeData.onError as string) || 'stop'}
                      onChange={(val) => updateNodeData('onError', val)}
                      options={[
                        { label: '停止', value: 'stop' },
                        { label: '继续', value: 'continue' },
                        { label: '降级处理', value: 'fallback' },
                      ]}
                    />
                  </FieldRow>
                </>
              )}

              {isTriggerSelected && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 20 }}>
                  这是流程起始节点。
                  <br />
                  将它连接到第一个步骤。
                </div>
              )}

              {/* Delete button */}
              {!isTriggerSelected && (
                <Space style={{ marginTop: 12 }}>
                  <Tooltip title="删除节点">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={deleteSelectedNode}
                    >
                      删除
                    </Button>
                  </Tooltip>
                </Space>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== FieldRow helper =====================

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ===================== ConfigFields =====================

function ConfigFields({
  stepType,
  config,
  onConfigChange,
}: {
  stepType: RpaStepType;
  config: Record<string, any>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const field = (key: string, label: string, placeholder?: string, multiline?: boolean) => (
    <FieldRow key={key} label={label}>
      {multiline ? (
        <Input.TextArea
          size="small"
          rows={3}
          value={config[key] || ''}
          onChange={(e) => onConfigChange(key, e.target.value)}
          placeholder={placeholder}
          style={{ fontSize: 12 }}
        />
      ) : (
        <Input
          size="small"
          value={config[key] || ''}
          onChange={(e) => onConfigChange(key, e.target.value)}
          placeholder={placeholder}
        />
      )}
    </FieldRow>
  );

  switch (stepType) {
    case 'ai_chat':
      return <>{field('prompt', 'AI 对话内容', '输入 AI 对话内容...', true)}</>;
    case 'shell_command':
      return (
        <>
          {field('command', '命令', 'ls -la')}
          {field('cwd', '工作目录', '/path/to/dir')}
        </>
      );
    case 'web_fetch':
      return (
        <>
          {field('url', 'URL', 'https://api.example.com')}
          <FieldRow label="请求方式">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={config.method || 'GET'}
              onChange={(val) => onConfigChange('method', val)}
              options={[
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' },
              ]}
            />
          </FieldRow>
          {field('headers', '请求头(JSON)', '{"Authorization": "..."}', true)}
          {config.method !== 'GET' && field('body', '请求体', '{"key": "value"}', true)}
        </>
      );
    case 'file_operation':
      return (
        <>
          <FieldRow label="操作">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={config.action || 'read'}
              onChange={(val) => onConfigChange('action', val)}
              options={[
                { label: '读取', value: 'read' },
                { label: '写入', value: 'write' },
                { label: '复制', value: 'copy' },
                { label: '删除', value: 'delete' },
                { label: '创建目录', value: 'mkdir' },
              ]}
            />
          </FieldRow>
          {field('path', '路径', '/path/to/file')}
          {config.action === 'copy' && field('destPath', '目标路径', '/path/to/dest')}
          {config.action === 'write' && field('content', '内容', 'file content...', true)}
        </>
      );
    case 'sql_query':
      return (
        <>
          {field('connectionId', '数据源', 'connection-name')}
          {field('sql', 'SQL', 'SELECT * FROM ...', true)}
          {field('params', '参数(JSON)', '[]', true)}
        </>
      );
    case 'send_email':
      return (
        <>
          {field('to', '收件人', 'user@example.com')}
          {field('subject', '主题', 'Email subject')}
          {field('template', '模板', 'task-result')}
          {field('context', '上下文(JSON)', '{}', true)}
        </>
      );
    case 'condition':
      return (
        <>
          {field('field', '变量名', 'variableName')}
          <FieldRow label="运算符">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={config.operator || 'eq'}
              onChange={(val) => onConfigChange('operator', val)}
              options={[
                { label: '==', value: 'eq' },
                { label: '!=', value: 'neq' },
                { label: '>', value: 'gt' },
                { label: '>=', value: 'gte' },
                { label: '<', value: 'lt' },
                { label: '<=', value: 'lte' },
                { label: '包含', value: 'contains' },
                { label: '存在', value: 'exists' },
              ]}
            />
          </FieldRow>
          {field('value', '比较值', 'expected value')}
          {field('expression', '表达式', 'item.status === "done"')}
        </>
      );
    case 'loop':
      return (
        <>
          {field('iteratorField', '遍历变量', 'items')}
          <FieldRow label="最大循环次数">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={config.maxIterations || 100}
              onChange={(val) => onConfigChange('maxIterations', val)}
              min={1}
              max={10000}
            />
          </FieldRow>
        </>
      );
    default:
      return null;
  }
}

// ===================== Default configs =====================

function getDefaultConfig(type: RpaStepType): Record<string, any> {
  switch (type) {
    case 'ai_chat':
      return { prompt: '' };
    case 'shell_command':
      return { command: '' };
    case 'web_fetch':
      return { url: '', method: 'GET' };
    case 'file_operation':
      return { action: 'read', path: '' };
    case 'sql_query':
      return { connectionId: '', sql: '' };
    case 'send_email':
      return { to: '', subject: '', template: 'task-result' };
    case 'condition':
      return { field: '', operator: 'eq', value: '' };
    case 'loop':
      return { iteratorField: '', maxIterations: 100 };
    default:
      return {};
  }
}

// ===================== Exported wrapper =====================

/** Wrapped with ReactFlowProvider for hooks to work */
export default function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
