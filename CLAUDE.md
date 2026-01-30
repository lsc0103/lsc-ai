# LSC-AI 平台 — Claude Code 持久记忆

> **重要**：这是 Claude Code 的持久记忆文件。每次对话开始时自动加载。
> 对话中有重要决策、进度变更、新发现时，必须更新此文件。

---

## 一、项目概述

LSC-AI 是舟山中远海运重工的**企业级 AI 统一工作平台**，定位"看、做、管"三位一体：
- **看（Workbench）**：AI 动态构建可视化界面（代码/表格/图表/文档）
- **做（Client Agent）**：AI 在用户本地电脑执行文件操作、Shell、Office 自动化
- **管（Sentinel Agent + RPA）**：AI 监控运维、执行自动化流程和定时任务

**项目路径（本地 Windows）**：`D:\u3d-projects\lscmade7`
**项目路径（远程/Git）**：`/home/user/lsc-ai`

---

## 二、技术架构

### 2.1 整体架构

```
Web 前端 (React 18 + Ant Design 5 + Monaco + ECharts + Zustand)
    │ HTTP REST + WebSocket (Socket.IO)
    ▼
Server (NestJS 10 + ES Modules)
    ├── ChatGateway (/) — 对话流式推送
    ├── AgentGateway (/agent) — Client Agent 配对/任务分发
    ├── MastraAgentService — Platform Agent + 专业 Agent
    ├── MastraWorkflowService — RPA 流程执行
    ├── TaskSchedulerService — CRON 定时调度
    ├── PostgreSQL (Prisma) / LibSQL (Memory) / MinIO / Redis+BullMQ
    │
    │ Socket.IO
    ▼
Client Agent (用户本地) — 45+ 工具 + MCP + Mastra Agent
```

### 2.2 Monorepo 结构

```
lsc-ai-platform/
├── packages/
│   ├── server/          # NestJS 后端 (端口 3000)
│   ├── web/             # React 前端 (端口 5173)
│   └── client-agent/    # 本地代理 CLI
├── prisma/              # 数据库 Schema (13 个表, 411 行)
├── docker/              # 容器配置 (PostgreSQL, Redis, MinIO)
├── scripts/             # 工具脚本
└── poc-mastra/          # Mastra PoC 验证
```

### 2.3 AI 引擎：双引擎混合架构

- **Mastra 提供骨架**：Agent 核心、Memory (LibSQL + 向量搜索 + 工作记忆)、AgentNetwork、Workflow 引擎、Tool Schema (Zod)
- **@lsc-ai/core 提供肌肉**：45+ 内置工具、MCP 协议、项目感知、System Prompt

### 2.4 Agent 体系

| Agent | ID | 工具数 | 职责 |
|-------|-----|--------|------|
| Platform Agent | `platform-agent` | 34 | 路由/通用任务 |
| Code Expert | `code-expert` | 14 | 编程、代码分析、Git |
| Data Analyst | `data-analyst` | 10 | 数据分析、图表 |
| Office Worker | `office-worker` | 10 | 文档处理 |

### 2.5 工具清单 (Server 端 34 个)

- **Workbench (4)**：workbench, showCode, showTable, showChart
- **核心 (13)**：read, write, edit, mkdir, cp, mv, rm, ls, bash, glob, grep, git_status, git_diff
- **Office (8)**：readOffice, createWord, editWord, createExcel, editExcel, createPDF, createPPT, createChart
- **高级 (9)**：webSearch, webFetch, sql, sqlConfig, notebookEdit, todoWrite, askUser, undo, modificationHistory

### 2.6 关键依赖版本

| 依赖 | 版本 |
|------|------|
| NestJS | 10.3.0 |
| @mastra/core | 1.0.4 |
| @mastra/memory | 1.0.0 |
| @ai-sdk/deepseek | 2.0.12 |
| Prisma | 5.22 |
| React | 18.2.0 |
| Ant Design | 5.13.0 |

---

## 三、关键代码文件索引

### Server 核心

