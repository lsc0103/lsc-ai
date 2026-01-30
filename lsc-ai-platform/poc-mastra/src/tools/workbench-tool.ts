/**
 * Workbench 工具
 *
 * 验证 Mastra Agent 能输出 Workbench Schema
 * 这个工具模拟 LSC-AI 的 Workbench Schema 构建能力
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Workbench Tab Schema
 */
const TabSchema = z.object({
  key: z.string().describe("标签页唯一标识"),
  title: z.string().describe("标签页标题"),
  type: z.enum([
    "code",
    "table",
    "chart",
    "markdown",
    "terminal",
    "form",
    "image",
    "iframe",
  ]).describe("标签页类型"),
  content: z.any().optional().describe("标签页内容，根据 type 不同结构不同"),
  language: z.string().optional().describe("代码语言（type=code 时使用）"),
  data: z.any().optional().describe("数据内容（type=table/chart 时使用）"),
});

/**
 * Workbench Schema
 */
const WorkbenchSchema = z.object({
  title: z.string().optional().describe("工作台标题"),
  tabs: z.array(TabSchema).describe("标签页数组"),
  activeTab: z.string().optional().describe("默认激活的标签页 key"),
  actions: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["shell", "api", "navigate"]),
        command: z.string().optional(),
      })
    )
    .optional()
    .describe("操作按钮"),
});

/**
 * Workbench 构建工具
 */
export const workbenchTool = createTool({
  id: "workbench",
  description: `构建 Workbench 工作台界面。
用于在用户界面上展示代码、表格、图表等内容。
当需要向用户展示结构化内容时使用此工具。

支持的标签页类型：
- code: 代码编辑器，需要提供 content 和 language
- table: 数据表格，需要提供 data（包含 columns 和 rows）
- chart: 图表，需要提供 data（ECharts 配置）
- markdown: Markdown 文档，需要提供 content
- terminal: 终端输出，需要提供 content
- form: 表单，需要提供 data（表单配置）
- image: 图片，需要提供 content（图片 URL）
- iframe: 嵌入网页，需要提供 content（URL）`,
  inputSchema: WorkbenchSchema,
  outputSchema: z.object({
    success: z.boolean(),
    schema: WorkbenchSchema.optional(),
    message: z.string().optional(),
  }),
  execute: async (input) => {
    // 验证并返回 Schema
    // 在实际使用中，这个 Schema 会被发送到前端进行渲染
    console.log("\n[Workbench Tool] 生成的 Schema:");
    console.log(JSON.stringify(input, null, 2));

    return {
      success: true,
      schema: input,
      message: "Workbench Schema 已生成",
    };
  },
});

/**
 * 导出 Schema 类型供其他模块使用
 */
export type WorkbenchSchemaType = z.infer<typeof WorkbenchSchema>;
export type TabSchemaType = z.infer<typeof TabSchema>;
