# Workbench 后端通信与 AI 集成报告

> 调查时间: 2026-02-07
> 调查范围: chat.gateway.ts, agent.gateway.ts, workbench tools, socket.ts, WorkbenchStore, Client Agent executor

---

## 1. AI -> Workbench 数据流

### 1.1 远程模式（Platform Agent 直接执行）

完整数据流链路：

```
用户消息 (browser)
  -> socket.emit('chat:message', { sessionId, message, workbenchContext })
  -> ChatGateway.handleChatMessage()
  -> MastraAgentService.chatWithCallbacks()
  -> Platform Agent 调用工具 (workbench/showTable/showChart/showCode)
  -> 工具 execute() 返回 { success: true, schema: WorkbenchSchema }
  -> onToolResult 回调 (chat.gateway.ts:396-435)
     检测 WORKBENCH_TOOL_NAMES = ['workbench', 'showTable', 'showChart', 'showCode']
     if (actualResult.schema)  ->  client.emit('workbench:update', { sessionId, schema })
  -> 前端 socket.on('workbench:update', workbenchHandler)  (socket.ts:585-636)
     -> ensureNewSchema(data.schema)  // 旧格式(v1.0 blocks) -> 新格式(tabs)
     -> validateWorkbenchSchema(transformedSchema)
     -> useWorkbenchStore.getState().loadState({ schema, visible: true, activeTabKey })
  -> Workbench 组件渲染
```

**链路状态: 完整可用**

关键代码位置：
- 服务端工具检测: `chat.gateway.ts:408-421`
- Socket emit: `chat.gateway.ts:414` — `client.emit('workbench:update', { sessionId, schema })`
- 前端接收: `socket.ts:585-636` — `workbenchHandler`
- Schema 转换: `schema-transformer.ts:38-240` — `ensureNewSchema()`
- Store 更新: `WorkbenchStore.ts:644-681` — `loadState()`

### 1.2 AgentNetwork 模式

与远程模式类似，在 `handleNetworkMessage()` 中也有 workbench 工具检测：

```
ChatGateway.handleNetworkMessage()
  -> MastraAgentService.networkChat()
  -> onToolResult 回调 (chat.gateway.ts:537-551)
     检测 WORKBENCH_TOOL_NAMES_NET = ['workbench', 'showTable', 'showChart', 'showCode']
     if (actualResult?.schema) -> client.emit('workbench:update', { sessionId, schema })
```

**链路状态: 完整可用**

### 1.3 本地模式（Client Agent 执行）

```
用户消息 (browser, deviceId 指定)
  -> ChatGateway.handleClientAgentMessage()
  -> AgentService.dispatchTaskToAgent(deviceId, task)
  -> AgentGateway.sendTaskToAgent() -> agent:task 事件
  -> Client Agent executor.ts 执行
     AI 的 instructions 中包含 workbench-schema 代码块模板
     AI 在文本流中输出 ```workbench-schema { ... } ```
  -> Client Agent socket emit 'agent:stream' { taskId, chunk }
  -> AgentGateway.handleAgentStream() -> ChatGateway.emitToUser('chat:stream', { type: 'text' })
  -> 前端收到流式文本，在 MessageBubble 中检测 workbench-schema 代码块
  -> WorkbenchSchemaBlock 组件自动解析 JSON 并调用 WorkbenchStore.open()
```

**链路状态: 功能可用，但机制不同**

关键差异：
- **远程模式**: 通过 Mastra 工具调用 -> `workbench:update` 专用事件 -> 自动推送
- **本地模式**: AI 在文本中输出 `workbench-schema` 代码块 -> 前端 markdown 渲染时解析 -> 用户点击或自动打开

断裂点分析：
- Client Agent **没有** workbench/showTable/showChart/showCode 这 4 个 Mastra 工具
- Client Agent 依赖 AI 在文本中手动输出 workbench-schema 代码块（prompt-driven）
- AgentGateway 中 **没有** workbench 工具检测逻辑（grep 确认: 0 matches）
- 即使 Client Agent 的 AI 调用了某个工具生成了 schema，也不会触发 `workbench:update` 事件

### 1.4 双重 Schema 格式问题

服务端工具（workbench.tool.ts）输出的 schema 格式是 **旧版 v1.0**:
```json
{
  "version": "1.0",
  "blocks": [{ "type": "code", ... }, { "type": "table", ... }]
}
```

前端 WorkbenchStore 期望的是 **新版 tabs 格式**:
```json
{
  "type": "workbench",
  "tabs": [{ "key": "tab1", "title": "...", "components": [...] }]
}
```

