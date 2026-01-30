# LSC-AI 平台 — Claude Code 持久记忆

> **⚠️ 必读**：每次对话开始时自动加载。你必须严格遵守本文件中的所有规则。
> **⚠️ 记忆更新**：每次对话中有进度变更、新问题、重要决策时，立即更新对应文件。
> **⚠️ 会话结束前**：必须更新 `.claude/current-task.md` 和 `.claude/dev-log.md`。

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

### P0 — 必须修复
1. **Instructions 与工具不匹配** — `mastra-agent.service.ts` → `getPlatformInstructions()` 列出不存在的工具
2. **TodoStore 每次新建实例** — `advanced-tools.ts:140-141`
3. **工具包装三层嵌套** — core/office/advanced-tools 每次 dynamic import

### P1 — 重要优化
4. AgentNetwork 未自动触发（需前端传 `useNetwork:true`）
5. Platform 端无 MCP（代码存在但未接入）
6. 项目感知未注入（`mastra-agent.service.ts:392-399` 注释掉了）
7. Workflow/RPA 前端无入口

### P2 — 改进项
8. Structured Output 未使用
9. Client Agent tool-adapter 丢失嵌套 Schema
10. Memory 不互通 (Platform ↔ Client Agent)
11. DeepSeek 不支持图片

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

### 6.4 记忆维护规则

每次对话中：
1. **开始时**：读 `CLAUDE.md` (自动) + `.claude/current-task.md` + `.claude/dev-log.md` (最近3条)
2. **工作中**：完成一个任务立即更新 `current-task.md`
3. **结束前**：追加 `dev-log.md` 日志，更新 `current-task.md` 的"下次继续"
4. **发现新问题**：立即更新本文件第五节
5. **架构变更**：更新本文件 + 对应子包 CLAUDE.md + 架构文档

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
