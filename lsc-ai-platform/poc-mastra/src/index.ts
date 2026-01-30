/**
 * Mastra PoC - 主入口
 *
 * 验证 Mastra 框架与 LSC-AI 架构的兼容性
 */

import { Mastra } from "@mastra/core";
import { testAgent } from "./agents/test-agent";
import { workbenchAgent } from "./agents/workbench-agent";

// 创建 Mastra 实例
export const mastra = new Mastra({
  agents: {
    testAgent,
    workbenchAgent,
  },
});

export { testAgent, workbenchAgent };