前端通过 `ensureNewSchema()` 在 3 个入口统一转换：
1. `socket.ts:606` — workbenchHandler 中
2. `WorkbenchStore.ts:162` — open() 中
3. `WorkbenchStore.ts:190` — mergeSchema() 中
4. `WorkbenchStore.ts:288` — setSchema() 中

**状态: 已修复 (P0-5)，转换链路完整**

---

## 2. Action 执行流（用户交互 -> 后端执行）

### 2.1 Action 系统架构

前端 Workbench 支持 7 种 action 类型：

| ActionType | 处理器文件 | 执行方式 | 状态 |
|------------|-----------|---------|------|
| `chat` | `chatHandler.ts` | 设置 pendingMessage，触发 ChatInput 自动发送 | **可用** |
| `api` | `apiHandler.ts` | fetch() 调用后端 REST API | **可用** |
| `export` | `exportHandler.ts` | 前端直接导出 (excel/csv/json/pdf) | **可用** |
| `update` | `updateHandler.ts` | 更新 WorkbenchStore 中的组件数据 | **可用** |
| `navigate` | `navigateHandler.ts` | 前端路由跳转或 window.open | **可用** |
| `custom` | `customHandler.ts` | 调用注册的自定义函数 | **可用** |
| `shell` | `shellHandler.ts` | 通过 AgentService API 下发到 Client Agent | **可用（需 Agent 在线）** |

### 2.2 Action 触发流程

```
用户点击 Workbench 中的按钮/行操作
  -> 组件调用 WorkbenchStore.handleAction(action, context)
  -> ActionHandler.execute(action, actionContext)
  -> 根据 action.type 分发到对应 handler
  -> handler.handle(action, context) 返回 ActionResult
  -> 如果 shouldRefresh=true，触发 CustomEvent('workbench:refresh')
```

### 2.3 关键 Action 详解

**chat action（发送消息给 AI）:**
```
用户点击按钮 -> action: { type: 'chat', message: '帮我分析这个数据' }
  -> chatHandler 解析 message 模板变量 (如 ${selectedRows})
  -> useChatStore.getState().setPendingMessage(message)
  -> ChatInput 组件监听 pendingMessage -> 自动发送到 AI
  -> AI 处理后可能再次更新 Workbench
```

**shell action（执行命令）:**
```
用户点击执行按钮 -> action: { type: 'shell', command: 'npm run build' }
  -> shellHandler 检查 Agent 连接
  -> agentApi.dispatch({ deviceId, type: 'execute', command })
  -> AgentGateway -> Client Agent 执行
  -> 结果通过 execute:stream / execute:complete 事件回传
  -> TerminalStore 接收并显示
```

### 2.4 Action 相关的组件 Schema 入口

以下组件 Schema 类型支持 action 定义：
- `DataTable.onSelectAction` — 选择行时的动作
- `DataTable.columns[].actions[]` — 行操作按钮
- `CodeEditor.onChangeAction` — 编辑内容变更
- `SQLEditor.onExecuteAction` — 执行 SQL
- `Form.onSubmitAction` — 提交表单
- `Button.action` — 按钮点击
- `FileBrowser.onSelectAction` — 选择文件
- `Card.actions[]` — 卡片操作按钮
- `List.items[].action` — 列表项点击
- `Gantt.onTaskClick` — 点击甘特图任务
- `Input/Select/DatePicker.onChangeAction` — 表单控件值变更

**状态: Action 系统架构完整，各 handler 均已实现**

---

## 3. 本地模式集成

### 3.1 Client Agent 与 Workbench 的交互

| 功能 | 实现状态 | 通信通道 | 说明 |
|------|---------|---------|------|
| AI 生成 Workbench schema | **部分可用** | 文本流中的 workbench-schema 代码块 | 依赖 prompt，非工具调用 |
| 文件列表加载 | **可用** | `file:list` -> AgentGateway -> `agent:file:list` | FileBrowser 组件使用 |
| 文件读取 | **可用** | `file:read` -> AgentGateway -> `agent:file:content` | FileViewer 组件使用 |
| 文件写入/保存 | **可用** | `file:write` -> AgentGateway -> `agent:file:writeResult` | CodeEditor 保存使用 |
| Shell 命令执行 | **可用** | `agentApi.dispatch()` -> `agent:task` | shellHandler 使用 |
| 命令流式输出 | **可用** | `agent:stream` -> `execute:stream` | Terminal 组件使用 |
| Workbench 上下文感知 | **可用** | chat:message 的 workbenchContext 参数 | 让 AI 知道用户在看什么 |

### 3.2 文件操作通信链路

