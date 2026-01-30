# LSC-AI 平台全面现状分析报告

> **文档目的**：为外部 AI 或人员提供 LSC-AI 平台的完整现状描述，涵盖平台构建初衷、技术架构、开发进度、Mastra 框架升级情况、各模块能力分析、已知问题及后续规划。
>
> **生成时间**：2026-01-30
>
> **项目路径**：`D:\u3d-projects\lscmade7\lsc-ai-platform`

---

## 一、平台构建初衷与定位

### 1.1 背景

LSC-AI 是为舟山中远海运重工（制造业企业）自主研发的 **企业级 AI 统一工作平台**，目标是提升全体员工的工作效率。平台对标市场上的实在 Agent（AI 数字员工）和影刀 RPA（流程自动化），走的是**私有化部署 + 源码自主可控 + AI 原生能力**的差异化路线。

### 1.2 核心定位

**"看、做、管" 三位一体的 AI 平台**：

- **看**（Workbench）— AI 动态构建可视化界面，展示数据、图表、代码、文档
- **做**（Client Agent）— AI 在用户本地电脑执行文件操作、Shell 命令、Office 自动化
- **管**（Sentinel Agent + RPA）— AI 监控运维企业系统、执行自动化流程和定时任务

### 1.3 应用形态

平台规划了四种应用形态，当前聚焦第四种：

1. CLI 应用（类 Claude Code）— 已有 @lsc-ai/core 内核
2. IDE 插件 — 规划中
3. Windows 桌面应用 — 规划中
4. **Web AI 应用平台**（主力）— 当前开发中

### 1.4 竞品对比定位

基于 `RPA相关资料/AI产品分析` 的分析，LSC-AI 在 41 个企业业务场景中的覆盖率为 68%（28/41 强覆盖），对比实在 Agent 85%（35/41）、影刀 RPA 32%（13/41）。核心差距在 IDP 文档智能处理和知识库 RAG 能力，这是后续需要重点补强的方向。

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       Web 前端 (React 18)                        │
│  Ant Design 5 · Monaco Editor · ECharts · Socket.IO · Zustand    │
│  路由: /chat · /projects · /tasks · /settings                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP REST + WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server (NestJS 10 + ES Modules)                │
│                                                                   │
│  ┌── WebSocket Gateway ──────────────────────────────────────┐  │
│  │  ChatGateway (/)        — 对话流式推送、文件操作路由       │  │
│  │  AgentGateway (/agent)  — Client Agent 配对/任务分发      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌── AI 服务层 ──────────────────────────────────────────────┐  │
│  │  MastraAgentService     — Platform Agent + 专业 Agent     │  │
│  │  MastraWorkflowService  — RPA 流程执行（Mastra Workflow） │  │
│  │  TaskSchedulerService   — CRON 定时任务调度               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌── 业务模块 ───────────────────────────────────────────────┐  │
│  │  Auth · User · Session · Project · Chat · Agent ·          │  │
│  │  Storage · Workflow                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌── 存储层 ─────────────────────────────────────────────────┐  │
│  │  PostgreSQL (Prisma ORM) — 业务数据                       │  │
│  │  LibSQL (Mastra Memory) — 对话记忆 + 向量搜索             │  │
│  │  MinIO — 文件对象存储                                     │  │
│  │  Redis + BullMQ — 任务队列                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                       │ Socket.IO
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Client Agent (用户本地电脑)                          │
│  CLI 工具 (lsc-agent)                                            │
│  命令: start · pair · daemon · config · status · unpair ·        │
│        autostart                                                 │
│  能力: 45+ 工具 (@lsc-ai/core) + MCP 扩展 + Mastra Agent       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Monorepo 结构

```
lsc-ai-platform/                 # Turbo + pnpm workspaces
├── packages/
│   ├── server/                  # NestJS 后端
│   ├── web/                     # React 前端
│   └── client-agent/            # 本地代理 CLI
├── prisma/                      # 数据库 Schema
├── docker/                      # 容器配置
└── poc-mastra/                  # Mastra 框架 PoC 验证
```

### 2.3 数据库模型（Prisma Schema）

