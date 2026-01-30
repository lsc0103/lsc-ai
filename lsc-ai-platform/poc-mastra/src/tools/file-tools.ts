/**
 * 文件操作工具
 *
 * 模拟 @lsc-ai/core 的文件工具，验证工具注入能力
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * 读取文件工具
 */
export const readFileTool = createTool({
  id: "read-file",
  description: "读取指定路径的文件内容。输入文件路径，返回文件内容。",
  inputSchema: z.object({
    filePath: z.string().describe("文件的绝对路径"),
    encoding: z.string().optional().default("utf-8").describe("文件编码，默认 utf-8"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath, encoding = "utf-8" }) => {
    try {
      const content = await fs.readFile(filePath, encoding as BufferEncoding);
      return {
        success: true,
        content: content.toString(),
      };
    } catch (err) {
      return {
        success: false,
        error: `读取文件失败: ${(err as Error).message}`,
      };
    }
  },
});

/**
 * 写入文件工具
 */
export const writeFileTool = createTool({
  id: "write-file",
  description: "将内容写入指定路径的文件。如果文件不存在则创建，如果存在则覆盖。",
  inputSchema: z.object({
    filePath: z.string().describe("文件的绝对路径"),
    content: z.string().describe("要写入的内容"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath, content }) => {
    try {
      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, "utf-8");
      return {
        success: true,
        message: `文件已写入: ${filePath}`,
      };
    } catch (err) {
      return {
        success: false,
        error: `写入文件失败: ${(err as Error).message}`,
      };
    }
  },
});
