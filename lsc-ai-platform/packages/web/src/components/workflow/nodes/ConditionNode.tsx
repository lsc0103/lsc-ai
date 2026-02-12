import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../FlowConverter';

/**
 * ConditionNode -- Purple theme (#8b5cf6).
 * Rectangle with purple "IF" badge.
 * Target handle (top), two Source handles: left-bottom ("True") + right-bottom ("False").
 */
function ConditionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const expression =
    nodeData.config.field && nodeData.config.operator
      ? `${nodeData.config.field} ${nodeData.config.operator} ${String(nodeData.config.value ?? '')}`
      : '';

  return (
    <div
      style={{
        background: selected
          ? 'rgba(139,92,246,0.2)'
          : 'rgba(139,92,246,0.08)',
        border: `2px solid ${selected ? '#8b5cf6' : '#a78bfa'}`,
        borderRadius: 8,
        padding: '8px 16px',
        minWidth: 160,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected
          ? '0 0 10px rgba(139,92,246,0.35)'
          : 'none',
        color: '#e2e8f0',
        position: 'relative',
      }}
    >
      {/* IF badge */}
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#8b5cf6',
          color: '#fff',
          fontSize: 10,
          padding: '1px 10px',
          borderRadius: 4,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        IF
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>
        {nodeData.label}
      </div>
      {expression && (
        <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2 }}>
          {expression}
        </div>
      )}

      {/* Branch labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 9,
          fontWeight: 600,
        }}
      >
        <span style={{ color: '#4ade80' }}>True</span>
        <span style={{ color: '#f87171' }}>False</span>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#8b5cf6', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ background: '#4ade80', width: 8, height: 8, left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ background: '#f87171', width: 8, height: 8, left: '70%' }}
      />
    </div>
  );
}

export default memo(ConditionNode);
