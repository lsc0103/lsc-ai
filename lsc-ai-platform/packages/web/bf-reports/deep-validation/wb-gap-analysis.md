# Workbench 深度调查 — 架构设计 vs 当前实现 差距分析

> 调查日期: 2026-02-07
> 调查团队: 3 个 Agent（架构文档 + 前端代码 + 后端通信）
> 触发原因: 用户反馈"Mastra 升级前用过的 Workbench 交互功能现在看不到了"

---

## 一、调查背景

用户明确指出以下场景在 Mastra 升级前可以使用，现在消失了：

1. **AI 在 Workbench 中生成交互按钮**，用户点击后触发自定义功能
2. **本地模式进入后，Workbench 自动显示工作目录内容**供用户浏览
3. **打开代码文件后可以编辑并保存到本地电脑**

本次调查组建 3 人团队：
- `arch-researcher`: 阅读架构设计文档（16 个 HTML 文档）
- `wb-frontend`: 深度阅读 Workbench 前端代码（~8000 行）
- `wb-backend`: 阅读后端通信 + AI 集成代码

详细报告：
- `wb-architecture-design.md` — 架构设计功能清单
- `wb-frontend-status.md` — 前端实现状态报告
- `wb-backend-status.md` — 后端通信与 AI 集成报告

---

## 二、核心结论

### 前端代码完整无缺 — 功能没有丢失

| 维度 | 架构文档设计 | 前端实际实现 | 差距 |
|------|-------------|-------------|------|
| 组件库 | 30+ 组件（含 P2 缺失标记） | **36 种已注册**（含 Gantt/ScatterChart/SQLEditor/Citation） | 超额完成 |
| Action 系统 | 7 种 action 类型 | **7 种 handler 全部实现** | 完整 |
| 交互按钮 | AI 生成按钮+用户点击触发 | Button.action、DataTable 行操作、Card actions、Form onSubmit 等 | 完整 |
| 文件浏览 | 本地模式文件树 | FileBrowser + FileService（Socket.IO file:list/read/write） | 完整 |
| 代码编辑+保存 | 编辑后写回本地 | FileViewer 编辑模式 + FileService.saveFile() | 完整 |
| 模板变量 | `${selectedRows}` 等 | templateParser.ts 支持 6 种内置变量 + 深度解析 | 完整 |
| 数据联动 | 组件间数据传递 | useComponentData / useSelectedRows / useFormValues | 完整 |

> **架构文档自评"交互能力 0%、数据联动 0%"是不准确的** — 前端代码已经全部实现了这些功能。

### 问题出在 Mastra 迁移时 Server/Agent 层的对接断裂

**功能不是没做，而是做好的功能被 Mastra 迁移切断了连接线。**

---

## 三、6 个断裂点详细分析

### 断裂点 1（P0/关键）：服务端工具只能生成"纯展示型"Workbench

**现象**: AI 调用 workbench/showTable/showChart/showCode 工具生成的内容没有交互按钮。

**根因**: `workbench.tool.ts` 中 4 个工具的 Zod schema 使用 v1.0 blocks 格式，**不包含 action 字段**。

```
AI 工具调用 → 只能生成 { version:"1.0", blocks:[...] } → 无 action 定义
前端 ensureNewSchema() 转换 → 只转结构，不添加 action
→ 渲染结果 = 纯展示，没有交互按钮
```

前端的 7 种 action handler（chat/api/export/navigate/update/custom/shell）全部闲置，因为数据源头没有 action。

**影响**: 架构设计中的 16 个应用场景的交互能力全部不可用：
- "一键应用所有建议" / "导出 Excel" / "生成周报" / "AI 智能诊断" 等按钮无法生成
- 表格行操作、表单提交触发 AI 等交互无法使用
- 数据联动（表格选中行→图表更新）无法触发

### 断裂点 2（P0/关键）：Client Agent 没有 Workbench 工具

| Agent | 拥有的 Workbench 工具 |
|-------|---------------------|
| Platform Agent | workbench, showCode, showTable, showChart |
| Code Expert | showCode |
| Data Analyst | workbench, showTable, showChart |
| Office Worker | workbench, showTable |
| **Client Agent** | **无** |

**影响**:
- 本地模式完全依赖 prompt 驱动 AI 在文本流中输出 `workbench-schema` 代码块
- 可靠性极低：AI 可能不输出、JSON 格式可能错、输出时机不可控
- AgentGateway 没有 workbench 工具检测（grep 确认 0 matches），即使 Client Agent 的 AI 碰巧输出了 schema，也不走标准的 `workbench:update` 推送通道

### 断裂点 3（P1/中等）：AgentGateway 缺少 Workbench 工具检测

- 远程模式: ChatGateway 的 `onToolResult` 检测 `WORKBENCH_TOOL_NAMES` → 推送 `workbench:update` 事件
- 本地模式: AgentGateway 的 `handleToolResult` 方法 **完全没有** workbench 工具检测逻辑

即使未来给 Client Agent 添加了 Workbench 工具，没有 AgentGateway 的检测，工具结果也无法推送到前端。

