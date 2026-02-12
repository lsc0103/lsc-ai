import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/**
 * TriggerNode -- Blue theme (#3b82f6), flow start point.
 * Only has a Source handle at the bottom (no incoming edges).
 */
function TriggerNode({ selected }: NodeProps) {
  return (
    <div
      style={{
        background: selected
          ? 'rgba(59,130,246,0.25)'
          : 'rgba(59,130,246,0.12)',
        border: `2px solid ${selected ? '#3b82f6' : '#60a5fa'}`,
        borderRadius: 10,
        padding: '10px 20px',
        minWidth: 140,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected
          ? '0 0 12px rgba(59,130,246,0.4), inset 0 1px 2px rgba(255,255,255,0.06)'
          : 'inset 0 1px 2px rgba(255,255,255,0.04)',
        color: '#e2e8f0',
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 2 }}>&#9654;</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>
        Flow Start
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#3b82f6', width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(TriggerNode);
