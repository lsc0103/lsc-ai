/**
 * PoC 测试 1: 基础 Agent 功能测试
 *
 * 验证 Mastra Agent 基础对话和工具调用能力
 */

import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量（从项目根目录）
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

import { testAgent } from "../agents/test-agent";

async function testBasicAgent() {
  console.log("=".repeat(60));
  console.log("PoC 测试 1: 基础 Agent 功能");
  console.log("=".repeat(60));

  try {
    // 测试 1: 简单对话
    console.log("\n[测试 1.1] 简单对话...");
    const result1 = await testAgent.generate("你好，请介绍一下你自己");
    console.log("Agent 回复:", result1.text);

    // 测试 2: 工具调用 - 读取文件
    console.log("\n[测试 1.2] 工具调用 - 读取文件...");
    const testFilePath = process.cwd() + "/package.json";
    const result2 = await testAgent.generate(
      `请读取这个文件的内容: ${testFilePath}`
    );
    console.log("Agent 回复:", result2.text);

    // 检查工具调用
    if (result2.toolCalls && result2.toolCalls.length > 0) {
      console.log("\n工具调用记录:");
      result2.toolCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. ${call.toolName}`, call.args);
      });
    }

    console.log("\n[测试 1] 完成 ✓");
    return { success: true };
  } catch (error) {
    console.error("\n[测试 1] 失败 ✗");
    console.error("错误:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// 运行测试
testBasicAgent().then((result) => {
  console.log("\n" + "=".repeat(60));
  console.log("测试结果:", result.success ? "通过" : "失败");
  console.log("=".repeat(60));
  process.exit(result.success ? 0 : 1);
});
