/**
 * PoC 测试 2: Workbench Schema 输出测试
 *
 * 验证 Mastra Agent 能正确输出 Workbench Schema
 */

import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量（从项目根目录）
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

import { workbenchAgent } from "../agents/workbench-agent";

async function testWorkbenchAgent() {
  console.log("=".repeat(60));
  console.log("PoC 测试 2: Workbench Schema 输出");
  console.log("=".repeat(60));

  try {
    // 测试 1: 生成代码展示
    console.log("\n[测试 2.1] 生成代码展示 Schema...");
    const result1 = await workbenchAgent.generate(
      "请在工作台中展示一段 TypeScript 代码，内容是一个简单的 Hello World 函数"
    );
    console.log("Agent 回复:", result1.text);

    if (result1.toolCalls && result1.toolCalls.length > 0) {
      console.log("\n工具调用记录:");
      result1.toolCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. ${call.toolName}`);
        console.log("     参数:", JSON.stringify(call.args, null, 2));
      });
    }

    // 测试 2: 生成数据表格
    console.log("\n[测试 2.2] 生成数据表格 Schema...");
    const result2 = await workbenchAgent.generate(
      "请在工作台中展示一个员工信息表格，包含姓名、年龄、部门三列，显示3条示例数据"
    );
    console.log("Agent 回复:", result2.text);

    if (result2.toolCalls && result2.toolCalls.length > 0) {
      console.log("\n工具调用记录:");
      result2.toolCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. ${call.toolName}`);
        console.log("     参数:", JSON.stringify(call.args, null, 2));
      });
    }

    // 测试 3: 生成多标签页
    console.log("\n[测试 2.3] 生成多标签页 Schema...");
    const result3 = await workbenchAgent.generate(
      "请创建一个包含两个标签页的工作台：第一个标签页显示 Python 代码（打印 Hello），第二个标签页显示 Markdown 文档（标题为'说明文档'）"
    );
    console.log("Agent 回复:", result3.text);

    if (result3.toolCalls && result3.toolCalls.length > 0) {
      console.log("\n工具调用记录:");
      result3.toolCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. ${call.toolName}`);
        console.log("     参数:", JSON.stringify(call.args, null, 2));
      });
    }

    console.log("\n[测试 2] 完成 ✓");
    return { success: true };
  } catch (error) {
    console.error("\n[测试 2] 失败 ✗");
    console.error("错误:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// 运行测试
testWorkbenchAgent().then((result) => {
  console.log("\n" + "=".repeat(60));
  console.log("测试结果:", result.success ? "通过" : "失败");
  console.log("=".repeat(60));
  process.exit(result.success ? 0 : 1);
});
