/**
 * Sub Agent (Stub)
 * TODO: Implement full sub-agent functionality
 */

import type { Tool } from '../tools/mastra/types.js';

export type SubAgentType = 'general' | 'coder' | 'researcher' | 'analyst';

export interface SubAgentConfig {
  type: SubAgentType;
  tools: Tool[];
  cwd?: string;
  prompt?: string;
  llm?: any;
  parentContext?: any;
}

/**
 * Get tools for a specific sub-agent type
 */
export function getToolsForSubAgent(_type: SubAgentType, allTools: Tool[]): Tool[] {
  // TODO: Implement tool filtering based on sub-agent type
  return allTools;
}