| 文件 | 路径 | 行数 | 作用 |
|------|------|------|------|
| MastraAgentService | `packages/server/src/services/mastra-agent.service.ts` | 916 | AI Agent 编排核心 |
| MastraWorkflowService | `packages/server/src/services/mastra-workflow.service.ts` | 362 | RPA Workflow 引擎 |
| TaskSchedulerService | `packages/server/src/services/task-scheduler.service.ts` | 171 | CRON 定时调度 |
| ChatGateway | `packages/server/src/gateway/chat.gateway.ts` | 913 | 对话 WebSocket 网关 |
| AgentGateway | `packages/server/src/gateway/agent.gateway.ts` | — | Agent WebSocket 网关 |
| core-tools.ts | `packages/server/src/tools/core-tools.ts` | — | 13 个核心工具 |
| office-tools.ts | `packages/server/src/tools/office-tools.ts` | — | 8 个 Office 工具 |
| advanced-tools.ts | `packages/server/src/tools/advanced-tools.ts` | — | 9 个高级工具 |
| schema.prisma | `prisma/schema.prisma` | 411 | 数据库模型 |

### Client Agent 核心

| 文件 | 路径 | 行数 | 作用 |
|------|------|------|------|
| index.ts | `packages/client-agent/src/index.ts` | 488 | CLI 入口 (7 个命令) |
| executor.ts | `packages/client-agent/src/agent/executor.ts` | 819 | 任务执行器 |
| tool-adapter.ts | `packages/client-agent/src/agent/tool-adapter.ts` | 92 | 工具格式转换 |

### 前端核心

| 文件 | 路径 | 作用 |
|------|------|------|
| Chat.tsx | `packages/web/src/pages/Chat.tsx` | 对话主界面 |
| Workbench.tsx | `packages/web/src/components/workbench/Workbench.tsx` | Workbench 容器 |
| schema/ | `packages/web/src/components/workbench/schema/` | Schema 解析渲染 |

---

## 四、开发进度

### 4.1 总进度：73% (103/141 功能完成)

### 4.2 Mastra 迁移进度：87.5% (7/8 阶段)

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1 基础框架迁移 | ✅ 完成 | Mastra 依赖、LibSQL 初始化 |
| Phase 2 工具迁移 | ✅ 完成 | 17 个工具转 Mastra createTool |
| Phase 3 Memory 升级 | ✅ 完成 | LibSQL + 语义搜索 + 工作记忆 |
| Phase 4 Agent 替换 | ✅ 完成 | Platform Agent + 3 专业 Agent |
| Phase 5 测试验证 | ⏳ 未开始 | 功能回归、性能测试 |

### 4.3 当前阶段：Phase 5 测试验证 + 问题修复

---

## 五、已知问题清单 (按优先级)

### P0 — 必须修复

1. **Instructions 与工具不匹配**
   - 文件：`mastra-agent.service.ts` → `getPlatformInstructions()`
   - Instructions 列出了不存在的 `git_log/git_add/git_commit/git_branch`
   - 已注册但 Instructions 未提及：`editWord/editExcel/sqlConfig/modificationHistory`

2. **TodoStore 每次调用新建实例** — `advanced-tools.ts:140-141`，数据无法持久化

3. **工具包装三层嵌套** — `core-tools.ts/office-tools.ts/advanced-tools.ts`，每次调用都 dynamic import + 实例化

### P1 — 重要优化

4. **AgentNetwork 未自动触发** — 只有前端传 `useNetwork:true` 才启用
5. **Platform 端无 MCP** — Server 端 MCP 代码存在但未接入
6. **项目感知未注入** — `mastra-agent.service.ts:392-399` 检测了但注释掉了
7. **Workflow/RPA 前端无入口**

### P2 — 改进项

8. Structured Output 未使用
9. Client Agent tool-adapter 丢失嵌套 Schema
10. Memory 不互通 (Platform ↔ Client Agent)
11. DeepSeek 不支持图片

---

## 六、开发计划（后续）

### Phase 5 — 测试验证 + 问题修复 (当前)
- [ ] 修复 P0 问题 (Instructions/TodoStore/工具嵌套)
- [ ] 34 个工具逐一验证
- [ ] Memory 持久化验证
- [ ] Workflow + 定时任务运行时验证

### Phase 6 — 核心能力补全
- [ ] AgentNetwork 智能触发
- [ ] Platform 端 MCP 接入
- [ ] 项目感知注入
- [ ] Structured Output for Workbench
- [ ] RPA/定时任务管理 UI

