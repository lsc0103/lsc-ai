/**
 * Workbench Agent
 *
 * 验证 Mastra Agent 能输出 Workbench Schema
 */

import { Agent } from "@mastra/core/agent";
import { deepseek } from "@ai-sdk/deepseek";
import { workbenchTool } from "../tools/workbench-tool";

export const workbenchAgent = new Agent({
  name: "workbench-agent",
  instructions: `你是一个 Workbench 构建助手，负责根据用户需求构建动态工作台界面。

当用户需要查看代码、数据、图表等内容时，你应该使用 workbench 工具来构建 Workbench Schema。

Workbench Schema 结构说明：
- tabs: 标签页数组，每个标签页包含 key、title、type、content 等字段
- type 可以是: code, table, chart, markdown, terminal, form, image, iframe

示例：
- 用户要求"显示一段代码"时，构建 type: "code" 的标签页
- 用户要求"显示数据表格"时，构建 type: "table" 的标签页
- 用户要求"显示图表"时，构建 type: "chart" 的标签页

请用中文回复，并在适当时候使用 workbench 工具构建界面。`,
  model: deepseek("deepseek-chat"),
  tools: {
    workbench: workbenchTool,
  },
});
