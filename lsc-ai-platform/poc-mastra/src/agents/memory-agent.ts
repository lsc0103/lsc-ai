/**
 * Memory Agent
 *
 * 验证 Mastra Agent 的 Memory 持久化能力
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { deepseek } from "@ai-sdk/deepseek";

// 创建存储实例（使用内存数据库进行测试）
const storage = new LibSQLStore({
  id: "poc-memory-store",
  url: ":memory:",
});

// 创建 Memory 实例
const memory = new Memory({
  storage,
  options: {
    lastMessages: 20, // 保留最近 20 条消息
  },
});

export const memoryAgent = new Agent({
  name: "memory-agent",
  instructions: `你是一个记忆助手，能够记住用户告诉你的信息。
当用户分享个人信息（如喜好、习惯、目标等）时，你应该记住这些信息。
当用户询问之前分享的信息时，你应该能够回忆并告诉他们。

请用中文回复。`,
  model: deepseek("deepseek-chat"),
  memory,
});

// 导出 storage 以便测试时可以检查
export { storage, memory };