| 模型 | 用途 | 状态 |
|------|------|------|
| `User` | 用户账户 | ✅ 已使用 |
| `Role` / `UserRole` / `UserPermission` | RBAC 权限 | ✅ Schema 就绪 |
| `Session` | 对话会话（元数据在 PG，消息在 LibSQL） | ✅ 已使用 |
| `Project` | 项目管理 | ✅ 已使用 |
| `File` | 文件元数据（实体在 MinIO） | ✅ 已使用 |
| `ScheduledTask` / `TaskLog` | 定时任务 + 执行日志 | ✅ Schema + Service 就绪 |
| `RpaFlow` | RPA 流程定义 | ✅ Schema + Service 就绪 |
| `Credential` | 加密凭证存储 | ✅ Schema 就绪 |
| `ClientAgent` | 客户端代理设备注册 | ✅ 已使用 |
| `SentinelAgent` | 哨兵代理（运维监控） | ⏳ Schema 就绪，功能未开发 |
| `AuditLog` | 审计日志 | ✅ Schema 就绪 |

---

## 三、Mastra 框架升级情况

### 3.1 升级背景

平台最初基于自研的 `@lsc-ai/core` 框架（45+ 内置工具、MCP 协议、项目感知等）。2026-01-28 决定引入 Mastra 框架作为 AI 引擎，原因：

| 维度 | @lsc-ai/core | Mastra | 选择 |
|------|-------------|--------|------|
| 成熟度 | 2/5 | 4.5/5（PayPal/Adobe/Docker 在用） | Mastra |
| Agent 核心 | 自研 | 类型安全、stream API 完善 | Mastra |
| Memory 持久化 | 临时存储 | LibSQL + 向量搜索 + 工作记忆 | Mastra |
| 多 Agent 协作 | SubAgent（简陋） | AgentNetwork（原生路由委托） | Mastra |
| Workflow 引擎 | 无 | 有向图/条件分支/快照恢复 | Mastra |
| 内置工具 | 45+ 个 | 0 个 | @lsc-ai/core |
| MCP 协议 | 完整实现 | 原生支持但未使用 | @lsc-ai/core |
| 项目感知 | 有 | 无 | @lsc-ai/core |
| Office 自动化 | 8 个工具 | 无 | @lsc-ai/core |

**最终决策**：双引擎混合架构 — Mastra 提供骨架（Agent/Memory/Network/Workflow），@lsc-ai/core 提供肌肉（工具/MCP/项目感知/Prompt）。

### 3.2 升级进度

| 阶段 | 内容 | 状态 | 说明 |
|------|------|------|------|
| Phase 1 | 基础框架迁移 | ✅ 完成 | Mastra 依赖安装、LibSQL 初始化 |
| Phase 2 | 工具迁移 | ✅ 完成 | 17 个工具转为 Mastra createTool 格式 |
| Phase 3 | Memory 升级 | ✅ 完成 | LibSQL 持久化 + 语义搜索 + 工作记忆 |
| Phase 4 | Agent 替换 | ✅ 完成 | Platform Agent + 3 个专业 Agent + Workbench 工具 |
| Phase 5 | 测试验证 | ⏳ 未开始 | 功能回归、性能测试、生产验证 |

**代码完成度：87.5%（7/8 阶段）**

### 3.3 Server 端 Mastra 集成详情

#### 3.3.1 Agent 体系

| Agent | ID | 工具数 | 职责 |
|-------|-----|--------|------|
| **Platform Agent** | `platform-agent` | 30+ | 路由/通用任务，拥有所有工具 |
| **Code Expert** | `code-expert` | 14 | 编程、代码分析、Git 操作 |
| **Data Analyst** | `data-analyst` | 10 | 数据分析、图表可视化 |
| **Office Worker** | `office-worker` | 10 | 文档创建/编辑 |

所有 Agent 通过 `__registerMastra(mastra)` 接入 AgentNetwork，具备互相委托的能力。

#### 3.3.2 Platform Agent 实际注册的工具

**Workbench 工具（4个）**：
- `workbench` — 完整 Workbench Schema 创建（8 种内容块：code/table/chart/markdown/json/image/file/tabs）
- `showCode` — 快速代码展示
- `showTable` — 快速表格展示
- `showChart` — 快速图表展示（ECharts）

