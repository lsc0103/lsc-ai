# Workbench 全面重写 — Schema 规格书

> 本文档是所有团队成员的统一参考，任何改动必须遵循此规格。
> 最后更新: 2026-02-07 | 作者: 总工程师

---

## 1. 目标

将 4 个 Workbench 工具从 v1.0 blocks 格式升级为前端原生 tabs 格式，支持 action 交互。

**红线**：
1. showTable/showChart/showCode 不传 actions 时，行为必须和现在完全一致
2. ensureNewSchema() 保留对历史数据（v1.0 blocks）的向后兼容
3. Client Agent 的 workbench 工具直接用 Mastra createTool + 手写 Zod，不走 tool-adapter
4. 每个 Phase 完成后 push，PM 做中间验收

---

## 2. 前端已有类型（不可修改，我们的输出必须匹配这些接口）

### 2.1 顶层 WorkbenchSchema

```typescript
interface WorkbenchSchema {
  type: 'workbench';
  title?: string;
  tabs: WorkbenchTab[];
  defaultActiveKey?: string;
}

interface WorkbenchTab {
  key: string;
  title: string;
  icon?: string;
  closable?: boolean;
  components: ComponentSchema[];
}
```

### 2.2 WorkbenchAction（前端已支持的 7 种 action）

```typescript
interface WorkbenchAction {
  type: 'chat' | 'api' | 'export' | 'navigate' | 'update' | 'custom' | 'shell';
  // chat
  message?: string;
  // api
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, unknown>;
  // export
  format?: 'excel' | 'csv' | 'pdf' | 'json' | 'png' | 'svg';
  filename?: string;
  // navigate
  path?: string;
  // update
  targetId?: string;
  data?: unknown;
  // custom
  handler?: string;
  // shell
  command?: string;
}
```

### 2.3 关键组件的 action 入口（前端已实现）

| 组件 | action 属性 | 说明 |
|------|-----------|------|
| Button | `action?: WorkbenchAction` | 点击按钮触发 |
| DataTable | `onSelectAction?: WorkbenchAction` | 选中行触发 |
| DataTable columns | `actions?: { label, action }[]` | 行操作按钮 |
| Form | `onSubmitAction?: WorkbenchAction` | 表单提交触发 |
| CodeEditor | `onChangeAction?: WorkbenchAction` | 内容变化触发 |
| Card | `actions?: { label, icon, action }[]` | 卡片操作按钮 |
| List items | `action?: WorkbenchAction` | 列表项点击触发 |

---

## 3. 工具改造规格

### 3.1 showTable — 表格展示

**AI 输入 schema（Zod）：**
```typescript
z.object({
  headers: z.array(z.string()).describe('表头'),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).describe('数据行'),
  title: z.string().optional().describe('表格标题'),
  sortable: z.boolean().default(true).describe('是否可排序'),
  // 新增
  actions: z.array(z.object({
    label: z.string().describe('按钮文字'),
    action: WorkbenchActionZod,
  })).optional().describe('操作按钮列表，如导出、深入分析等'),
})
```

**execute 输出（新格式）：**
```json
{
  "success": true,
  "schema": {
    "type": "workbench",
    "title": "销售数据",
    "tabs": [{
      "key": "tab-0",
      "title": "销售数据",
      "components": [
        {
          "type": "DataTable",
          "title": "销售数据",
          "columns": [
            { "title": "产品", "dataIndex": "产品", "key": "产品" },
            { "title": "销量", "dataIndex": "销量", "key": "销量" }
          ],
          "data": [
            { "key": 0, "产品": "商品A", "销量": 100 }
          ],
          "sortable": true
        },
        {
          "type": "Button",
          "text": "导出 Excel",
          "variant": "default",
          "icon": "download",
          "action": { "type": "export", "format": "excel", "filename": "销售数据.xlsx" }
        }
      ]
    }],
    "defaultActiveKey": "tab-0"
  },
  "message": "表格已展示"
}
```

**规则**：
- 不传 actions 时：只有 DataTable 组件，无 Button（和现在 ensureNewSchema 转换后的效果一致）
- 传了 actions 时：DataTable + 每个 action 生成一个 Button 组件
- headers/rows 转 columns/data 的逻辑从 ensureNewSchema() 搬到 execute 内部

### 3.2 showChart — 图表展示

**AI 输入 schema（Zod）：**
```typescript
z.object({
  chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'radar', 'custom']),
  option: z.record(z.any()).describe('ECharts 配置对象'),
  title: z.string().optional().describe('图表标题'),
  actions: z.array(z.object({
    label: z.string(),
    action: WorkbenchActionZod,
  })).optional().describe('操作按钮列表'),
})
```

**execute 输出**：根据 chartType 映射到对应前端组件类型：
- `bar` → `BarChart`
- `line` → `LineChart`
- `pie` → `PieChart`
- `scatter` → `ScatterChart`
- `radar` → `BarChart`（降级）
- `custom` → `BarChart`（降级）

**PieChart 特殊处理**：
```json
{
  "type": "PieChart",
  "data": [{ "name": "A", "value": 100 }],
  "title": "占比"
}
```
需从 `option.series[0].data` 提取。

**BarChart/LineChart**：
```json
{
  "type": "BarChart",
  "xAxis": { "type": "category", "data": ["1月","2月"] },
  "series": [{ "data": [120, 200], "type": "bar" }],
  "title": "月度趋势"
}
```

### 3.3 showCode — 代码展示

