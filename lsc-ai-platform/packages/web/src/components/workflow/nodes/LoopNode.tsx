import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../FlowConverter';

/**
 * LoopNode -- Green theme (#22c55e).
 * Displays loop icon + name + iterator variable preview.
 * Target handle (top) + Source handle (bottom).
 */
function LoopNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const iterInfo = nodeData.config.iteratorField
    ? `遍历: ${nodeData.config.iteratorField}${nodeData.config.maxIterations ? ` (最多 ${nodeData.config.maxIterations} 次)` : ''}`
    : '';

  return (
    <div
      style={{
        background: selected
          ? 'rgba(34,197,94,0.2)'
          : 'rgba(34,197,94,0.08)',
        border: `2px solid ${selected ? '#22c55e' : '#4ade80'}`,
        borderRadius: 8,
        padding: '8px 16px',
        minWidth: 160,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected
          ? '0 0 10px rgba(34,197,94,0.35)'
          : 'none',
        color: '#e2e8f0',
        position: 'relative',
      }}
    >
      {/* LOOP badge */}
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#22c55e',
          color: '#fff',
          fontSize: 10,
          padding: '1px 10px',
          borderRadius: 4,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        LOOP
      </div>

      <div style={{ fontSize: 20, marginTop: 4, marginBottom: 2 }}>
        {'\uD83D\uDD01'}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {nodeData.label}
      </div>
      {iterInfo && (
        <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
          {iterInfo}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#22c55e', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#22c55e', width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(LoopNode);