**核心工具（13个，来自 core-tools.ts）**：
- 文件操作：`read`, `write`, `edit`, `mkdir`, `cp`, `mv`, `rm`, `ls`
- Shell：`bash`
- 搜索：`glob`, `grep`
- Git：`git_status`, `git_diff`

**Office 工具（8个，来自 office-tools.ts）**：
- `readOffice`, `createWord`, `editWord`, `createExcel`, `editExcel`, `createPDF`, `createPPT`, `createChart`

**高级工具（9个，来自 advanced-tools.ts）**：
- `webSearch`, `webFetch`, `sql`, `sqlConfig`, `notebookEdit`, `todoWrite`, `askUser`, `undo`, `modificationHistory`

**合计**：34 个工具

#### 3.3.3 Memory 系统

```typescript
new Memory({
  storage: LibSQLStore,        // 持久化到本地/云端 LibSQL
  vector: LibSQLVector,        // 向量存储用于语义搜索
  embedder: fastembed,         // 嵌入模型
  options: {
    lastMessages: 50,          // 保留最近 50 条消息
    semanticRecall: {
      topK: 3,                 // 召回最相关的 3 条历史
      messageRange: 2,
      scope: 'resource',       // 用户级别隔离
    },
    workingMemory: {
      enabled: true,           // 持久化用户偏好/项目上下文
      template: '...',         // 结构化模板
    },
  },
});
```

#### 3.3.4 Workflow + 定时任务

**MastraWorkflowService** 已实现：
- 将 Prisma `RpaFlow` 定义转换为 Mastra Workflow
- 支持 5 种步骤类型：`ai_chat`、`file_operation`、`web_fetch`、`shell_command`、`condition/loop`
- 步骤间通过 `{{变量}}` 模板传递数据
- 与 Mastra Agent 联动执行

**TaskSchedulerService** 已实现：
- 基于 `@nestjs/schedule` 的 CRON 调度器
- 每分钟扫描数据库中的 active 任务
- 支持标准 5 段 CRON 表达式
- 执行日志记录到 `TaskLog` 表
- 自动计算下次执行时间

### 3.4 Client Agent Mastra 集成详情

Client Agent 采用**桥接模式**：保留 @lsc-ai/core 全部 45+ 工具，通过 `tool-adapter.ts` 自动转换为 Mastra 格式。

```
@lsc-ai/core Tools (45+)  ──→  tool-adapter.ts  ──→  Mastra Agent
                                (JSON Schema → Zod)
```

**核心执行流程**：

1. Platform 通过 Socket.IO 下发任务（含历史消息 + workbenchContext）
2. Client Agent 创建 Mastra Agent 实例（动态注入工作目录）
3. Agent 流式执行任务，通过 Socket.IO 回传 text-delta / tool-call / tool-result
4. 执行完成后发送 task_result

**独有能力**（Server 端没有）：
- MCP 协议加载第三方工具（通过 `mcpManager`）
- 完整 @lsc-ai/core System Prompt（经过大量调优的安全规则/工作流/格式规范）
- 本地文件系统完全访问
- 系统托盘、开机自启、守护进程模式

---

## 四、前端开发现状

### 4.1 技术栈

- React 18.2 + TypeScript
- Ant Design 5.13（UI 组件库）
- Monaco Editor（代码编辑器）
- ECharts（图表可视化）
- Socket.IO Client（实时通信）
- Zustand（状态管理）
- Framer Motion（动画）
- TanStack React Query（数据请求）

### 4.2 页面路由

| 路由 | 页面 | 状态 |
|------|------|------|
| `/login` | 登录 | ✅ 已实现 |
| `/chat` | 对话（主界面） | ✅ 已实现 |
| `/chat/:sessionId` | 会话详情 | ✅ 已实现 |
| `/projects` | 项目管理 | ✅ 基础实现 |
| `/tasks` | 任务管理 | ✅ 基础实现 |
| `/settings` | 用户设置 | ✅ 基础实现 |

### 4.3 Workbench 组件库

前端已实现丰富的 Workbench 组件体系：

