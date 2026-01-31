# LSC-AI 平台全面代码审计报告

> **审计人**：产品经理 (远程 Claude Opus 4.5)
> **日期**：2026-01-31
> **范围**：Workbench 渲染、Server 端、Client Agent、前端 UI、Mastra/Core 能力利用
> **原则**：只记录真实 bug 和功能缺陷，不涉及代码风格问题

---

## 一、总览

| 领域 | 发现数量 | Critical | High | Medium | Low |
|------|---------|----------|------|--------|-----|
| Workbench 渲染链路 | 9 | 0 | 1 | 3 | 5 |
| Server 端 | 15 | 1 | 4 | 6 | 4 |
| Client Agent / 本地模式 | 11 | 0 | 3 | 5 | 3 |
| 前端 UI 交互 | 12 | 0 | 1 | 5 | 6 |
| Mastra/Core 能力利用 | 11 | 0 | 4 | 4 | 3 |
| **合计** | **58** | **1** | **13** | **23** | **21** |

> 去重后（跨领域重复的问题合并），实际独立问题约 **47 个**。

---

## 二、P0 — 必须立即修复（直接影响核心功能）

### P0-1 ⭐ showCode/showTable/showChart 工具结果不推送到 Workbench
**文件**：`server/src/gateway/chat.gateway.ts:382-395`

ChatGateway 只对 `toolCall.name === 'workbench'` 发射 `workbench:update` 事件。`showCode`、`showTable`、`showChart` 这三个工具虽然返回完整 schema，但结果从不推送到前端 Workbench。

**用户影响**：AI 调用 showCode/showTable/showChart 时，Workbench 面板无反应，用户看不到内容。只有 `workbench` 这一个工具能触发面板。

---

### P0-2 ⭐ 双重 Memory 导致 LLM 上下文重复
**文件**：`server/src/gateway/chat.gateway.ts:320-328` + `server/src/services/mastra-agent.service.ts:462-488`

handleChatMessage 手动从 Mastra Memory 取历史消息作为 `resumeMessages` 传入，同时 `stream()` 调用启用了 `memory: { thread: sessionId }`，Mastra 内部又自动加载同一份历史。历史消息被发送给 LLM **两次**。

**用户影响**：浪费 token，可能撞 context 上限导致 AI 回复质量下降或报错。

---

### P0-3 ⭐ History slice 误删最后一条真实消息
**文件**：`server/src/gateway/chat.gateway.ts:324`

`history.slice(0, -1)` 意图排除"当前消息"，但当前消息还没写入 Memory，实际删掉的是**最近一条助手回复**。

**用户影响**：AI "忘记"自己上一轮的回答，多轮对话上下文断裂。

---

### P0-4 ⭐ Workbench 校验过严：任一组件有小问题 → 整个 Schema 被拒
**文件**：`web/src/components/workbench/context/WorkbenchStore.ts:160`

`open()` 检查 `!result.valid` 就直接 return（静默无反应）。但 validator 对缺少可选字段的组件也报 error，导致 `valid=false`。尽管 `sanitizedSchema` 已去除有问题的组件、其余组件完全可用，但被整体拒绝。`mergeSchema()`、`setSchema()` 有同样问题。

**用户影响**：AI 生成 5 个 tab 的 Workbench，其中 1 个 tab 有个字段缺失 → 整个 Workbench 不显示，用户什么都看不到，无任何错误提示。

---

### P0-5 ⭐ 两套不兼容的 Schema 格式 + Platform Agent 缺乏格式指引
**文件**：
- Server 工具输出旧格式：`server/src/tools/workbench/workbench.tool.ts`（`version: "1.0"`, `blocks[]`, `type: "chart"`）
- 前端期望新格式：`web/src/components/workbench/schema/types.ts`（`type: "workbench"`, `tabs[]`, `type: "LineChart"`）
- `schema-transformer.ts` 负责转换，但转换有损且脆弱
- Platform Agent Instructions（`mastra-agent.service.ts:282-379`）完全没说明 schema 格式
- `@lsc-ai/core` 有现成的 `getWorkbenchBuilderAgentPrompt()` 包含正确格式指引，但从未被调用

**用户影响**：就是你看到的那个 bug — 图表渲染成 JSON 文本。AI 不知道该用什么格式，猜错了就渲染失败。

---

### P0-6 ⭐ Workbench 上下文 + 文件附件同时存在时，Workbench 上下文丢失
**文件**：`server/src/gateway/chat.gateway.ts:234-316`

