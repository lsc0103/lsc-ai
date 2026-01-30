/**
 * PoC 测试 3: Memory 持久化测试
 *
 * 验证 Mastra Agent 的对话历史记忆能力
 */

import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量（从项目根目录）
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

import { memoryAgent } from "../agents/memory-agent";

async function testMemoryAgent() {
  console.log("=".repeat(60));
  console.log("PoC 测试 3: Memory 持久化");
  console.log("=".repeat(60));

  // 定义 thread 和 resource ID
  const threadId = "test-thread-001";
  const resourceId = "test-user-001";

  try {
    // 测试 1: 存储信息
    console.log("\n[测试 3.1] 存储用户偏好信息...");
    const result1 = await memoryAgent.generate(
      "请记住：我的名字叫小明，我最喜欢的颜色是蓝色，我的爱好是编程",
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      }
    );
    console.log("Agent 回复:", result1.text);

    // 测试 2: 在同一会话中追加信息
    console.log("\n[测试 3.2] 追加更多信息...");
    const result2 = await memoryAgent.generate(
      "另外，我喜欢喝咖啡，工作是软件工程师",
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      }
    );
    console.log("Agent 回复:", result2.text);

    // 测试 3: 回忆之前的信息
    console.log("\n[测试 3.3] 回忆用户信息...");
    const result3 = await memoryAgent.generate(
      "你还记得我的名字和喜欢的颜色吗？我的职业是什么？",
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      }
    );
    console.log("Agent 回复:", result3.text);

    // 验证是否记住了关键信息
    const response = result3.text.toLowerCase();
    const hasName = response.includes("小明");
    const hasColor = response.includes("蓝色") || response.includes("蓝");
    const hasJob =
      response.includes("软件工程师") ||
      response.includes("工程师") ||
      response.includes("软件");

    console.log("\n[验证结果]");
    console.log(`  记住名字 (小明): ${hasName ? "✓" : "✗"}`);
    console.log(`  记住颜色 (蓝色): ${hasColor ? "✓" : "✗"}`);
    console.log(`  记住职业 (软件工程师): ${hasJob ? "✓" : "✗"}`);

    const memoryWorks = hasName && hasColor && hasJob;

    // 测试 4: 新会话（不同 threadId）应该没有记忆
    console.log("\n[测试 3.4] 新会话记忆隔离...");
    const newThreadId = "test-thread-002";
    const result4 = await memoryAgent.generate(
      "你知道我的名字吗？",
      {
        memory: {
          thread: newThreadId,
          resource: resourceId,
        },
      }
    );
    console.log("Agent 回复:", result4.text);

    // 新会话应该不知道用户名字
    const newSessionKnowsName = result4.text.includes("小明");
    console.log(
      `\n新会话记忆隔离: ${!newSessionKnowsName ? "✓ (正确，新会话不知道名字)" : "✗ (错误，新会话不应该知道名字)"}`
    );

    console.log("\n[测试 3] 完成 ✓");
    return {
      success: memoryWorks,
      memoryIsolation: !newSessionKnowsName,
    };
  } catch (error) {
    console.error("\n[测试 3] 失败 ✗");
    console.error("错误:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// 运行测试
testMemoryAgent().then((result) => {
  console.log("\n" + "=".repeat(60));
  console.log("测试结果:", result.success ? "通过" : "失败");
  if ("memoryIsolation" in result) {
    console.log("记忆隔离:", result.memoryIsolation ? "正常" : "异常");
  }
  console.log("=".repeat(60));
  process.exit(result.success ? 0 : 1);
});
