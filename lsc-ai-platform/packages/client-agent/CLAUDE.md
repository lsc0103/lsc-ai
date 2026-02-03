# Client Agent 包记忆 — @lsc-ai/client-agent

> 用户本地运行的 CLI 代理，通过 Socket.IO 连接 Platform

## 目录结构

```
src/
├── index.ts                   # CLI 入口 (488行, 7个命令: start/pair/config/status/unpair/daemon/autostart)
├── agent/
│   ├── executor.ts            # 任务执行器 (819行) — 核心文件
│   └── tool-adapter.ts        # @lsc-ai/core → Mastra 工具转换 (92行)
├── config/
│   └── index.ts               # 持久配置 (conf 库, platformUrl/deviceId/apiKey...)
├── socket/
│   └── client.ts              # Socket.IO 客户端 (连接/心跳/重连/任务收发)
├── system/
│   ├── autostart.ts           # 开机自启 (Windows/macOS/Linux)
│   └── tray.ts                # 系统托盘图标
└── ui/
    └── pairing.ts             # 配对码显示 (终端/GUI 双模式)
```

## 核心执行流程

```
Platform 下发任务 (Socket.IO agent:task)
  → executor.executeTask()
    → 特殊任务直接处理: file:read / file:list / file:write
    → AI 任务: 创建 Mastra Agent (id: 'client-agent')
      → 注入 100+ 工具 (45+ @lsc-ai/core + Office + MCP 扩展)
      → agent.stream(messages, { memory })
      → 流式回传: text-delta / tool-call / tool-result
  → 发送 task_result 到 Platform
```

## 工具体系

- **45+ @lsc-ai/core 原生工具**（通过 tool-adapter.ts 自动转 Mastra 格式）
- **8 个 Office 工具**
- **MCP 扩展工具**（从 `~/.lsc-ai/mcp.json` 加载第三方）
- 转换: JSON Schema → Zod (tool-adapter.ts)

## 独有能力 (Server 没有)

- MCP 协议加载第三方工具
- @lsc-ai/core 完整 System Prompt（经过大量调优）
- 本地文件系统完全访问
- 系统托盘 + 开机自启 + 守护进程模式

## Memory

LibSQL 存储在 `~/.lsc-ai/client-agent.db`，与 Server 端隔离（P2 待解决）

## 配对机制

1. `lsc-agent pair -u http://server:3000`
2. 从 Server 获取 6 位配对码（5分钟有效）
3. 用户在浏览器输入码确认
4. 收到 `agent:paired` 事件，保存 authToken + LLM 配置

## 已知问题

- P2-9: tool-adapter 对 array → `z.array(z.any())`, object → `z.record(z.any())`，嵌套类型丢失
- P2-10: Memory 与 Server 不互通

## 构建和启动

```bash
pnpm --filter @lsc-ai/client-agent build    # tsc → dist/
node packages/client-agent/dist/index.js start
node packages/client-agent/dist/index.js daemon --no-tray
```