当 workbenchContext 和 fileIds 同时存在时，第 259 行 `textMessage = message` 用了原始消息而非已拼接 workbenchContext 的 `baseMessage`，导致 workbench 上下文被丢弃。

**用户影响**：用户在 Workbench 打开状态下上传文件发消息，AI 失去对 Workbench 当前内容的感知。

---

### P0-7 ⭐ Client Agent 断连后任务永久挂起
**文件**：`server/src/gateway/agent.gateway.ts:87-106`

handleDisconnect 不清理 `taskRegistry` 和 `streamingContent`，也不向浏览器发 `done` 或 `error` 事件。

**用户影响**：Client Agent 崩溃或断网 → 用户永远看到加载中转圈，该会话永久卡死，只能刷新页面。

---

## 三、P1 — 重要问题（安全/数据/体验）

### 安全类

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| P1-S1 | Client Agent 文件操作无路径校验 — 任意文件读写 | `client-agent/src/agent/executor.ts:502-763` | 可读写用户机器上任意文件（/etc/shadow 等） |
| P1-S2 | Agent Auth Token 未加密未持久化 — 知道 deviceId 即可冒充 | `server/src/gateway/agent.gateway.ts:141` | 攻击者可冒充 Agent 接收任务 |
| P1-S3 | Session 删除/重命名无权限检查 | `server/src/modules/session/session.controller.ts:45-53` | 任意用户可删除/重命名他人会话 |
| P1-S4 | LLM API Key 明文通过 WebSocket 传输并存储客户端 | `server/src/modules/agent/agent.service.ts:124-129` | API Key 泄露 |
| P1-S5 | 配对码仅 6 位数字 + Math.random() + 无限流 | `server/src/modules/agent/agent.service.ts:55` | 可暴力破解配对码劫持 Agent |

### 数据类

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| P1-D1 | 本地模式消息不持久化到服务端 | `server/src/gateway/agent.gateway.ts:551-555` | 切回云端模式后本地模式对话历史全部丢失 |
| P1-D2 | 模式切换导致上下文断裂 | `server/src/gateway/chat.gateway.ts:609-616` | 本地↔云端切换后 AI "失忆" |
| P1-D3 | deleteThread 调用不存在的 API | `server/src/services/mastra-agent.service.ts:967-977` | 删除会话后 Memory 数据永不清理 |
| P1-D4 | 二进制文件（xlsx/docx）被当 UTF-8 文本读取 | `server/src/gateway/chat.gateway.ts:264-266` | 上传 Office 文件后 AI 收到乱码 |

### 功能类

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| P1-F1 | agent:offline 发到错误命名空间 | `server/src/gateway/agent.gateway.ts:101` | 浏览器永远收不到 Agent 离线通知 |
| P1-F2 | Socket workbench:update 替换而非合并 Schema | `web/src/services/socket.ts:617-623` | Socket 路径覆盖代码块路径累积的 tab |
| P1-F3 | 散点图/面积图转换走 fallback 显示"数据不完整" | `web/src/components/workbench/schema/schema-transformer.ts:99` | 旧格式散点图/面积图永远渲染失败 |
| P1-F4 | 停止生成后可能出现重复助手消息 | `web/src/services/socket.ts:693-731` | 用户看到同一条回复出现两次 |
| P1-F5 | 消息列表动画延迟随消息数线性增长 | `web/src/components/chat/MessageList.tsx:33` | 200 条消息的会话最后一条要等 10 秒才出现 |
| P1-F6 | AbortController 未连接到 LLM stream | `client-agent/src/agent/executor.ts:361,428` | 取消任务不停止实际 LLM 推理，继续消耗 token |
| P1-F7 | toolCallId 不匹配（tool_call vs tool_result） | `server/src/gateway/agent.gateway.ts:469,506` | 前端无法关联工具调用和结果，状态显示错误 |

---

## 四、P2 — Mastra/Core 能力未充分利用

