# Mastra 框架迁移快速开始指南

**更新日期：** 2026-01-28
**预计工期：** 14 个工作日（3 周）
**开始日期：** 2026-01-28

---

## 一、立即开始

### 1.1 Phase 1: 基础框架迁移（第 1-2 天）

#### Day 1: 安装依赖

```bash
cd lsc-ai-platform/server

# 1. 安装 Mastra 依赖
npm install @mastra/core @mastra/memory @mastra/libsql @ai-sdk/deepseek zod

# 2. 创建目录结构
mkdir -p src/agents src/tools/office src/tools/file src/tools/system

# 3. 配置环境变量
echo "DEEPSEEK_API_KEY=你的DeepSeek_API_KEY" >> .env
echo "LIBSQL_URL=file:./data/lsc-ai.db" >> .env
```

#### Day 2: 创建 AgentService

参考 PoC 实现 `D:\u3d-projects\lscmade7\lsc-ai-platform\poc-mastra\src\integration\nestjs-integration.ts`

```typescript
// src/services/agent.service.ts
import { Injectable } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { deepseek } from '@ai-sdk/deepseek';

@Injectable()
export class AgentService {
  private agents: Map<string, Agent> = new Map();
  private storage: LibSQLStore;
  private memory: Memory;

  constructor() {
    this.storage = new LibSQLStore({
      id: 'lsc-ai-storage',
      url: process.env.LIBSQL_URL,
    });

    this.memory = new Memory({
      storage: this.storage,
      options: { lastMessages: 50 },
    });

    this.registerAgents();
  }

  private registerAgents() {
    const platformAgent = new Agent({
      name: 'platform-agent',
      instructions: '你是 LSC-AI 平台助手...',
      model: deepseek('deepseek-chat'),
      memory: this.memory,
    });

    this.agents.set('platform', platformAgent);
  }

  async chat(params: { agentType: string; message: string; threadId: string; resourceId: string }) {
    const agent = this.agents.get(params.agentType);
    const result = await agent.generate(params.message, {
      memory: {
        thread: params.threadId,
        resource: params.resourceId,
      },
    });
    return { text: result.text };
  }

  async *chatStream(params: { agentType: string; message: string; threadId: string; resourceId: string }) {
    const agent = this.agents.get(params.agentType);
    const stream = await agent.stream(params.message, {
      memory: {
        thread: params.threadId,
        resource: params.resourceId,
      },
    });

    for await (const chunk of stream.textStream) {
      yield { type: 'text-delta', data: { content: chunk } };
    }
    yield { type: 'finish', data: { reason: 'stop' } };
  }
}
```

---

## 二、工具迁移模板

### 2.1 转换 LSC 工具为 Mastra 格式

参考模板：

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 旧格式 (@lsc-ai/core)
export const oldReadFileTool = {
  name: 'readFile',
  description: '读取文件内容',
  parameters: { /* ... */ },
  execute: async (context) => { /* ... */ }
};

