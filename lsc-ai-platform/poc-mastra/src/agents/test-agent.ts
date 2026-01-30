/**
 * 测试 Agent
 *
 * 验证 Mastra Agent 基础功能
 */

import { Agent } from "@mastra/core/agent";
import { deepseek } from "@ai-sdk/deepseek";
import { readFileTool, writeFileTool } from "../tools/file-tools";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: `你是一个测试助手，用于验证 Mastra 框架的基础能力。
你可以：
1. 读取文件内容
2. 写入文件内容
3. 回答用户问题

请用中文回复。`,
  model: deepseek("deepseek-chat"),
  tools: {
    readFile: readFileTool,
    writeFile: writeFileTool,
  },
});