**图表组件**（6个）：BarChart、LineChart、PieChart、AreaChart、ScatterChart、Gantt

**代码组件**（4个）：CodeEditor（Monaco）、CodeDiff、SQLEditor、Terminal

**数据组件**（6个）：DataTable、Card、List、Citation、Statistic、Timeline

**文件组件**（3个）：FileBrowser、FileViewer、OfficePreview

**表单组件**（5个）：Form、Input、Button、Select、DatePicker

**布局组件**（5个）：Row、Col、Container、Tabs、Collapse

**预览组件**（5个）：ImagePreview、VideoPreview、AudioPreview、PdfPreview、MarkdownView

**其他**（2个）：Alert、Progress

**交互系统**：完整的 Action 处理体系（shell/navigate/chat/api/export/custom/update 7 种 action 类型）

### 4.4 Agent 集成 UI

- `AgentInstallGuide` — Agent 安装引导
- `AgentStatusIndicator` — Agent 状态指示器
- `WorkspaceSelectModal` — 工作路径选择（私有云/本地路径）

---

## 五、对话流程详细分析

### 5.1 远程模式（Platform Agent 处理）

```
用户输入 → WebSocket 'chat:message'
  → ChatGateway.handleChatMessage()
    → 检查是否有 deviceId（否 → 远程模式）
    → 检查是否 useNetwork（否 → 单 Agent 模式）
    → 处理附件：MinIO 读取文件/图片 → 拼入消息
    → 获取会话历史：MastraAgentService.getThreadMessages()
    → MastraAgentService.chatWithCallbacks()
      → platformAgent.stream(message, { memory: { thread, resource } })
      → 遍历 fullStream：text-delta / tool-call / tool-result
      → 回调 → WebSocket emit 'chat:stream' → 前端渲染
    → 完成信号 'chat:stream' { type: 'done' }
```

### 5.2 本地模式（Client Agent 处理）

```
用户输入 → WebSocket 'chat:message' (带 deviceId)
  → ChatGateway.handleClientAgentMessage()
    → 检查 Agent 在线状态
    → 获取会话历史
    → 构建任务：{ taskId, sessionId, type: 'chat', payload: { message, history, workDir, workbenchContext } }
    → AgentService.dispatchTaskToAgent(deviceId, task)
      → AgentGateway 通过 Socket.IO 发送到 Client Agent
    → Client Agent 收到任务
      → TaskExecutor.executeTask()
        → 创建 Mastra Agent（含全部 45+ 工具）
        → agent.stream(messages, { memory })
        → 流式回传 stream/tool_call/tool_result/task_result
    → AgentGateway 收到结果 → 转发给浏览器前端
```

### 5.3 多 Agent 协作模式（AgentNetwork）

```
用户输入 → WebSocket 'chat:message' (带 useNetwork: true)
  → ChatGateway.handleNetworkMessage()
    → MastraAgentService.networkChat()
      → platformAgent.network(message, { maxSteps: 15, routing: { ... } })
      → Platform Agent 作为路由器，根据规则分派到：
        → code-expert（代码任务）
        → data-analyst（数据分析）
        → office-worker（文档处理）
      → 流式返回结果 + Agent 切换通知
```

---

## 六、各模块能力详细分析

### 6.1 能力矩阵