// 新格式 (Mastra)
export const readFileTool = createTool({
  id: 'read-file',
  description: '读取指定路径的文件内容',
  inputSchema: z.object({
    filePath: z.string().describe('文件的绝对路径'),
    encoding: z.string().optional().default('utf-8').describe('文件编码'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath, encoding = 'utf-8' }) => {
    try {
      const content = await fs.readFile(filePath, encoding);
      return { success: true, content: content.toString() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
});
```

### 2.2 关键差异

| 维度 | @lsc-ai/core | Mastra |
|------|--------------|--------|
| 参数接收 | `execute: async (context) => { const { filePath } = context; }` | `execute: async ({ filePath }) => { }` |
| Schema 定义 | 自定义 JSON Schema | Zod Schema (TypeScript 原生) |
| Tool 注册 | `agent.addTool(tool)` | `tools: { readFile: readFileTool }` |

---

## 三、Memory 迁移

### 3.1 从 @lsc-ai/core 到 Mastra

```typescript
// 旧方式 (@lsc-ai/core)
const result = await agent.chat({
  message: '你好',
  sessionId: '123',
  userId: 'user-001',
});

// 新方式 (Mastra)
const result = await agent.generate('你好', {
  memory: {
    thread: '123',      // sessionId → thread
    resource: 'user-001', // userId → resource
  },
});
```

### 3.2 Memory 配置

```typescript
const storage = new LibSQLStore({
  id: 'lsc-ai-storage',
  url: process.env.LIBSQL_URL, // 'file:./data/lsc-ai.db'
});

const memory = new Memory({
  storage,
  options: {
    lastMessages: 50, // 保留最近 50 条消息
  },
});
```

---

## 四、测试验证

### 4.1 基础测试

```bash
# 1. 运行 PoC 测试（参考）
cd poc-mastra
npm run test:all

# 2. 单元测试
npm test -- --grep "AgentService"

# 3. 集成测试
npm run test:e2e
```

### 4.2 测试 checklist

- [ ] 基础对话功能正常
- [ ] 流式响应正常
- [ ] Memory 持久化工作
- [ ] 工具调用成功
- [ ] Workbench Schema 输出正确
- [ ] WebSocket 实时通信正常

---

## 五、进度跟踪

### 5.1 每日进度表

| 日期 | Phase | 任务 | 状态 | 备注 |
|------|-------|------|------|------|
| Day 1 | Phase 1 | 安装依赖 | ⏳ | |
| Day 2 | Phase 1 | 重构 AgentService | ⏳ | |
| Day 3 | Phase 2 | 提取 LSC 工具 | ⏳ | |
| Day 4 | Phase 2 | 转换工具格式 | ⏳ | |
| Day 5 | Phase 2 | 验证工具调用 | ⏳ | |
| Day 6 | Phase 3 | 配置 LibSQL | ⏳ | |
| Day 7 | Phase 3 | 迁移对话历史 | ⏳ | |
| Day 8-9 | Phase 4 | Platform Agent | ⏳ | |
| Day 10 | Phase 4 | Client Agent | ⏳ | |
| Day 11 | Phase 4 | Sentinel Agent | ⏳ | |
| Day 12 | Phase 5 | 功能回归测试 | ⏳ | |
| Day 13 | Phase 5 | 性能压力测试 | ⏳ | |
| Day 14 | Phase 5 | 生产环境验证 | ⏳ | |

### 5.2 里程碑

- [ ] **M1: 基础框架就绪** (Day 2) - Mastra + DeepSeek 基础对话可用
- [ ] **M2: 工具集成完成** (Day 5) - LSC Office 工具在 Mastra 中可调用
- [ ] **M3: Memory 升级完成** (Day 7) - 对话历史正确持久化
- [ ] **M4: Agent 全面升级** (Day 11) - 三种 Agent 全部基于 Mastra
- [ ] **M5: 生产就绪** (Day 14) - 所有测试通过，可上线

---

## 六、参考资源

### 6.1 PoC 代码

所有 PoC 代码在 `D:\u3d-projects\lscmade7\lsc-ai-platform\poc-mastra`：

```
poc-mastra/
├── src/
│   ├── agents/          # Agent 示例
│   ├── tools/           # 工具示例
│   ├── tests/           # 测试用例
│   └── integration/     # NestJS 集成示例
└── package.json
```

### 6.2 文档

- **00-Mastra 框架升级方案.html** - 升级决策和 PoC 验证报告
- **15-Mastra 迁移开发计划.html** - 详细开发计划
- [Mastra 官方文档](https://mastra.ai/docs)
- [DeepSeek API 文档](https://api-docs.deepseek.com)

### 6.3 关键代码片段

参考文件：
- `poc-mastra/src/integration/nestjs-integration.ts` - NestJS 集成模式
- `poc-mastra/src/agents/memory-agent.ts` - Memory 配置示例
- `poc-mastra/src/tools/workbench-tool.ts` - Workbench Tool 示例

---

## 七、遇到问题？

### 7.1 常见问题

**Q: 工具调用参数解析失败？**
A: 检查 Zod Schema 定义，确保 execute 函数参数直接解构：`async ({ filePath }) => {}`

**Q: Memory 没有保存对话？**
A: 确保传递了 `memory: { thread, resource }` 参数

**Q: DeepSeek API 报错？**
A: 检查 API Key 配置，确保使用 `@ai-sdk/deepseek` 而不是 `@ai-sdk/openai`

### 7.2 调试技巧

```typescript
// 开启 Mastra 调试日志
process.env.MASTRA_DEBUG = 'true';

// 查看 Memory 存储
const storage = new LibSQLStore({ id: 'test', url: ':memory:' });
console.log(await storage.getThreads('user-001'));
```

---

## 八、下一步

完成迁移后：

1. ✅ 部署到预发布环境
2. ✅ 用户验收测试（UAT）
3. ✅ 上线生产环境
4. 🚀 V2 优化：Workflow 编排、RAG 升级、Multi-Agent 协作

---

**立即开始！** 🚀
