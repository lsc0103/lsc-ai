# Server 包记忆 — @lsc-ai/server

> NestJS 10 后端，ES Modules，端口 3000

## 目录结构

```
src/
├── main.ts                          # 入口
├── app.module.ts                    # 根模块
├── health.controller.ts             # 健康检查 GET /api/health
├── modules/
│   ├── agent/                       # Agent 配对/管理 (controller + service + module)
│   ├── ai/                          # LLM 服务 (llm.service.ts)
│   ├── auth/                        # JWT 认证 (controller + service + guards)
│   ├── chat/                        # 对话管理 (controller + service)
│   ├── project/                     # 项目管理
│   ├── session/                     # 会话管理
│   ├── storage/                     # MinIO 文件存储 (minio.service + upload.service)
│   ├── user/                        # 用户管理
│   ├── workflow/                    # RPA 流程 (controller + dashboard)
│   ├── audit/                       # 审计日志 (S4.5: interceptor + service + controller)
│   ├── notification/                # 通知系统 (S4.5: email + notification + controller)
│   ├── connector/                   # 外部DB连接器 (S4.5: MySQL/PG 只读查询)
│   ├── queue/                       # BullMQ 队列 (S4.5: task-execution + email processors)
│   ├── sentinel/                    # Sentinel Agent (S4.5: 指标采集 + 规则引擎 + 告警)
│   └── knowledge/                   # RAG 知识库 (S2)
├── gateway/
│   ├── chat.gateway.ts              # 对话 WebSocket (913行) — 核心入口
│   └── agent.gateway.ts             # Agent WebSocket — 任务分发
├── services/
│   ├── mastra-agent.service.ts      # AI Agent 编排 (916行) — 最重要的文件
│   ├── mastra-workflow.service.ts   # RPA Workflow (S4.5: 8种确定性步骤执行)
│   └── task-scheduler.service.ts    # CRON 调度 (S4.5: cron-parser + BullMQ 入队)
├── tools/
│   ├── core-tools.ts                # 13 个核心工具 (文件/Shell/Git/搜索)
│   ├── office-tools.ts              # 8 个 Office 工具
│   ├── advanced-tools.ts            # 9 个高级工具 (web/sql/todo/ask)
│   ├── workbench/                   # 4 个 Workbench 工具 (workbench/showCode/showTable/showChart)
│   └── mastra/                      # @lsc-ai/core 工具实现 (35个)
│       └── office/                  # Office 工具实现
├── prisma/                          # PrismaService
├── config/                          # 配置
├── common/guards/                   # JWT Guard
├── llm/                             # LLM 集成
├── skill/                           # 技能系统
└── utils/
    ├── classifier/                  # 内容分类器
    └── mcp/                         # MCP 协议 (存在但未接入!)
```

## Agent 体系

| Agent | ID | 工具 | 创建位置 |
|-------|-----|------|---------|
| Platform Agent | `platform-agent` | 全部 34 个 | `mastra-agent.service.ts` |
| Code Expert | `code-expert` | 14 个 | 同上 |
| Data Analyst | `data-analyst` | 10 个 | 同上 |
| Office Worker | `office-worker` | 10 个 | 同上 |

## 对话流程

1. **远程模式**：用户→ChatGateway→MastraAgentService.chatWithCallbacks()→platformAgent.stream()
2. **本地模式**：用户→ChatGateway→AgentService.dispatchTaskToAgent()→AgentGateway→Client Agent
3. **Network模式**：用户→ChatGateway (useNetwork:true)→MastraAgentService.networkChat()→AgentNetwork

## Memory 配置

```
LibSQL + fastembed 向量嵌入
lastMessages: 50 | semanticRecall topK:3 | workingMemory: enabled
```

## 数据库 (Prisma)

16+ 个表：User, Role, UserRole, UserPermission, Session, Project, File, ScheduledTask, TaskLog, RpaFlow, Credential, ClientAgent, SentinelAgent, AuditLog, SentinelMetric, AlertRule, AlertHistory + KnowledgeBase/Document/DocumentChunk

## 已知问题 (Server 相关)

- P0-1: `getPlatformInstructions()` 列出不存在的 git 工具
- P0-2: `advanced-tools.ts:140` TodoStore 每次新建
- P0-3: 工具三层嵌套包装
- P1-5: MCP 代码在 `utils/mcp/` 但未接入 Agent
- P1-6: 项目感知在 `mastra-agent.service.ts:392-399` 被注释

## 启动命令

```bash
# 开发模式
pnpm --filter @lsc-ai/server dev     # 或 cd packages/server && nest start --watch
# 生产模式
pnpm --filter @lsc-ai/server build && node packages/server/dist/main.js
```

## 环境变量

DATABASE_URL, REDIS_HOST/PORT/PASSWORD, MINIO_ENDPOINT/PORT/USER/PASSWORD/BUCKET,
JWT_SECRET/EXPIRES_IN/REFRESH_SECRET, DEEPSEEK_API_KEY/BASE_URL, LIBSQL_URL,
CREDENTIAL_SALT/KEY, LOG_LEVEL