| 能力 | 提供方 | Server 端 | Client Agent | 状态 | 备注 |
|------|--------|-----------|-------------|------|------|
| **AI 对话** | Mastra Agent | ✅ | ✅ | 正常 | DeepSeek 模型 |
| **流式输出** | Mastra stream | ✅ | ✅ | 正常 | fullStream 读取 |
| **Memory 持久化** | Mastra Memory | ✅ | ✅ | 正常 | LibSQL + 向量搜索 |
| **工作记忆** | Mastra Working Memory | ✅ | ❌ | Server 有 | Client 未启用 |
| **语义搜索** | Mastra + fastembed | ✅ | ✅ | 正常 | topK=3 |
| **多 Agent 协作** | Mastra AgentNetwork | ✅ 代码就绪 | ❌ | 需前端触发 | 默认不启用 |
| **Workflow/RPA** | Mastra Workflow | ✅ 代码就绪 | ❌ | 未运行时验证 | 5 种步骤类型 |
| **定时任务** | NestJS Schedule | ✅ 代码就绪 | ❌ | 未运行时验证 | CRON 表达式 |
| **文件读写编辑** | @lsc-ai/core | ✅ (Mastra 包装) | ✅ (原生) | 正常 | |
| **Shell 命令** | @lsc-ai/core | ✅ | ✅ | 正常 | |
| **Git 操作** | @lsc-ai/core | ⚠️ 仅 2 个 | ✅ 全部 6 个 | 不一致 | Server 缺 log/add/commit/branch |
| **Office 自动化** | @lsc-ai/core | ✅ 8 个 | ✅ 8 个 | 正常 | Word/Excel/PDF/PPT/Chart |
| **Web 搜索/抓取** | @lsc-ai/core | ✅ | ✅ | 正常 | |
| **SQL 查询** | @lsc-ai/core | ✅ | ✅ | 正常 | |
| **MCP 协议** | @lsc-ai/core | ❌ 未接入 | ✅ 完整支持 | **差距** | Server 无 MCP |
| **项目感知** | @lsc-ai/core | ⚠️ 代码有，未注入 | ✅ | **差距** | 检测了但没用 |
| **Workbench 可视化** | 自研 Schema | ✅ 4 个工具 | ✅ (通过 prompt) | 正常 | 8 种内容块 |
| **文件浏览器** | 前端 + Agent | ✅ 路由到 Agent | ✅ | 正常 | |
| **配对机制** | 自研 | ✅ | ✅ | 正常 | 6 位码 + 5 分钟有效 |
| **Structured Output** | Mastra | ❌ 未使用 | ❌ | 未利用 | 可强制输出格式 |
| **Sentinel Agent** | 规划中 | ❌ Schema 就绪 | — | 未开发 | 运维监控 |

### 6.2 Mastra 框架能力利用率

| Mastra 能力 | 使用情况 | 利用率 | 说明 |
|-------------|---------|--------|------|
| Agent 核心 | 4 个 Agent 创建并运行 | 90% | 缺 instructions 动态更新 |
| Memory (LibSQL) | 完整配置并使用 | 95% | 存储/检索/清理全覆盖 |
| 语义搜索 (Vector) | 配置并通过 recall 使用 | 80% | 缺独立搜索 API 暴露 |
| 工作记忆 | Server 端配置模板 | 60% | 模板定义了但 AI 未主动更新 |
| AgentNetwork | 代码完整，Gateway 已接入 | 40% | 需前端传 useNetwork=true |
| createTool + Zod | 全部 34 个工具均使用 | 100% | |
| Workflow 引擎 | Service 实现完整 | 30% | 未运行时验证，前端无入口 |
| Structured Output | 完全未使用 | 0% | |
| MCP (Native) | 完全未使用 | 0% | Server 端未接入 MCP |
| Evals | 不需要 | N/A | 非业务功能 |
| Voice | 不需要 | N/A | 浏览器 Web Speech 替代 |
| Mastra Server | 不需要 | N/A | 已有 NestJS |

**综合利用率：约 55%**

---

## 七、已知问题清单

### 7.1 P0 — 必须修复（影响基本功能正确性）

#### 问题 1：Instructions 与实际工具不匹配

**文件**：`packages/server/src/services/mastra-agent.service.ts` → `getPlatformInstructions()`

**现象**：Instructions 中列出了 `git_log`、`git_add`、`git_commit`、`git_branch`，但 `coreTools` 对象中只注册了 `git_status` 和 `git_diff`。同时 `editWord`、`editExcel`、`sqlConfig`、`modificationHistory` 已注册但 Instructions 未提及。

**影响**：AI 会尝试调用不存在的工具导致报错，或不知道已有的工具存在。

#### 问题 2：TodoStore 每次调用新建实例

**文件**：`packages/server/src/tools/advanced-tools.ts:140-141`

```typescript
// 每次 execute 都新建 store，数据无法持久化
const todoStore = createTodoStore();
const tool = new TodoWriteTool(todoStore);
```

**影响**：Todo 任务列表无法跨工具调用保持，每次调用都是空白。

