/**
 * FlowConverter -- bidirectional conversion between ReactFlow graph and RpaFlowDef
 *
 * rpaFlowDefToFlow(): RpaFlowDef -> { nodes, edges }
 * flowToRpaFlowDef(): { nodes, edges } -> RpaFlowDef
 */

import type { Node, Edge } from '@xyflow/react';
import type { RpaStepDef, RpaStepType } from '../../services/workflow-api';

/** Node data shape used inside ReactFlow */
export interface FlowNodeData {
  label: string;
  stepType: RpaStepType;
  config: Record<string, any>;
  timeout?: number;
  retries?: number;
  onError?: 'stop' | 'continue' | 'fallback';
  /** Marks the trigger (start) node -- not an actual RPA step */
  isTrigger?: boolean;
  [key: string]: unknown;
}

/** Color map for step types */
export const STEP_COLORS: Record<RpaStepType, string> = {
  ai_chat: '#3b82f6',
  shell_command: '#f97316',
  web_fetch: '#06b6d4',
  file_operation: '#22c55e',
  sql_query: '#8b5cf6',
  send_email: '#ec4899',
  condition: '#8b5cf6',
  loop: '#22c55e',
};

/** Display names for step types */
export const STEP_LABELS: Record<RpaStepType, string> = {
  ai_chat: 'AI 对话',
  shell_command: '命令行',
  web_fetch: 'HTTP 请求',
  file_operation: '文件操作',
  sql_query: 'SQL 查询',
  send_email: '发送邮件',
  condition: '条件判断',
  loop: '循环',
};

/** All available step types (palette items) */
export const ALL_STEP_TYPES: RpaStepType[] = [
  'ai_chat',
  'shell_command',
  'web_fetch',
  'file_operation',
  'sql_query',
  'send_email',
  'condition',
  'loop',
];

const TRIGGER_NODE_ID = '__trigger__';

// ===================== RpaFlowDef -> ReactFlow =====================

/**
 * Convert RpaFlowDef to ReactFlow nodes and edges.
 * Adds a Trigger node at the top connected to the first step.
 */
