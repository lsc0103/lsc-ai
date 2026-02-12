# LSC-AI 平台 — Claude Code 持久记忆

## ⚠️ 自动执行指令（最高优先级）

**对话开始时，在回复用户之前，你必须先执行以下操作：**

1. 读取 `.claude/current-task.md` — 了解当前正在进行的任务
2. 读取 `.claude/dev-log.md` 的最后 80 行 — 恢复最近的开发上下文

**工作过程中，你必须自动执行：**

3. 完成一个任务后 → 立即更新 `.claude/current-task.md`（标记完成、写入下一步）
4. 发现新问题/bug → 立即更新本文件第五节「已知问题」
5. 修改了某个子包的代码 → 更新对应的 `packages/*/CLAUDE.md`

**每次对话结束前（用户说再见/结束/没有更多任务时），你必须自动执行：**

6. 更新 `.claude/current-task.md` — 写清楚当前状态和下次继续的内容
7. 在 `.claude/dev-log.md` 末尾追加本次会话日志（按日志格式）
8. 如有架构变更 → 更新本文件和架构文档

**这些操作是自动的，不需要用户提醒，不需要询问用户是否执行。**

---

## 一、项目概述

LSC-AI 是舟山中远海运重工的**企业级 AI 统一工作平台**。

- **看（Workbench）**：AI 动态构建可视化界面（代码/表格/图表/文档/8种内容块/30+前端组件）
- **做（Client Agent）**：AI 在用户本地电脑执行文件操作、Shell、Office 自动化（45+工具+MCP）
- **管（Sentinel Agent + RPA）**：AI 监控运维、执行自动化流程和定时任务（未开发）

**项目路径**：本地 `D:\u3d-projects\lscmade7` | 远程 `/home/user/lsc-ai`

---

## 二、技术架构速览

```
Web (React 18 + AntD 5 + Monaco + ECharts + Zustand) :5173
  │ REST + Socket.IO
  ▼
Server (NestJS 10 + ES Modules) :3000
  ├─ ChatGateway (/) — 对话推送
  ├─ AgentGateway (/agent) — Agent 配对/任务分发
  ├─ AI: Mastra Agent×4 + AgentNetwork + Workflow
  ├─ 存储: PostgreSQL(Prisma) + LibSQL(Memory) + MinIO + Redis(BullMQ)
  │ Socket.IO
  ▼
Client Agent (用户本地 CLI) — 45+工具 + MCP + Mastra Agent
```

**双引擎**：Mastra（Agent/Memory/Network/Workflow/Zod）+ @lsc-ai/core（工具/MCP/项目感知/Prompt）

---

## 三、Monorepo 结构

```
lsc-ai-platform/                    # pnpm workspaces + Turborepo
├── packages/server/                # NestJS 后端 → 详见 packages/server/CLAUDE.md
├── packages/web/                   # React 前端 → 详见 packages/web/CLAUDE.md
├── packages/client-agent/          # 本地代理 → 详见 packages/client-agent/CLAUDE.md
├── prisma/schema.prisma            # 13个表, 411行
├── docker/docker-compose.dev.yml   # PostgreSQL + Redis + LibSQL + MinIO
└── poc-mastra/                     # Mastra PoC
```

---

## 四、开发进度

**总进度：73%** (103/141) | **Mastra 迁移：87.5%** (Phase 1-4 完成, Phase 5 待开始)

**当前阶段：Phase 5 — 测试验证 + P0 问题修复**

详细进度和当前任务见 → `.claude/current-task.md`

---

## 五、已知问题 (必须跟踪)

### P0 — 必须修复（S01/S02 场景测试发现）
1. ✅ **Instructions 与工具不匹配** — 已添加 editWord/editExcel/sqlConfig/modificationHistory
2. ✅ **TodoStore 每次新建实例** — 已改为模块级单例 `_todoStoreSingleton`
3. ✅ **工具包装三层嵌套** — 已改为模块级 `_cache` 缓存（30个工具）
4. ✅ **P0-1 AI Instructions 强化** — 已添加关键词触发规则+工具参数示例（75%测试通过）
5. ✅ **P0-2 双重历史注入** — 已修复历史消息切片逻辑 `chat.gateway.ts:324`
6. ✅ **P0-4 Validator 有 error 就整体拒绝 schema** — 已修复 `WorkbenchStore.ts:160`（S01-09）
7. ✅ **P0-5 旧格式 schema transformer** — 已在 `WorkbenchStore.ts` 三入口集成 `ensureNewSchema()`
8. ✅ **P0-6 Workbench 状态与会话绑定** — V06-01+V06-02 已修复
9. ✅ **P0-10 ChatInput stale closure** — useAgentStore.getState() 直接读取，避免本地模式路由失败
9. ✅ **P0-7 Workbench 工具调用成功但面板不打开** — chat.gateway.ts 只处理 'workbench' 工具名，遗漏 showTable/showChart/showCode
10. ✅ **P0-8 Office 工具执行失败** — office-tools.ts 8 个 wrapper 参数名 camelCase vs snake_case 不匹配
11. ✅ **P0-9 本地 Agent 工具参数解析失败** — tool-adapter.ts execute 用 { context } 解构但 Mastra 直接传参数
12. ✅ **P0-10 ChatInput stale closure** — useCallback 闭包捕获旧 deviceId，本地模式消息未路由到 Agent