#### 问题 3：工具包装三层嵌套

**文件**：`core-tools.ts`、`office-tools.ts`、`advanced-tools.ts`

**现象**：每个工具的调用链为 `Mastra createTool → execute → dynamic import → new @lsc-ai/core Tool 类 → 类.execute()`。每次调用都有 dynamic import 开销和类实例化开销。

**影响**：不必要的性能浪费。Platform 端应直接在 createTool 的 execute 中写业务逻辑，或在模块顶层缓存实例。

### 7.2 P1 — 重要优化（影响核心业务场景）

#### 问题 4：AgentNetwork 未自动触发

**文件**：`packages/server/src/gateway/chat.gateway.ts:224`

**现象**：只有前端传 `useNetwork: true` 才进入多 Agent 协作。日常对话全部走单 Agent。

**影响**：跨领域复杂任务（如"分析 Excel 数据并生成 Word 报告"）无法自动利用专业 Agent。

#### 问题 5：Platform 端无 MCP 支持

**现象**：`packages/server/src/utils/mcp/` 目录存在 MCP 实现代码（client.ts、manager.ts），但 MastraAgentService 未加载任何 MCP 服务器。Client Agent 通过 `mcpManager` 完整支持 MCP。

**影响**：远程模式下用户无法使用 MCP 扩展工具（如自定义数据库连接、API 集成等）。

#### 问题 6：项目感知未实际注入

**文件**：`mastra-agent.service.ts:392-399`

```typescript
// 检测了项目上下文但没有注入到消息中
if (params.cwd && this.detectProjectContextFn) {
  const projectContext = await this.detectProjectContextFn(params.cwd);
  this.logger.log(`检测到项目类型: ${projectContext.type}`);
  // 可以将项目上下文添加到消息中  ← 注释了，没做
}
```

**影响**：AI 不知道当前项目的类型和技术栈，无法给出针对性建议。

#### 问题 7：Workflow/RPA 前端无入口

**现象**：`MastraWorkflowService` 和 `TaskSchedulerService` 代码完整，`workflow.controller.ts` 有 API 端点，但前端 `/tasks` 页面的 RPA 流程创建/管理 UI 未完善。

**影响**：用户无法通过界面创建和管理 RPA 流程和定时任务。

### 7.3 P2 — 改进项（提升体验和能力边界）

#### 问题 8：Structured Output 未使用

Mastra 支持在 `agent.generate()` 时指定 `output: z.object({...})` 强制结构化输出。当前 Workbench Schema 靠 prompt 约束，LLM 输出格式经常不符合预期。

#### 问题 9：Client Agent tool-adapter 丢失嵌套 Schema

**文件**：`packages/client-agent/src/agent/tool-adapter.ts:16-41`

`jsonSchemaPropertyToZod()` 对 `array` 类型一律转为 `z.array(z.any())`，对 `object` 一律转为 `z.record(z.any())`。嵌套结构（如 Excel sheets 定义）的类型信息丢失。

#### 问题 10：Memory 不互通

Platform 端 Memory 存在 Server 本地 LibSQL，Client Agent 存在用户电脑 `~/.lsc-ai/client-agent.db`。两端对话历史完全隔离。

#### 问题 11：DeepSeek 不支持图片

`chat.gateway.ts:307-313` 中发现图片附件时只能转为文本提示"当前模型不支持图片"。需要接入支持视觉的模型。

---

## 八、架构设计文档体系

所有架构文档位于 `应用化/架构文档/架构整合/`：

| 文档 | 内容 |
|------|------|
| `LSC-AI_vs_MASTRA_COMPARISON.md` | @lsc-ai/core 与 Mastra 能力对比 |
| `MASTRA_MIGRATION_CHECKLIST.md` | 迁移任务清单（87.5% 完成） |
| `MASTRA_MIGRATION_FINAL_SUMMARY.md` | 迁移成果总结 |
| `MASTRA_MIGRATION_README.md` | 快速开始指南 |
| `MASTRA_UPGRADE_ANALYSIS.md` | 升级影响分析 |
| `PHASE_2_COMPLETION_SUMMARY.md` | Phase 1-3 完成报告 |
| `PHASE_4_COMPLETION_SUMMARY.md` | Phase 4 完成报告 |
| `16-快速开始-Mastra迁移.md` | 迁移开发指南 |