| # | 问题 | 当前状态 | 应有状态 |
|---|------|---------|---------|
| P2-1 | AgentNetwork 前端零接入 | 后端完整实现（4 个专业 Agent），前端从不发 `useNetwork:true` | 应根据用户意图自动路由到专业 Agent |
| P2-2 | Workflow/RPA 前端无入口 | REST API 完整，前端只有占位页面 | 应有流程设计器、定时任务管理 UI |
| P2-3 | 项目感知检测了但结果丢弃 | `mastra-agent.service.ts:396-404` 检测后只打日志 | 应注入到 AI 系统提示 |
| P2-4 | Structured Output 未使用 | Workbench Schema 完全靠提示词工程 | 应对 workbench 工具返回值加 Zod Schema 约束 |
| P2-5 | @lsc-ai/core 的 WorkbenchBuilderAgentPrompt 未使用 | `localAI/packages/core/src/agent/prompts.ts:2333` | 包含正确格式指引，应被 Platform Agent 引用 |
| P2-6 | 3 个专业 Agent 不可达 | `code-expert`/`data-analyst`/`office-worker` 已创建但只能通过 Network 触发 | 至少让用户可手动选择 |
| P2-7 | Client Agent 无 Working Memory | 不记忆用户偏好 | 应启用 Working Memory |
| P2-8 | Tool Adapter 丢失嵌套 Schema | `z.array(z.any())` / `z.record(z.any())` | 应递归转换 |
| P2-9 | Platform 端无 MCP | 代码存在但未接入 | 应可发现和使用 MCP 工具 |
| P2-10 | 搜索按钮无功能 | Sidebar 搜索按钮点击无反应 | 应实现会话搜索或移除按钮 |

---

## 五、前端 UI 其他问题

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| UI-1 | Streaming 时所有 JSON 代码块被隐藏（不仅是 workbench） | `MessageBubble.tsx:137` | AI 展示普通 JSON 时流式阶段不可见 |
| UI-2 | WorkbenchSchemaBlock 流式阶段反复闪烁 | `WorkbenchSchemaBlock.tsx:34-38` | 部分 JSON 反复触发解析，idle↔error 闪烁 |
| UI-3 | 新聊天上传文件无 sessionId 关联 | `ChatInput.tsx:238` | 首条消息前上传的文件可能丢失 |
| UI-4 | MainLayout mount 时 startNewChat 可覆盖 URL 加载的会话 | `MainLayout.tsx:60-74` | 直接访问 /chat/:id 可能闪一下 WelcomeScreen |
| UI-5 | 无效 sessionId URL 静默显示欢迎页 | `Chat.tsx:29-43` | 应显示"会话不存在"错误提示 |
| UI-6 | connectSocket 重复调用时 interval 泄露 | `socket.ts:80-87` | 连接失败后内存泄露 |
| UI-7 | userClosedTabs 阻止同名 tab 被重新添加 | `WorkbenchStore.ts:155` | 关闭过的 tab 标题永远无法再打开 |
| UI-8 | closeTab 后 activeTabKey 残留 | `WorkbenchStore.ts:330-361` | 极端情况下新 Schema 可能选错初始 tab |
| UI-9 | Empty/FilePreview 类型通过校验但无渲染器 | `components/index.ts` | 显示"组件未实现"占位而非内容 |
| UI-10 | 认证失败后 socket resolve 而非 reject | `socket.ts:172-201` | 过期 token 只显示泛型错误而非跳转登录 |

---

## 六、优先修复建议

### 第一批（直接影响用户核心体验）
1. **P0-1** showCode/showTable/showChart 推送 — 改一行判断条件
2. **P0-4** 校验过严 — 改为使用 sanitizedSchema 而非拒绝
3. **P0-5** Schema 格式统一 — 引入 @lsc-ai/core 的 Prompt 或统一为新格式
4. **P0-2 + P0-3** 双重 Memory + slice 问题 — 去掉手动 resumeMessages，靠 Mastra Memory 自动管理

### 第二批（安全加固）
5. **P1-S1** 文件路径校验 — 限制在 workDir 内
6. **P1-S3** Session 权限检查
7. **P1-S4** API Key 不传客户端 — Client Agent 自行配置或用加密通道
8. **P1-S5** 配对码加强 — 用 crypto.randomBytes + 限流

### 第三批（数据完整性）
9. **P1-D1** 本地模式消息同步回服务端
10. **P0-6** 修复 workbench context + file 共存
11. **P0-7** Agent 断连清理
12. **P1-D4** 二进制文件处理

### 第四批（能力释放）
13. **P2-1** AgentNetwork 前端接入
14. **P2-3** 项目感知注入
15. **P2-8** Tool Adapter 递归转换

---

*本报告基于纯代码审查，未经运行验证。部分发现需要实际运行确认严重程度。*