```
前端 FileBrowser/FileViewer
  -> socket.emit('file:list' / 'file:read', { rootPath/filePath, deviceId })
  -> ChatGateway.handleFileList() / handleFileRead()
  -> AgentService.dispatchTaskToAgent(deviceId, task)
  -> AgentGateway.sendTaskToAgent() -> emit 'agent:task'
  -> Client Agent 处理文件操作
  -> Client Agent emit 'agent:file:list' / 'agent:file:content'
  -> AgentGateway 转发 -> ChatGateway.emitToUser('file:list' / 'file:content')
  -> 前端组件接收并渲染
```

### 3.3 CodeEditor 保存流程

```
用户在 CodeEditor 编辑代码 -> 点击保存
  -> socket.emit('file:write', { filePath, content, deviceId })
  -> ChatGateway.handleFileWrite()
  -> AgentService.dispatchTaskToAgent()
  -> Client Agent 执行文件写入
  -> 返回 'agent:file:writeResult'
  -> 前端收到 'file:writeResult' 确认
```

**状态: 文件操作链路完整可用**

### 3.4 自动加载工作目录

当用户在本地模式下进入 Workbench：
- 如果 Workbench 已有 schema（AI 之前生成的），直接渲染
- 用户可以通过 `openBlank(rootPath)` 打开空白 Workbench 并带 FileBrowser
- FileBrowser 组件初始化时会通过 `file:list` 请求文件列表
- **但不会自动弹出** — 需要 AI 在回复中包含 FileBrowser 组件，或用户手动打开

---

## 4. 工具定义清单

### 4.1 服务端 Workbench 工具

| 工具名 | 文件位置 | schema 格式 | 注册的 Agent | 是否支持 action |
|--------|---------|------------|-------------|----------------|
| `workbench` | `tools/workbench/workbench.tool.ts:101` | v1.0 blocks | Platform, Data, Office | 否（blocks 格式无 action 定义） |
| `showCode` | `tools/workbench/workbench.tool.ts:209` | v1.0 blocks | Platform, Code | 否 |
| `showTable` | `tools/workbench/workbench.tool.ts:243` | v1.0 blocks | Platform, Data, Office | 否 |
| `showChart` | `tools/workbench/workbench.tool.ts:280` | v1.0 blocks | Platform, Data | 否 |

### 4.2 Agent 工具注册表

| Agent | 可用 Workbench 工具 | 代码位置 |
|-------|-------------------|---------|
| Platform Agent (`platform-agent`) | workbench, showCode, showTable, showChart | `mastra-agent.service.ts:125-128` |
| Code Expert (`code-expert`) | showCode | `mastra-agent.service.ts:194` |
| Data Analyst (`data-analyst`) | workbench, showTable, showChart | `mastra-agent.service.ts:223-225` |
| Office Worker (`office-worker`) | workbench, showTable | `mastra-agent.service.ts:255-256` |
| **Client Agent** | **无 Workbench 工具** | instructions 中用 prompt 驱动 |

### 4.3 前端 Action Handler 清单

| handler | 文件位置 | 功能 |
|---------|---------|------|
| chatHandler | `actions/handlers/chatHandler.ts` | 发消息给 AI |
| apiHandler | `actions/handlers/apiHandler.ts` | 调用 REST API |
| exportHandler | `actions/handlers/exportHandler.ts` | 导出文件 |
| updateHandler | `actions/handlers/updateHandler.ts` | 更新组件数据 |
| navigateHandler | `actions/handlers/navigateHandler.ts` | 页面导航 |
| customHandler | `actions/handlers/customHandler.ts` | 自定义处理 |
| shellHandler | `actions/handlers/shellHandler.ts` | 执行 Shell 命令 |

---

## 5. 关键发现与断裂点

### 断裂点 1: 服务端工具 schema 格式 vs 前端期望格式不一致

**严重程度: 已修复 (P0-5)**

服务端 4 个 Workbench 工具 (`workbench.tool.ts`) 返回 v1.0 blocks 格式:
```json
{ "version": "1.0", "blocks": [...] }
```

前端 WorkbenchStore 期望 tabs 格式:
```json
{ "type": "workbench", "tabs": [...] }
```

已通过 `ensureNewSchema()` 在多个入口点统一转换。但这引入了**运行时转换开销**，且旧格式的 Zod schema 不支持 action 字段。

### 断裂点 2: 本地模式无 workbench:update 事件

**严重程度: 中等**

- 远程模式: AI 调用 showTable 等工具 -> `onToolResult` 检测 -> 发送 `workbench:update` 事件
- 本地模式: Client Agent 的 AI 在文本中输出 `workbench-schema` 代码块 -> 前端 MessageBubble 解析