竞品分析文档位于 `RPA相关资料/AI产品分析/`：
- 实在 Agent 分析、影刀 RPA 分析、LSC-AI 平台分析、41 个场景匹配度分析

---

## 九、能力归属决策（取长补短）

### 用 Mastra 的（Mastra 做得更好）

- Agent 核心（类型安全、stream API）
- Memory 持久化（LibSQL + 向量搜索 + 工作记忆）
- 多 Agent 协作（AgentNetwork 替代 lsc-ai SubAgent）
- Workflow 引擎（RPA 流水线编排）
- Tool Schema（Zod 验证）
- Structured Output（强制输出格式）

### 用 @lsc-ai/core 的（Mastra 没有）

- 45+ 内置业务工具（文件/Shell/Git/Office/Web/SQL）
- MCP 协议管理（加载第三方工具）
- 项目感知（检测项目类型和技术栈）
- 经过调优的 System Prompt 体系

### 不需要的（重复或无关）

- lsc-ai SubAgent/TaskTool → 用 Mastra AgentNetwork
- lsc-ai 临时 Memory → 用 Mastra LibSQL Memory
- lsc-ai Hooks 系统 → Web 平台用 WebSocket 事件
- lsc-ai Content Classifier → 平台场景不需要
- Mastra Server → 已有 NestJS
- Mastra Auth → 已有 JWT + Prisma
- Mastra Voice → 浏览器 Web Speech API 更简单
- Mastra Evals → 非业务核心

---

## 十、后续开发计划与优先级

### Phase 5（当前阶段）— 测试验证 + 问题修复

- [ ] 修复 Instructions 与工具不匹配（P0）
- [ ] 修复 TodoStore 单例问题（P0）
- [ ] 重构工具包装层去掉三层嵌套（P0）
- [ ] 运行时功能回归测试
- [ ] 34 个工具逐一验证
- [ ] Memory 持久化验证
- [ ] Workflow + 定时任务运行时验证

### Phase 6 — 核心能力补全

- [ ] AgentNetwork 智能触发（不依赖前端参数）
- [ ] Platform 端 MCP 接入
- [ ] 项目感知实际注入到消息
- [ ] Structured Output 用于 Workbench Schema
- [ ] RPA 流程管理前端 UI
- [ ] 定时任务管理前端 UI

### Phase 7 — 应用化建设

- [ ] Sentinel Agent 开发（运维监控）
- [ ] 知识库 RAG 系统
- [ ] IDP 文档智能处理
- [ ] 多模型支持（视觉模型接入）
- [ ] Memory 同步（Platform ↔ Client Agent 共享云端 LibSQL）
- [ ] 企业系统对接接口

---

## 十一、关键代码文件索引

### Server 核心

| 文件 | 路径 | 作用 |
|------|------|------|
| MastraAgentService | `server/src/services/mastra-agent.service.ts` | AI Agent 编排核心（916行） |
| MastraWorkflowService | `server/src/services/mastra-workflow.service.ts` | RPA Workflow 引擎（362行） |
| TaskSchedulerService | `server/src/services/task-scheduler.service.ts` | CRON 定时调度（171行） |
| ChatGateway | `server/src/gateway/chat.gateway.ts` | 对话 WebSocket 网关（913行） |
| AgentGateway | `server/src/gateway/agent.gateway.ts` | Agent WebSocket 网关 |
| AgentService | `server/src/modules/agent/agent.service.ts` | Agent 配对/管理 |
| SessionService | `server/src/modules/session/session.service.ts` | 会话管理 |
| core-tools.ts | `server/src/tools/core-tools.ts` | 13 个核心工具（Mastra 格式） |
| office-tools.ts | `server/src/tools/office-tools.ts` | 8 个 Office 工具（Mastra 格式） |
| advanced-tools.ts | `server/src/tools/advanced-tools.ts` | 9 个高级工具（Mastra 格式） |
| workbench/ | `server/src/tools/workbench/` | 4 个 Workbench 工具 |
| mastra/ | `server/src/tools/mastra/` | 35 个 @lsc-ai/core 工具实现 |
| schema.prisma | `prisma/schema.prisma` | 数据库模型（411行，13 个表） |