### 断裂点 4（P1/体验）：本地模式不自动打开 FileBrowser

用户连接 Client Agent 切换到本地模式后，Workbench **不会自动弹出**文件浏览器。

前端代码 `WorkbenchStore.openBlank(rootPath)` 方法完好可用，但没有调用入口：
- 没有在 Agent 连接成功时自动触发
- 没有在切换到本地模式时自动触发
- 需要 AI 在回复中主动输出包含 FileBrowser 的 schema（不可靠）

**这就是用户说的"进本地模式看不到文件了"的直接原因。**

### 断裂点 5（P2/低）：Workbench 上下文只在发消息时传递

`formatWorkbenchContextForAI()` 组装的 Workbench 状态只通过 `chat:message` 发送。
- 用户在 Workbench 中切换标签、选中数据行等操作，AI 不知道（直到下一次发消息）
- 文件内容预览被截断到 5000 字符

### 断裂点 6（已修复/P0-6）：Workbench 状态与会话绑定

P0-6 已修复：新建对话清空 + 会话切换恢复。

---

## 四、修复方案

### 方案 A：服务端工具输出新格式 + 支持 action（修复断裂点 1）

**改动文件**: `packages/server/src/tools/workbench/workbench.tool.ts`

将 4 个工具的 Zod schema 从 v1.0 blocks 格式升级为 tabs 格式：

```typescript
// 当前（v1.0 blocks，不支持 action）
schema: z.object({
  version: z.string().default('1.0'),
  blocks: z.array(z.object({
    type: z.enum(['code', 'table', 'chart', ...]),
    data: z.any()
  }))
})

// 目标（tabs 格式，支持 action）
schema: z.object({
  type: z.literal('workbench'),
  tabs: z.array(z.object({
    title: z.string(),
    components: z.array(z.object({
      type: z.string(),
      props: z.record(z.any()),
      actions: z.array(z.object({
        type: z.enum(['chat','api','export','navigate','update','custom','shell']),
        trigger: z.string().optional(),
        payload: z.any()
      })).optional()
    }))
  }))
})
```

同时更新 AI Instructions 添加 action 使用示例，引导 AI 生成带交互按钮的 schema。

### 方案 B：给 Client Agent 添加 Workbench 工具（修复断裂点 2）

**改动文件**: `packages/client-agent/src/agent/` 相关文件

为 Client Agent 注册 workbench/showTable/showChart/showCode 工具，使其能通过标准工具调用路径生成 Workbench 内容。

### 方案 C：AgentGateway 添加 Workbench 检测（修复断裂点 3）

**改动文件**: `packages/server/src/gateway/agent.gateway.ts`

在 `handleToolResult` 中添加 WORKBENCH_TOOL_NAMES 检测逻辑，与 ChatGateway 一致。

### 方案 D：本地模式自动打开 FileBrowser（修复断裂点 4）

**改动文件**: `packages/web/src/components/agent/AgentStatusIndicator.tsx` 或 `stores/agent.ts`

在 Agent 连接成功 + 本地模式激活时，自动调用 `WorkbenchStore.openBlank(workDir)`。

---

## 五、修复优先级与工作量评估

| 优先级 | 方案 | 断裂点 | 预估工作量 | 用户感知 |
|--------|------|--------|-----------|---------|
| **P0** | A | #1 | 4-6h | AI 生成的 Workbench 可以带交互按钮 |
| **P0** | B | #2 | 3-4h | 本地模式 Workbench 从"碰运气"变为可靠 |
| **P1** | C | #3 | 1-2h | 本地模式走标准 Workbench 推送通道 |
| **P1** | D | #4 | 0.5-1h | 进本地模式自动看到文件树 |
| **P2** | Instructions | #1 补充 | 1-2h | AI 更智能地生成交互按钮 |

**总工作量: 约 10-15h**

---

## 六、与 Phase H 深度验证的关系

当前 Phase H 的 DV-3（Workbench 交互能力，6 个测试点）在不修复上述断裂点的情况下**大概率全部失败**：

| DV-3 测试点 | 预计结果 | 原因 |
|-------------|---------|------|
| DV-3.1 按钮交互 | FAIL | 工具 schema 不含 action |
| DV-3.2 表格行操作 | FAIL | 同上 |
| DV-3.3 表单提交 | FAIL | 同上 |
| DV-3.4 数据导出 | FAIL | 同上 |
| DV-3.5 chat action | FAIL | 同上 |
| DV-3.6 数据联动 | FAIL | 同上 |

建议：**先修复断裂点 1+2+4，再执行 Phase H 测试**，否则 DV-3 模块测试无意义。

---

## 七、附录：详细调查报告索引

| 报告 | 文件 | 内容 |
|------|------|------|
| 架构设计功能清单 | `wb-architecture-design.md` | 30+组件、7种action、16个场景、完成度评估 |
| 前端实现状态 | `wb-frontend-status.md` | 36组件注册表、action handler、文件浏览、代码编辑 |
| 后端通信集成 | `wb-backend-status.md` | 数据流链路、6个断裂点、工具清单、改进建议 |
