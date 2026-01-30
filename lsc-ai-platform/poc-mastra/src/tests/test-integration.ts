/**
 * PoC 测试 4: NestJS Gateway 集成测试
 *
 * 验证 Mastra Agent 与 NestJS Gateway 的集成模式
 */

import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

import {
  createServices,
  MockWebSocketClient,
} from "../integration/nestjs-integration";

async function testNestJSIntegration() {
  console.log("=".repeat(60));
  console.log("PoC 测试 4: NestJS Gateway 集成");
  console.log("=".repeat(60));

  const { agentService, chatGateway } = createServices();

  try {
    // 测试 1: 直接调用 AgentService
    console.log("\n[测试 4.1] AgentService 直接调用...");
    const directResult = await agentService.chat({
      agentType: "platform",
      message: "你好，请简单介绍一下你自己",
      threadId: "integration-test-thread",
      resourceId: "integration-test-user",
    });
    console.log("直接调用结果:", directResult.text.substring(0, 100) + "...");

    // 测试 2: 通过 Gateway 流式调用
    console.log("\n[测试 4.2] Gateway 流式响应...");
    const mockClient = new MockWebSocketClient();

    await chatGateway.handleChatMessage(mockClient, {
      message: "用一句话说明什么是 TypeScript",
      threadId: "integration-test-thread",
      resourceId: "integration-test-user",
    });

    const events = mockClient.getEvents();
    console.log(`\n收到 ${events.length} 个事件`);

    // 统计事件类型
    const textDeltas = events.filter((e) => e.event === "chat-response" && e.data.type === "text-delta");
    const finishEvents = events.filter((e) => e.event === "chat-response" && e.data.type === "finish");

    console.log(`  - text-delta 事件: ${textDeltas.length} 个`);
    console.log(`  - finish 事件: ${finishEvents.length} 个`);

    // 重组完整响应
    const fullText = textDeltas.map((e) => e.data.data.content).join("");
    console.log(`  - 完整响应长度: ${fullText.length} 字符`);
    console.log(`  - 响应内容: ${fullText.substring(0, 100)}...`);

    // 测试 3: 验证 Memory 在服务中的持久化
    console.log("\n[测试 4.3] 服务内 Memory 持久化...");
    const memoryResult = await agentService.chat({
      agentType: "platform",
      message: "你还记得我刚才问了什么吗？",
      threadId: "integration-test-thread",
      resourceId: "integration-test-user",
    });
    console.log("Memory 验证:", memoryResult.text.substring(0, 150) + "...");

    // 验证 Memory 是否工作
    const remembersPreviousQuestion =
      memoryResult.text.includes("介绍") ||
      memoryResult.text.includes("TypeScript") ||
      memoryResult.text.includes("自己") ||
      memoryResult.text.includes("刚才");

    console.log(`\n服务内 Memory 持久化: ${remembersPreviousQuestion ? "✓" : "✗"}`);

    // 测试 4: 错误处理
    console.log("\n[测试 4.4] 错误处理...");
    const errorClient = new MockWebSocketClient();

    await chatGateway.handleChatMessage(errorClient, {
      message: "测试",
      // @ts-ignore - 故意使用无效的 agent type
      agentType: "invalid-agent",
      threadId: "test",
      resourceId: "test",
    });

    const errorEvents = errorClient.getEvents();
    const hasError = errorEvents.some((e) => e.event === "chat-error");
    console.log(`错误处理: ${hasError ? "✓ (正确捕获错误)" : "✗ (未能捕获错误)"}`);

    // 总结
    const allPassed =
      directResult.text.length > 0 &&
      textDeltas.length > 0 &&
      finishEvents.length > 0 &&
      hasError;

    console.log("\n[测试 4] 完成 ✓");
    return {
      success: allPassed,
      results: {
        directCall: directResult.text.length > 0,
        streaming: textDeltas.length > 0 && finishEvents.length > 0,
        memory: remembersPreviousQuestion,
        errorHandling: hasError,
      },
    };
  } catch (error) {
    console.error("\n[测试 4] 失败 ✗");
    console.error("错误:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// 运行测试
testNestJSIntegration().then((result) => {
  console.log("\n" + "=".repeat(60));
  console.log("测试结果:", result.success ? "通过" : "失败");
  if ("results" in result) {
    console.log("详细结果:");
    console.log(`  - 直接调用: ${result.results.directCall ? "✓" : "✗"}`);
    console.log(`  - 流式响应: ${result.results.streaming ? "✓" : "✗"}`);
    console.log(`  - Memory 持久化: ${result.results.memory ? "✓" : "✗"}`);
    console.log(`  - 错误处理: ${result.results.errorHandling ? "✓" : "✗"}`);
  }
  console.log("=".repeat(60));
  process.exit(result.success ? 0 : 1);
});