### Client Agent 核心

| 文件 | 路径 | 作用 |
|------|------|------|
| index.ts | `client-agent/src/index.ts` | CLI 入口（488行，7 个命令） |
| executor.ts | `client-agent/src/agent/executor.ts` | 任务执行器（Mastra Agent，819行） |
| tool-adapter.ts | `client-agent/src/agent/tool-adapter.ts` | 工具格式转换（92行） |
| client.ts | `client-agent/src/socket/client.ts` | Socket.IO 客户端 |
| config/index.ts | `client-agent/src/config/index.ts` | 配置管理 |

### 前端核心

| 文件 | 路径 | 作用 |
|------|------|------|
| App.tsx | `web/src/App.tsx` | 路由入口 |
| Chat.tsx | `web/src/pages/Chat.tsx` | 对话主界面 |
| Workbench.tsx | `web/src/components/workbench/Workbench.tsx` | Workbench 容器 |
| schema/ | `web/src/components/workbench/schema/` | Schema 解析渲染 |
| components/ | `web/src/components/workbench/components/` | 30+ UI 组件 |
| actions/ | `web/src/components/workbench/actions/` | 7 种交互 action |

---

## 十二、技术依赖版本

### Server

| 依赖 | 版本 | 用途 |
|------|------|------|
| NestJS | 10.3.0 | 后端框架 |
| @mastra/core | 1.0.4 | AI Agent 框架 |
| @mastra/memory | 1.0.0 | Memory 持久化 |
| @mastra/libsql | 1.0.0 | LibSQL 存储 |
| @mastra/fastembed | latest | 嵌入模型 |
| @ai-sdk/deepseek | 2.0.12 | DeepSeek 模型 |
| Prisma | 5.22 | ORM |
| Socket.IO | 4.7.0 | WebSocket |
| BullMQ | 5.1.0 | 任务队列 |
| MinIO | 7.1.0 | 文件存储 |

### Client Agent

| 依赖 | 版本 | 用途 |
|------|------|------|
| @mastra/core | 1.0.4 | AI Agent |
| @mastra/memory | 1.0.0 | Memory |
| @lsc-ai/core | workspace | 45+ 工具 |
| commander | 12.0.0 | CLI 框架 |
| inquirer | 9.2.0 | 交互式输入 |
| socket.io-client | 4.7.0 | WebSocket 客户端 |

### Web

| 依赖 | 版本 | 用途 |
|------|------|------|
| React | 18.2.0 | UI 框架 |
| Ant Design | 5.13.0 | 组件库 |
| Monaco Editor | latest | 代码编辑 |
| ECharts | latest | 图表 |
| Socket.IO Client | latest | WebSocket |
| Zustand | latest | 状态管理 |

---

## 十三、总结

LSC-AI 平台是一个**架构设计完整、核心代码已就绪、但尚未经过运行时验证**的企业级 AI 应用平台。

**已完成的部分**：
- 完整的前后端架构（NestJS + React + WebSocket）
- Mastra 框架集成（Agent/Memory/Network/Workflow）
- 34 个工具的 Mastra 化
- Client Agent 完整实现（45+ 工具 + MCP + 配对机制）
- Workbench 可视化体系（8 种内容块 + 30+ 前端组件）
- 数据库设计（13 个表，覆盖用户/会话/项目/RPA/Agent/审计）
- RPA Workflow 引擎 + CRON 调度器

**核心差距**：
- Phase 5 测试未执行，不确定实际运行效果
- Instructions 与工具不匹配等 P0 级 bug
- AgentNetwork / MCP / 项目感知等能力"写了但没接通"
- RPA/定时任务前端 UI 未完善
- Sentinel Agent 未开发
- 知识库 RAG 和文档智能处理能力缺失

**Mastra 框架能力利用率约 55%**，核心的 Agent + Memory + Tool 已充分使用，但 Workflow（已有代码待验证）、AgentNetwork（需智能触发）、Structured Output（未使用）还有显著提升空间。
