import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { STEP_LABELS, type FlowNodeData } from '../FlowConverter';
import type { RpaStepType } from '../../../services/workflow-api';

const STEP_ICONS: Record<RpaStepType, string> = {
  ai_chat: '\uD83E\uDD16',
  shell_command: '\uD83D\uDCBB',
  web_fetch: '\uD83C\uDF10',
  file_operation: '\uD83D\uDCC1',
  sql_query: '\uD83D\uDDC4\uFE0F',
  send_email: '\uD83D\uDCE7',
  condition: '\uD83D\uDD00',
  loop: '\uD83D\uDD01',
};

/**
 * ActionNode -- Orange theme (#f97316).
 * Displays step type icon + name + type label.
 * Target handle (top) + Source handle (bottom).
 */
function ActionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const icon = STEP_ICONS[nodeData.stepType] || '\u2699\uFE0F';
  const typeLabel = STEP_LABELS[nodeData.stepType] || nodeData.stepType;

  return (
    <div
      style={{
        background: selected
          ? 'rgba(249,115,22,0.2)'
          : 'rgba(249,115,22,0.08)',
        border: `2px solid ${selected ? '#f97316' : '#fb923c'}`,
        borderRadius: 8,
        padding: '8px 16px',
        minWidth: 170,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected
          ? '0 0 10px rgba(249,115,22,0.35)'
          : 'none',
        color: '#e2e8f0',
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {nodeData.label}
      </div>
      <div
        style={{
          display: 'inline-block',
          fontSize: 10,
          marginTop: 4,
          padding: '1px 8px',
          borderRadius: 4,
          background: 'rgba(249,115,22,0.2)',
          color: '#fdba74',
          fontWeight: 500,
        }}
      >
        {typeLabel}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#f97316', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#f97316', width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(ActionNode);