export function rpaFlowDefToFlow(
  flowDef: { steps: RpaStepDef[]; variables?: Record<string, any> },
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const steps = flowDef.steps || [];

  // 1. Add trigger (start) node
  nodes.push({
    id: TRIGGER_NODE_ID,
    type: 'triggerNode',
    position: { x: 300, y: 0 },
    data: {
      label: '流程开始',
      stepType: 'ai_chat' as RpaStepType,
      config: {},
      isTrigger: true,
    } satisfies FlowNodeData,
  });

  // 2. Build a map of step id -> step for branch lookups
  const stepMap = new Map<string, RpaStepDef>();
  for (const s of steps) stepMap.set(s.id, s);

  // 3. Produce step nodes with auto-layout
  steps.forEach((step, index) => {
    const nodeType = getNodeType(step.type);
    const y = 120 + index * 150;
    // Condition branches: offset left/right later via edges
    const x = 300;

    nodes.push({
      id: step.id,
      type: nodeType,
      position: { x, y },
      data: {
        label: step.config.description || STEP_LABELS[step.type] || step.type,
        stepType: step.type,
        config: step.config,
        timeout: step.timeout,
        retries: step.retries,
        onError: step.onError,
      } satisfies FlowNodeData,
    });
  });

  // 4. Connect trigger -> first step
  if (steps.length > 0) {
    edges.push({
      id: `e-trigger-${steps[0]!.id}`,
      source: TRIGGER_NODE_ID,
      target: steps[0]!.id,
      animated: true,
      style: { stroke: '#3b82f6' },
    });
  }

  // 5. Connect sequential steps + explicit next + condition branches
  steps.forEach((step, index) => {
    // Condition node: true/false branches stored in config
    if (step.type === 'condition') {
      const trueBranch = step.config.trueBranch as string | undefined;
      const falseBranch = step.config.falseBranch as string | undefined;
      if (trueBranch && stepMap.has(trueBranch)) {
        edges.push({
          id: `e-${step.id}-true-${trueBranch}`,
          source: step.id,
          sourceHandle: 'true',
          target: trueBranch,
          animated: true,
          label: '是',
          style: { stroke: '#4ade80' },
        });
      }
      if (falseBranch && stepMap.has(falseBranch)) {
        edges.push({
          id: `e-${step.id}-false-${falseBranch}`,
          source: step.id,
          sourceHandle: 'false',
          target: falseBranch,
          animated: true,
          label: '否',
          style: { stroke: '#f87171' },
        });
      }
      // If no explicit branches, fall through to sequential
      if (!trueBranch && !falseBranch && index < steps.length - 1) {
        const nextStep = steps[index + 1]!;
        edges.push({
          id: `e-${step.id}-${nextStep.id}`,
          source: step.id,
          sourceHandle: 'true',
          target: nextStep.id,
          animated: true,
        });
      }
    } else if (step.next) {
      // Explicit next pointer
      edges.push({
        id: `e-${step.id}-${step.next}`,
        source: step.id,
        target: step.next,
        animated: true,
        style: { stroke: '#8b5cf6' },
      });
    } else if (index < steps.length - 1) {
      // Sequential connection
      const nextStep = steps[index + 1]!;
      edges.push({
        id: `e-${step.id}-${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        animated: true,
      });
    }
  });

  return { nodes, edges };
}

// ===================== ReactFlow -> RpaFlowDef =====================

/**
 * Convert ReactFlow nodes and edges back to RpaFlowDef.
 * Filters out the trigger node; condition nodes map true/false handles to config.
 */
export function flowToRpaFlowDef(
  nodes: Node[],
  edges: Edge[],
  variables?: Record<string, any>,
): { steps: RpaStepDef[]; variables?: Record<string, any> } {
  // Filter out trigger node
  const stepNodes = nodes.filter((n) => {
    const d = n.data as FlowNodeData;
    return !d.isTrigger && n.id !== TRIGGER_NODE_ID;
  });

  // Build adjacency: source -> { targetId, sourceHandle }
  const outgoing = new Map<string, Array<{ target: string; handle?: string }>>();
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push({ target: edge.target, handle: edge.sourceHandle ?? undefined });
  }

  // Topological sort from nodes with no incoming edges (excluding trigger)
  const hasIncoming = new Set(edges.map((e) => e.target));
  // Start from nodes that only receive edges from trigger or have no incoming
  const startCandidates = stepNodes.filter(
    (n) => !hasIncoming.has(n.id) || edges.some((e) => e.source === TRIGGER_NODE_ID && e.target === n.id),
  );
  const ordered: Node[] = [];
  const visited = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId) || nodeId === TRIGGER_NODE_ID) return;
    visited.add(nodeId);
    const node = stepNodes.find((n) => n.id === nodeId);
    if (node) {
      ordered.push(node);
      const outs = outgoing.get(nodeId) || [];
      for (const o of outs) visit(o.target);
    }
  }

  for (const s of startCandidates) visit(s.id);
  // Add any unvisited
  for (const n of stepNodes) {
    if (!visited.has(n.id)) ordered.push(n);
  }

  const steps: RpaStepDef[] = ordered.map((node) => {
    const d = node.data as FlowNodeData;
    const step: RpaStepDef = {
      id: node.id,
      type: d.stepType,
      config: { ...d.config },
    };
    if (d.timeout) step.timeout = d.timeout;
    if (d.retries) step.retries = d.retries;
    if (d.onError && d.onError !== 'stop') step.onError = d.onError;

    // Condition node: map true/false handles
    if (d.stepType === 'condition') {
      const outs = outgoing.get(node.id) || [];
      for (const o of outs) {
        if (o.handle === 'true') step.config.trueBranch = o.target;
        else if (o.handle === 'false') step.config.falseBranch = o.target;
      }
    } else {
      // Explicit next if not following sequential order
      const outs = outgoing.get(node.id) || [];
      const directNext = outs[0]?.target;
      if (directNext && directNext !== TRIGGER_NODE_ID) {
        const nodeIdx = ordered.findIndex((n) => n.id === node.id);
        const nextIdx = ordered.findIndex((n) => n.id === directNext);
        if (nextIdx !== nodeIdx + 1) {
          step.next = directNext;
        }
      }
    }

    return step;
  });

  return { steps, variables };
}

function getNodeType(stepType: RpaStepType): string {
  switch (stepType) {
    case 'condition':
      return 'conditionNode';
    case 'loop':
      return 'loopNode';
    default:
      return 'actionNode';
  }
}

/** Generate a unique step ID */
export function generateStepId(type: RpaStepType): string {
  return `${type}-${Date.now().toString(36)}`;
}