**AI 输入 schema（Zod）：**
```typescript
z.object({
  code: z.string().describe('代码内容'),
  language: z.string().default('javascript').describe('编程语言'),
  filename: z.string().optional().describe('文件名'),
  title: z.string().optional().describe('标题'),
  actions: z.array(z.object({
    label: z.string(),
    action: WorkbenchActionZod,
  })).optional().describe('操作按钮列表，如应用修复、在VS Code打开等'),
})
```

**execute 输出**：
```json
{
  "type": "workbench",
  "tabs": [{
    "key": "tab-0",
    "title": "example.js",
    "components": [
      {
        "type": "CodeEditor",
        "code": "console.log('hello');",
        "language": "javascript",
        "readOnly": true
      }
    ]
  }]
}
```

### 3.4 workbench — 通用工具（全面升级）

**AI 输入 schema（Zod）：保留对旧 blocks 的兼容 + 新增 tabs 格式**

```typescript
z.union([
  // 旧格式（向后兼容，AI 仍可使用）
  z.object({
    version: z.literal('1.0').default('1.0'),
    title: z.string().optional(),
    blocks: z.array(ContentBlockSchema),
    metadata: z.record(z.any()).optional(),
  }),
  // 新格式（推荐，支持完整交互）
  z.object({
    title: z.string().optional(),
    tabs: z.array(z.object({
      title: z.string(),
      icon: z.string().optional(),
      components: z.array(z.object({
        type: z.string().describe('组件类型，如 DataTable, BarChart, CodeEditor, Button, Statistic, Terminal 等'),
        props: z.record(z.any()).optional().describe('组件属性'),
        action: WorkbenchActionZod.optional().describe('组件动作（用于 Button 等）'),
        children: z.array(z.any()).optional().describe('子组件'),
      })),
    })),
  }),
])
```

**execute 逻辑**：
- 如果输入是旧 blocks 格式 → 内部转换为 tabs 格式再输出
- 如果输入是新 tabs 格式 → 直接构造 WorkbenchSchema 输出

---

## 4. WorkbenchActionZod 共享定义

所有工具共用的 Action Zod schema：

```typescript
const WorkbenchActionZod = z.object({
  type: z.enum(['chat', 'api', 'export', 'navigate', 'update', 'custom', 'shell']),
  label: z.string().optional().describe('按钮显示文字'),
  message: z.string().optional().describe('chat: 发送给AI的消息'),
  endpoint: z.string().optional().describe('api: API端点'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
  params: z.record(z.any()).optional(),
  format: z.enum(['excel', 'csv', 'pdf', 'json', 'png', 'svg']).optional(),
  filename: z.string().optional(),
  path: z.string().optional().describe('navigate: 目标路径'),
  targetId: z.string().optional().describe('update: 目标组件ID'),
  data: z.any().optional(),
  handler: z.string().optional().describe('custom: 处理器名称'),
  command: z.string().optional().describe('shell: 要执行的命令'),
});
```

---

## 5. Client Agent 工具规格（Phase 2）

Client Agent 的 4 个 workbench 工具与 Server 端功能相同，但：

1. **直接用 Mastra createTool + 手写 Zod schema**，不走 tool-adapter
2. 在 `executor.ts` 的 `initialize()` 中手动注册到 `this.mastraTools`
3. execute 函数直接返回 `{ success, schema, message }`，和 Server 端一致
4. AgentGateway 的 `handleToolResult` 添加 WORKBENCH_TOOL_NAMES 检测，推送 `workbench:update`

---

## 6. ensureNewSchema() 兼容规则（Phase 1）

**不改 ensureNewSchema() 的核心逻辑**，只做如下调整：

- `isOldSchema()` 检测条件不变：`version === '1.0' && Array.isArray(blocks)`
- 新工具输出的 schema 有 `type: 'workbench'` + `tabs` 数组 → `isOldSchema()` 返回 false → 不转换直接透传
- 历史会话中的旧 schema 仍然走转换逻辑

**验证点**：新输出 + 旧历史都能正确渲染。

---

## 7. 自动 FileBrowser 规格（Phase 1）

**触发条件**：Agent 连接成功 + 切换到本地模式 + Workbench 当前无内容

**实现位置**：`packages/web/src/components/agent/AgentStatusIndicator.tsx` 或相关组件

**逻辑**：
```typescript
// 切换到本地模式成功后
const workbenchStore = useWorkbenchStore.getState();
if (!workbenchStore.schema) {
  workbenchStore.openBlank(workDir);
}
```

---

## 8. 文件改动清单

### Phase 1
| 文件 | 改动 | 负责人 |
|------|------|--------|
| `packages/server/src/tools/workbench/workbench.tool.ts` | 4 个工具全面重写 | tool-rewriter |
| `packages/web/src/components/workbench/schema/schema-transformer.ts` | 验证兼容性，可能微调 | frontend-compat |
| `packages/web/src/components/agent/AgentStatusIndicator.tsx` 或相关 | 自动 FileBrowser | frontend-compat |

### Phase 2
| 文件 | 改动 | 负责人 |
|------|------|--------|
| `packages/server/src/gateway/agent.gateway.ts` | 添加 WORKBENCH_TOOL_NAMES 检测 | client-builder |
| `packages/client-agent/src/agent/executor.ts` | 注册 4 个 workbench 工具 | client-builder |
| `packages/client-agent/src/agent/workbench-tools.ts` | 新建，4 个工具定义 | client-builder |
| `packages/server/src/services/mastra-agent.service.ts` | AI Instructions action 模板 | tool-rewriter |