### P1 — 重要优化
8. ✅ AgentNetwork 未自动触发 — 已添加 `shouldUseAgentNetwork()` 跨领域检测（>=2 领域命中触发），兼容前端 `useNetwork` 参数
9. Platform 端无 MCP（代码存在但未接入）
10. 项目感知未注入（`mastra-agent.service.ts:392-399` 注释掉了）
11. Workflow/RPA 前端无入口

### P2 — 深度验证发现
17. ✅ Agent 连续操作时 `isExecuting` 锁导致"Agent is busy"报错 — 已改为任务队列（max 5），满了才拒绝

### P2 — 改进项
12. Structured Output 未使用
13. Client Agent tool-adapter 丢失嵌套 Schema
14. Memory 不互通 (Platform ↔ Client Agent)
15. DeepSeek 不支持图片
16. ✅ Workbench Tab 追加模式 — `mergeSchema` 已实现：同 key 更新 + 新 Tab 追加 + 用户关闭不恢复
18. ✅ FileBrowser 在本地模式下未自动出现 — ChatInput.tsx useEffect 监听 Agent 连接，自动注入 FileBrowser
19. ✅ Monaco Editor 延迟加载 — 三组件统一 Skeleton 占位 + `data-monaco-loaded` 属性

### P2 — PM Review 发现（待工程团队评估）
20. R-3: AgentNetwork `shouldUseAgentNetwork()` 关键词硬编码，复杂自然语言可能漏触发。后续可考虑 LLM 轻量意图分类替代正则
21. R-4: `cancelCurrentTask()` 循环 `sendTaskResult()` 无 await。Socket.IO emit 异步非阻塞，理论无影响，请工程确认

> 修复一个问题后，立即在此标记 ✅ 并更新 dev-log

---

## 六、开发规则（必须遵守）

### 6.1 服务管理 — 严禁重复运行

| 服务 | 固定端口 | 启动前检查 |
|------|---------|-----------|
| web 前端 | **5173** | `lsof -i:5173` 或 `netstat -tlnp \| grep 5173` |
| server 后端 | **3000** | `lsof -i:3000` 或 `netstat -tlnp \| grep 3000` |
| client-agent | 无端口 | `ps aux \| grep client-agent` |
| sentinel-agent | 待定 | 待定 |

**启动流程**：检查端口→杀已有进程→后台启动→确认成功。**绝不允许**出现 5173+5174 等多端口情况。

### 6.2 架构文档维护

**路径**：`应用化/架构文档/架构整合/`（本地 `D:\u3d-projects\lscmade7\应用化\架构文档\架构整合`）

涉及架构变更时：先参考文档→实施→更新文档。保持文档与代码一致。

### 6.3 代码规范

- Monorepo: pnpm workspaces + Turborepo
- Server: ES Modules, NestJS 模块化
- 新工具: Mastra `createTool` + Zod Schema
- 数据库: Prisma Migration
- 禁止引入不必要的依赖

### 6.4 记忆维护

记忆读写规则见本文件顶部「自动执行指令」，无需用户提醒，全部自动执行。

---

## 七、记忆系统文件索引

| 文件 | 用途 | 更新频率 |
|------|------|---------|
| `CLAUDE.md`（本文件） | 项目级永久知识 | 有重大变更时 |
| `.claude/current-task.md` | 当前任务上下文 | 每次任务切换时 |
| `.claude/dev-log.md` | 会话开发日志 | 每次会话结束前 |
| `packages/server/CLAUDE.md` | Server 包详细记忆 | Server 代码变更时 |
| `packages/web/CLAUDE.md` | Web 包详细记忆 | Web 代码变更时 |
| `packages/client-agent/CLAUDE.md` | Client Agent 详细记忆 | Agent 代码变更时 |

---

## 八、架构文档索引

`应用化/架构文档/架构整合/sections/` 下 16 个文档：
00-Mastra框架升级方案 | 01-架构总览 | 02-功能清单(153项) | 03-本地开发 | 04-数据存储 | 05-业务对接 | 06-RPA任务 | 07-安全权限 | 08-部署方案 | 09-前端组件 | 10-IDP智能文档 | 11-RAG知识库 | 12-Workbench工作台 | 13-前端UI设计规范 | 14-开发总进度 | 15-Mastra迁移开发计划

补充：`lsc-ai平台现状.md` — 完整现状分析报告（683行）