问题:
1. AgentGateway 的 `handleToolResult` 方法 **没有** workbench 工具检测逻辑
2. Client Agent 没有 workbench/showTable/showChart/showCode 工具
3. Client Agent 依赖 prompt 驱动 AI 输出特定格式文本，可靠性低于工具调用
4. 如果 AI 输出的 JSON 格式有误（转义错误等），前端解析会失败

### 断裂点 3: 工具 schema 不支持 action

**严重程度: 中等**

服务端 4 个 Workbench 工具的 Zod schema（`workbench.tool.ts:9-95`）定义的是 v1.0 blocks 格式，不包含 action 字段。AI 通过工具调用生成的 schema 中不可能包含交互动作（如按钮点击、行选择等）。

前端的 WorkbenchSchema tabs 格式支持丰富的 action 定义（7 种类型），但工具产出的 schema 无法利用这些能力。

转换器 `ensureNewSchema()` 也不会添加 action 定义。

**结论: 通过工具调用路径生成的 Workbench 是纯展示型的，不支持交互。**

### 断裂点 4: Workbench 上下文注入依赖前端组装

**严重程度: 低**

`formatWorkbenchContextForAI()` 在前端组装为文本，通过 `chat:message` 的 `workbenchContext` 字段传递给后端。这意味着 AI 能感知用户当前在看什么。

但存在限制:
- 上下文只在发送新消息时传递，不是实时的
- 如果用户在 Workbench 中切换了标签页，AI 不知道（直到下一次消息）
- 文件内容预览被截断到 1000/5000 字符

### 断裂点 5: 本地模式 Workbench 不会自动打开

**严重程度: 低**

当用户连接了 Client Agent 并切换到本地模式时，Workbench 不会自动弹出文件浏览器。需要：
- AI 在回复中主动输出 workbench-schema 包含 FileBrowser
- 或用户手动触发 `openBlank(workDir)`

没有自动化的入口（如连接 Agent 后自动加载工作目录）。

### 断裂点 6: P0-6 Workbench 状态与会话绑定

**严重程度: 高（部分修复中）**

`socket.ts:588-593` 中有 P0-6 修复代码：
```typescript
if (chatState.isNewChat || chatState.currentSessionId !== data.sessionId) {
  console.log('[Socket] 新对话模式或会话不匹配，忽略 Workbench 更新');
  return;
}
```

但 WorkbenchStore 的 `persist` 中间件只持久化 `widthRatio`，schema 不会在会话切换时保存/恢复。V06-02（切换会话恢复 Workbench 状态）仍待验证。

---

## 6. 数据流总结图

```
                     远程模式                                    本地模式
                     ========                                    ========

用户输入 -----> chat:message -------+                    用户输入 -----> chat:message
                                    |                                        |
                                    v                                        v
                    MastraAgentService                          AgentService.dispatch
                    chatWithCallbacks()                         -> AgentGateway
                           |                                         |
                           v                                         v
                    Platform Agent                              Client Agent
                    工具调用:                                    AI 文本输出:
                    workbench()                                  ```workbench-schema
                    showTable()                                  { "type":"workbench",
                    showChart()                                    "tabs": [...] }
                    showCode()                                   ```
                           |                                         |
                           v                                         v
                    onToolResult                                agent:stream
                    检测 WORKBENCH_TOOL_NAMES                    -> chat:stream (text)
                           |                                         |
                           v                                         v
               workbench:update 事件                       MessageBubble 渲染
               { sessionId, schema }                       检测 workbench-schema
                           |                                代码块 -> 自动解析
                           v                                         |
              socket.ts workbenchHandler                             v
              ensureNewSchema()                            WorkbenchSchemaBlock
              validateWorkbenchSchema()                    mergeSchema() / open()
              WorkbenchStore.loadState()                              |
                           |                                         |
                           +------------------+----------------------+
                                              |
                                              v
                                     Workbench 组件渲染
                                     (30+ 组件类型)
                                              |
                                              v
                                     用户交互 (action)
                                     ActionHandler.execute()
                                     7 种 action 类型
```

---

## 7. 改进建议优先级

| 优先级 | 建议 | 影响 |
|--------|------|------|
| P0 | 让服务端工具直接输出新版 tabs schema，避免运行时转换 | 减少转换错误、支持 action |
| P1 | 在 AgentGateway.handleToolResult 中添加 workbench 工具检测 | 本地模式也支持工具驱动的 Workbench |
| P1 | 给 Client Agent 添加 workbench/showTable 等工具 | 本地模式 Workbench 可靠性提升 |
| P2 | 会话切换时保存/恢复 Workbench schema | P0-6 V06-02 |
| P2 | Agent 连接后自动打开 FileBrowser | 用户体验优化 |
| P3 | Workbench 状态变化时实时通知 AI | 更好的上下文感知 |