### Phase 7 — 应用化建设
- [ ] Sentinel Agent 开发
- [ ] 知识库 RAG
- [ ] IDP 文档智能处理
- [ ] 多模型支持 (视觉模型)
- [ ] Memory 同步

---

## 七、开发规则（必须遵守）

### 7.1 服务启动规则

**严禁重复启动服务，每个服务只能运行一套：**

- 前端 (web)：固定端口 **5173**，启动前必须检查并杀掉已有进程
- 后端 (server)：固定端口 **3000**，启动前必须检查并杀掉已有进程
- Client Agent：启动前必须检查是否已有实例运行
- Sentinel Agent（未来）：同上

**启动流程：**
1. 检查端口是否被占用（`netstat` 或 `lsof`）
2. 如已占用，先杀掉占用进程
3. 在后台启动服务
4. 确认启动成功（检查端口）
5. 绝不允许出现 5173、5174 等多端口运行前端的情况

### 7.2 架构文档维护

**架构总设计文档路径**：`应用化/架构文档/架构整合/`（本地：`D:\u3d-projects\lscmade7\应用化\架构文档\架构整合`）

每次涉及架构变更时，必须：
1. 先参考架构文档确认设计
2. 实施完成后更新架构文档
3. 保持文档与代码一致

### 7.3 代码规范

- Monorepo 使用 pnpm workspaces + Turborepo
- Server 端使用 ES Modules
- 所有新工具使用 Mastra `createTool` + Zod Schema
- 数据库变更通过 Prisma Migration

---

## 八、架构文档索引

| 编号 | 文档 | 路径 |
|------|------|------|
| 00 | Mastra 框架升级方案 | `应用化/架构文档/架构整合/sections/00-Mastra框架升级方案.html` |
| 01 | 架构设计总览 | `应用化/架构文档/架构整合/sections/01-架构总览.html` |
| 02 | 功能清单 (153 项) | `应用化/架构文档/架构整合/sections/02-功能清单.html` |
| 03 | 本地开发方案 | `应用化/架构文档/架构整合/sections/03-本地开发.html` |
| 04 | 数据存储设计 | `应用化/架构文档/架构整合/sections/04-数据存储.html` |
| 05 | 业务系统对接 | `应用化/架构文档/架构整合/sections/05-业务对接.html` |
| 06 | RPA 与定时任务 | `应用化/架构文档/架构整合/sections/06-RPA任务.html` |
| 07 | 安全与权限 | `应用化/架构文档/架构整合/sections/07-安全权限.html` |
| 08 | 部署方案 | `应用化/架构文档/架构整合/sections/08-部署方案.html` |
| 09 | 前端组件库 | `应用化/架构文档/架构整合/sections/09-前端组件.html` |
| 10 | IDP 智能文档 | `应用化/架构文档/架构整合/sections/10-IDP智能文档.html` |
| 11 | RAG 知识库 | `应用化/架构文档/架构整合/sections/11-RAG知识库.html` |
| 12 | Workbench 工作台 | `应用化/架构文档/架构整合/sections/12-Workbench工作台.html` |
| 13 | 前端 UI 设计规范 | `应用化/架构文档/架构整合/sections/13-前端UI设计规范.html` |
| 14 | 开发总进度 | `应用化/架构文档/架构整合/sections/14-开发总进度.html` |
| 15 | Mastra 迁移开发计划 | `应用化/架构文档/架构整合/sections/15-Mastra迁移开发计划.html` |
| 补充 | 平台现状分析报告 | `lsc-ai平台现状.md` |

---

## 九、开发会话日志

> 每次开发会话结束前，在此追加一条记录，格式如下：

### 2026-01-30 | 建立 Claude Code 持久记忆系统

**完成事项：**
- 全面阅读项目现状文档和架构设计文档
- 创建 CLAUDE.md 持久记忆文件（本文件）
- 创建 .claude/dev-log.md 开发日志文件
- 建立服务启动规则和开发规范

**当前状态：**
- Phase 5（测试验证）尚未开始
- 3 个 P0 bug 待修复
- Mastra 利用率约 55%

**下次继续：**
- 开始 Phase 5：修复 P0 问题 → 工具验证 → 运行时测试
