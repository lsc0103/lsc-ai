# Workbench 前端实现状态报告

> 生成时间: 2026-02-07
> 代码目录: `packages/web/src/components/workbench/`

---

## 1. 内容组件实现状态

### 1.1 布局组件 (5/5)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| Container | `components/layout/Container.tsx` | YES | DONE | 容器组件，支持 padding/background/children |
| Row | `components/layout/Row.tsx` | YES | DONE | 行组件，支持 gutter/align/justify |
| Col | `components/layout/Col.tsx` | YES | DONE | 列组件，支持 span/offset/flex |
| Tabs | `components/layout/Tabs.tsx` | YES | DONE | 标签页组件，支持 items/defaultActiveKey |
| Collapse | `components/layout/Collapse.tsx` | YES | DONE | 折叠面板，支持 accordion 模式 |

### 1.2 代码组件 (4/4)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| CodeEditor | `components/code/CodeEditor.tsx` (~296行) | YES | DONE | Monaco Editor，语法高亮/行号/复制/自定义主题(lsc-dark)/高亮行/auto高度/onChangeAction |
| CodeDiff | `components/code/CodeDiff.tsx` | YES | DONE | Monaco DiffEditor，original/modified 对比 |
| Terminal | `components/code/Terminal.tsx` | YES | DONE | 终端输出，ANSI 颜色支持 |
| SQLEditor | `components/code/SQLEditor.tsx` | YES | DONE | SQL 编辑器，支持 onExecuteAction/结果展示 |

### 1.3 数据展示组件 (6/6)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| DataTable | `components/data/DataTable.tsx` (~335行) | YES | DONE | AntD Table 封装，排序/分页/行选择/5种render类型(text/number/date/status/action/link)/CSV导出/virtual scroll |
| Statistic | `components/data/Statistic.tsx` | YES | DONE | 统计卡片，趋势箭头 |
| Card | `components/data/Card.tsx` | YES | DONE | 卡片组件，封面图/操作按钮 |
| Timeline | `components/data/Timeline.tsx` | YES | DONE | 时间线组件 |
| List | `components/data/List.tsx` | YES | DONE | 列表组件，支持 action 点击 |
| Citation | `components/data/Citation.tsx` | YES | DONE | 引用/参考文献组件，list/card/compact 三种展示样式 |

### 1.4 图表组件 (6/6)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| BarChart | `components/chart/BarChart.tsx` | YES | DONE | 基于 ECharts，支持堆叠/水平 |
| LineChart | `components/chart/LineChart.tsx` | YES | DONE | 折线图，支持 smooth/area |
| PieChart | `components/chart/PieChart.tsx` | YES | DONE | 饼图，支持 donut 环形 |
| AreaChart | `components/chart/AreaChart.tsx` | YES | DONE | 面积图，支持堆叠 |
| ScatterChart | `components/chart/ScatterChart.tsx` | YES | DONE | 散点图，支持回归线 |
| Gantt | `components/chart/Gantt.tsx` | YES | DONE | 甘特图，支持依赖线/进度 |

### 1.5 文件组件 (5/5)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| FileViewer | `components/file/FileViewer.tsx` (~627行) | YES | DONE | 通用文件查看器，通过 filePath 自动检测类型并选择预览器。**支持编辑模式+保存到本地**（code/text 类型文件） |
| FileBrowser | `components/file/FileBrowser.tsx` (~417行) | YES | DONE | 文件浏览器，目录树展示/搜索/点击文件打开新 tab/文件类型图标。通过 Socket.IO 与 Client Agent 通信获取文件列表 |
| WordPreview | `components/file/OfficePreview.tsx` | YES | DONE | Word 预览，使用 mammoth 库解析 .docx 为 HTML。支持 filePath/url/fileData(base64) 三种数据源 |
| ExcelPreview | `components/file/OfficePreview.tsx` | YES | DONE | Excel 预览，使用 xlsx 库解析为表格。支持多工作表切换，最多显示 500 行 |
| PPTPreview | `components/file/OfficePreview.tsx` | YES | PARTIAL | PPT 预览。**仅显示文件信息占位**，无实际幻灯片渲染。注释说"PPT 在线预览功能开发中" |

### 1.6 预览组件 (5/5)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| MarkdownView | `components/preview/MarkdownView.tsx` | YES | DONE | Markdown 渲染 |
| ImagePreview | `components/preview/ImagePreview.tsx` | YES | DONE | 图片预览，支持 src(URL/base64) |
| PdfPreview | `components/preview/PdfPreview.tsx` | YES | DONE | PDF 预览，iframe 方式 |
| VideoPreview | `components/preview/VideoPreview.tsx` | YES | DONE | 视频播放器 |
| AudioPreview | `components/preview/AudioPreview.tsx` | YES | DONE | 音频播放器 |

### 1.7 表单组件 (5/5)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| Form | `components/form/Form.tsx` | YES | DONE | 表单组件，多字段类型/onSubmitAction |
| Button | `components/form/Button.tsx` (~60行) | YES | DONE | **按钮组件，支持 action 属性**。点击时调用 handleAction(action)。支持图标/variant/danger/disabled/loading |
| Input | `components/form/Input.tsx` | YES | DONE | 输入框，支持 onChangeAction |
| Select | `components/form/Select.tsx` | YES | DONE | 选择器，支持 onChangeAction |
| DatePicker | `components/form/DatePicker.tsx` | YES | DONE | 日期选择器，支持 onChangeAction |

### 1.8 其他组件 (2/2)

| 组件 | 文件 | 注册 | 状态 | 说明 |
|------|------|------|------|------|
| Alert | `components/other/Alert.tsx` | YES | DONE | 警告提示 |
| Progress | `components/other/Progress.tsx` | YES | DONE | 进度条 |

### 1.9 Schema 中定义但未注册的组件

| 组件类型 | Schema 中定义 | 注册 | 说明 |
|----------|--------------|------|------|
| FilePreview | YES (types.ts:676) | NO | 旧版文件预览（基于URL），未注册到 ComponentRegistry。运行时会显示 FallbackComponent（"组件尚未实现"） |
| Empty | YES (types.ts:1016) | NO | 空状态组件，Schema 类型定义了但未注册 |

**总计: 38 种组件类型在 schema/types.ts 中定义, 36 种在 ComponentRegistry 中注册, 2 种未注册**

---

## 2. Action 系统实现状态

### 2.1 Action 类型定义

Schema 中定义了 7 种 Action 类型 (`schema/types.ts:65-72`):
- `chat` | `api` | `export` | `navigate` | `update` | `custom` | `shell`

### 2.2 Action Handler 实现

| Action 类型 | Handler 文件 | 状态 | 说明 |
|-------------|-------------|------|------|
| chat | `actions/handlers/chatHandler.ts` (~77行) | DONE | 通过 `useChatStore.setPendingMessage()` 发送消息到 AI 对话。支持模板变量解析 |
| api | `actions/handlers/apiHandler.ts` (~229行) | DONE | 完整的 HTTP 请求实现。支持超时控制(30s)/自动重试(3次，指数退避)/Bearer Token 认证/GET查询参数/POST请求体 |
| export | `actions/handlers/exportHandler.ts` (~322行) | DONE | 支持 Excel/CSV/JSON/PDF/PNG/SVG 格式。Excel+CSV 使用 xlsx 库。PDF 通过 HTML 打印窗口实现。图片导出从 ECharts 实例获取 |
| navigate | `actions/handlers/navigateHandler.ts` (~74行) | DONE | 支持外部链接(window.open)和内部路由(pushState+popstate)。有注释说"应该用 React Router" |
| update | `actions/handlers/updateHandler.ts` (~90行) | DONE | 更新 WorkbenchStore 中指定组件的数据。支持模板变量解析 |
| custom | `actions/handlers/customHandler.ts` (~188行) | DONE | 可扩展处理器注册表。**预置了 4 个处理器**: copyToClipboard / showNotification / print / refreshWorkbench |
| shell | `actions/handlers/shellHandler.ts` (~115行) | DONE | 通过 `agentApi.dispatch()` 下发命令到 Client Agent。自动添加到 TerminalStore 以显示输出。需要 Agent 在线 |

### 2.3 模板变量系统

文件: `actions/templateParser.ts` (~190行)

- 支持 `${variable}` 语法
- 内置变量: `selectedRows`, `selectedRow`, `formValues`, `currentTab`, `sessionId`, `sourceComponentId`
- 路径解析: `data.xxx`, `componentData.xxx`
- 深度对象解析: `parseObjectTemplates()` 递归处理所有字符串属性

### 2.4 ActionHandler 核心

文件: `actions/ActionHandler.ts` (~281行)

- 单例模式 `ActionHandler`
- 统一分发: 7 种 handler 在构造函数中注册
- 支持批量执行 `executeAll()`（并行/顺序/出错停止）
- 执行历史记录（最近100条）
- `useActionHandler()` Hook 提供便捷方法: `sendToAI()`, `exportData()`, `updateComponent()`

---

## 3. 交互功能实现状态

### 3.1 AI 生成的交互按钮

| 功能 | 相关代码 | 状态 | 说明 |
|------|----------|------|------|
| Button 组件 + action | `components/form/Button.tsx` + `schema/types.ts:869-885` | DONE | **Button schema 支持 action 属性**，AI 可以生成 `{type:"Button", text:"...", action:{type:"chat", message:"..."}}` 来创建交互按钮。点击时触发 `handleAction(action)` |
| DataTable 行操作按钮 | `schema/types.ts:261-266` + `DataTable.tsx:186-200` | DONE | 表格列支持 `render:"action"` + `actions` 数组，每行显示操作按钮 |
| DataTable 行选择 | `DataTable.tsx:255-267` | DONE | 支持 `selectable:true` + `onSelectAction`，选中行时触发动作 |
| Card 操作按钮 | `schema/types.ts:323-328` | DONE | Card 支持 `actions` 数组，每个 action 有 label+icon+WorkbenchAction |
| List 项点击 | `schema/types.ts:366` | DONE | List item 支持 `action` 属性，点击时触发 |
| Form 提交 | `schema/types.ts:862-863` | DONE | Form 支持 `onSubmitAction`，提交时发送表单数据 |
| Input/Select/DatePicker 变更 | `schema/types.ts:918,955,980` | DONE | 表单控件支持 `onChangeAction`，值变化时触发 |
| CodeEditor 变更 | `schema/types.ts:206` | DONE | CodeEditor 支持 `onChangeAction` |
| SQLEditor 执行 | `schema/types.ts:521` | DONE | SQLEditor 支持 `onExecuteAction` |
| Gantt 任务点击 | `schema/types.ts:506` | DONE | Gantt 支持 `onTaskClick` |
| FileBrowser 文件选择 | `schema/types.ts:668` | DONE | FileBrowser 支持 `onSelectAction` |

**结论: 交互按钮/动作系统是完整的。** AI 可以在 schema 中定义各种 action，前端会执行。

### 3.2 键盘快捷键

| 快捷键 | 功能 | 状态 |
|--------|------|------|
| Ctrl/Cmd+Z | 撤销 | DONE |
| Ctrl/Cmd+Shift+Z / Ctrl+Y | 重做 | DONE |
| Escape | 关闭 Workbench | DONE |
| Ctrl/Cmd+W | 关闭当前标签页 | TODO (代码注释: 预留) |

### 3.3 拖放支持

| 功能 | 相关代码 | 状态 | 说明 |
|------|----------|------|------|
| 从系统拖入文件 | `Workbench.tsx:141-352` | DONE | 支持图片/文本/PDF/视频/音频/Word/Excel/PPT，自动检测类型并创建临时预览 tab |
| 拖入文件路径 | `Workbench.tsx:344-352` | DONE | 检测拖入的文本是否为文件路径，调用 `openFile()` |

---

## 4. 本地模式集成

### 4.1 文件系统通信

| 功能 | 相关代码 | 状态 | 说明 |
|------|----------|------|------|
| FileService (读取文件) | `services/FileService.ts:292-342` | DONE | 通过 Socket.IO 发送 `file:read` 事件，Client Agent 返回 `file:content`。支持文本(utf-8)和二进制(base64) |
| FileService (保存文件) | `services/FileService.ts:347-377` | DONE | 通过 Socket.IO 发送 `file:write` 事件，Client Agent 返回 `file:writeResult` |
| FileService (文件列表) | `services/FileService.ts:382-409` | DONE | 通过 Socket.IO 发送 `file:list` 事件，支持 glob patterns。Client Agent 返回 `file:list` 事件 |
| 文件类型检测 | `services/FileService.ts:63-178` | DONE | 丰富的扩展名映射: 60+ 扩展名 -> FileType, 35+ 扩展名 -> 编程语言 |
| Mock 回退 | `services/FileService.ts:414-428` | DONE | Client Agent 不可用时显示占位内容 |
| useFileContent Hook | `services/FileService.ts:443-489` | DONE | 加载文件 + loading/error 状态 + reload 方法 |
| useFileList Hook | `services/FileService.ts:494-524` | DONE | 加载目录列表 + loading/error 状态 + reload 方法 |

### 4.2 FileBrowser 本地文件浏览

| 功能 | 相关代码 | 状态 | 说明 |
|------|----------|------|------|
| 目录树展示 | `FileBrowser.tsx:190-417` | DONE | 递归 FileTreeNodeItem，展开/折叠/文件类型图标 |
| 搜索过滤 | `FileBrowser.tsx:218-239` | DONE | 按文件名递归过滤 |
| 点击文件打开 | `FileBrowser.tsx:255-298` | DONE | 自动检测类型，在新 tab 打开对应预览组件 |
| openBlank 快捷方法 | `WorkbenchStore.ts:463-489` | DONE | `openBlank(rootPath)` 打开带 FileBrowser 的空白 Workbench |

### 4.3 代码编辑 + 保存到本地

| 功能 | 相关代码 | 状态 | 说明 |
|------|----------|------|------|
| FileViewer 编辑按钮 | `FileViewer.tsx:374-408` | DONE | code/text 文件显示编辑按钮，`readOnly` 默认 false |
| 编辑模式 | `FileViewer.tsx:380-388` | DONE | 点击编辑 -> Monaco Editor 变为可编辑 -> 显示保存/取消按钮 |
| 保存文件 | `FileViewer.tsx:392-408` | DONE | 调用 `FileService.saveFile(filePath, editedContent)`，通过 Socket.IO 发送到 Client Agent 写入文件 |
| CodeEditor 独立编辑 | `CodeEditor.tsx` | PARTIAL | CodeEditor 自身**没有保存按钮**。它只是展示/编辑代码，onChange 通过 `onChangeAction` 触发。保存功能只在 FileViewer 中有 |

### 4.4 Shell 命令执行

| 功能 | 相关代码 | 状态 | 说明 |
|------|----------|------|------|
| Shell Action | `actions/handlers/shellHandler.ts` | DONE | 通过 agentApi.dispatch() 下发到 Client Agent |
| 终端输出面板 | `components/Terminal.tsx` + `context/TerminalStore.ts` | DONE | 底部终端面板，显示命令执行输出(流式)/状态 |
| 命令输出流 | `Workbench.tsx:89-113` | DONE | 注册 Socket.IO 命令执行监听器: onOutput/onComplete/onError |

---

## 5. Schema 系统实现状态

### 5.1 Schema 类型

| 部分 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 类型定义 | `schema/types.ts` (~1148行) | DONE | 38 种组件类型, 7 种 action 类型, 完整的 TypeScript 接口定义 |
| 校验器 | `schema/validator.ts` (~484行) | DONE | 类型白名单/XSS防护/URL安全检查/必填字段校验/深度清理/容错(部分渲染) |
| 渲染器 | `schema/renderer.tsx` (~193行) | DONE | 递归渲染引擎，最大深度20，ErrorBoundary 包裹，memo 优化 |
| 转换器 | `schema/schema-transformer.ts` | DONE | 旧格式(version:1.0 + blocks)转新格式(tabs)。三入口集成 ensureNewSchema() |
| Schema 入口 | `schema/index.ts` | DONE | 统一导出 |

### 5.2 WorkbenchStore 状态管理

文件: `context/WorkbenchStore.ts` (~954行)

| 功能 | 状态 | 说明 |
|------|------|------|
| Schema CRUD | DONE | open/setSchema/clear + mergeSchema(增量合并 tab，按 title 去重) |
| Tab 管理 | DONE | add/close/closeTabs/closeOtherTabs/update/setActive + userClosedTabs 防止 AI 重复添加 |
| 历史/撤销 | DONE | history 数组 + historyIndex，undo/redo/canUndo/canRedo |
| 组件状态 | DONE | componentStates map，setComponentState/getComponentState/updateComponentData |
| 宽度比例 | DONE | widthRatio 0.2-0.8 范围，persist 到 localStorage |
| Action 处理 | DONE | handleAction() 构建 ActionContext 并调用 ActionHandler.execute() |
| 会话持久化 | DONE | getSerializableState/loadState + 使用 zustand persist 中间件 |
| AI 上下文 | DONE | getWorkbenchContext() + formatWorkbenchContextForAI() - 将当前 Workbench 状态格式化为文本发送给 AI |
| 快捷方法 | DONE | openBlank(rootPath) / openFile(filePath) |

### 5.3 会话关联

文件: `hooks/useSessionWorkbench.ts` (~352行)

| 功能 | 状态 | 说明 |
|------|------|------|
| 会话切换保存/恢复 | DONE | 切换会话时保存旧 Workbench 状态到服务器，加载新会话的状态 |
| 新对话清空 | DONE | P0-6 修复: isNewChat=true 时强制清空 Workbench |
| 防抖自动保存 | DONE | 2000ms 防抖，schema/activeTabKey/visible 变化时保存 |
| 卸载时保存 | DONE | 组件卸载时立即保存当前状态 |

---

## 6. 组件注册表状态

文件: `registry/index.ts` + `components/index.ts`

**已注册 36 种组件:**
- layout: Container, Row, Col, Tabs, Collapse (5)
- code: CodeEditor, Terminal, CodeDiff, SQLEditor (4)
- file: FileViewer, FileBrowser, WordPreview, ExcelPreview, PPTPreview (5)
- preview: MarkdownView, ImagePreview, PdfPreview, VideoPreview, AudioPreview (5)
- data: Statistic, DataTable, Card, Timeline, List, Citation (6)
- form: Form, Button, Input, Select, DatePicker (5)
- chart: BarChart, LineChart, PieChart, AreaChart, ScatterChart, Gantt (6)
- other: Alert, Progress (2)

**未注册但在 Schema 类型中定义:**
- FilePreview (旧版，被 FileViewer 取代)
- Empty (类型定义存在但无组件实现)

---

## 7. Hooks 实现状态

| Hook | 文件 | 状态 | 说明 |
|------|------|------|------|
| useSessionWorkbench | `hooks/useSessionWorkbench.ts` | DONE | 会话切换时保存/恢复 Workbench 状态 |
| useComponentData | `hooks/useComponentData.ts` | DONE | 组件间数据联动: data/loading/error |
| useSelectedRows | `hooks/useComponentData.ts` | DONE | DataTable 选中行管理 |
| useFormValues | `hooks/useComponentData.ts` | DONE | Form 表单值管理 |
| useActionContext | `hooks/useComponentData.ts` | DONE | 构建 Action 执行上下文 |
| useDataReference | `hooks/useComponentData.ts` | DONE | 解析 `${componentData.xxx}` 数据引用 |
| useKeyboardShortcuts | `hooks/useKeyboardShortcuts.ts` | DONE | Ctrl+Z/Y undo/redo, Escape close |
| usePerformance | `hooks/usePerformance.ts` | EXISTS | 性能监控 hook（未深入分析） |

---

## 8. 关键发现

### 8.1 交互按钮系统 -- 完整实现

**AI 可以生成交互按钮。** Button 组件的 `action` 属性是完整实现的：
- Schema 定义: `ButtonSchema.action?: WorkbenchAction` (`types.ts:884`)
- 组件实现: 点击时调用 `handleAction(action)` (`Button.tsx:37-41`)
- 7 种 action handler 全部实现: chat/api/export/navigate/update/custom/shell
- 模板变量系统允许按钮触发带有动态数据的操作

同样，DataTable 的行操作按钮(`render:"action"`)、Card 的 `actions` 数组、List 的 `action`、Form 的 `onSubmitAction` 等都完整可用。

### 8.2 本地文件浏览 -- 完整实现

- FileBrowser 通过 Socket.IO `file:list` 事件获取目录结构
- 支持目录树展开/折叠、搜索过滤、文件类型图标
- 点击文件在新 tab 打开对应预览组件
- WorkbenchStore 提供 `openBlank(rootPath)` 快捷方法
- **依赖 Client Agent 在线。** Agent 离线时 FileService 超时(30s)并显示 mock 占位

### 8.3 代码编辑 + 保存 -- 完整实现（在 FileViewer 中）

- FileViewer 组件对 code/text 类型文件默认 `readOnly=false`
- 顶栏有编辑/保存/取消按钮
- 保存通过 `FileService.saveFile()` -> Socket.IO `file:write` 事件发送到 Client Agent
- **注意:** 独立的 CodeEditor 组件没有保存按钮，它的职责是展示 AI 生成的代码片段。保存功能只在 FileViewer 中

### 8.4 PPT 预览 -- 部分实现

PPTPreview 的 `PPTContentRenderer` 仅显示文件信息和大小，没有幻灯片渲染逻辑。代码注释: "PPT 在线预览功能开发中"。Word(mammoth)和Excel(xlsx)已完整实现。

### 8.5 两个未注册的组件类型

- `FilePreview`: 旧版基于 URL 的文件预览，已被 `FileViewer`(基于 filePath) 取代。Schema 类型保留但无组件实现
- `Empty`: Schema 类型定义了但没有对应的组件实现/注册

### 8.6 Navigate Handler 潜在问题

`navigateHandler.ts:51-53` 使用 `window.history.pushState` + `dispatchEvent(PopStateEvent)` 做内部路由导航。代码注释承认"应该使用 React Router"。这种方式可能与 React Router v6 不完全兼容。

### 8.7 Schema AI 上下文感知系统完备

`WorkbenchStore.ts` 的 `getWorkbenchContext()` 和 `formatWorkbenchContextForAI()` 可以将当前 Workbench 的完整状态（tab 列表、激活 tab 的组件详情、文件内容预览 最多 5000 字符）格式化为文本，供 AI 在对话中感知工作台状态。

### 8.8 容错和安全

- Validator 做了 XSS 防护（清理 script 标签、javascript: URL）
- 不合法组件类型被过滤，有效组件仍然渲染（部分渲染，不整体拒绝）
- Schema transformer 兼容旧格式
- ErrorBoundary 包裹每个组件，单个组件崩溃不影响整体

---

## 9. 文件清单

| 文件 | 大小(行) | 职责 |
|------|---------|------|
| `Workbench.tsx` | ~502 | 主容器，拖放，header，empty state |
| `WorkbenchTabs.tsx` | - | Tab 栏 UI |
| `WorkbenchLayout.tsx` | - | 布局 |
| `schema/types.ts` | ~1148 | 38 种组件类型 + 7 种 action 类型定义 |
| `schema/renderer.tsx` | ~193 | 递归渲染引擎 |
| `schema/validator.ts` | ~484 | 安全校验 + XSS 防护 |
| `schema/schema-transformer.ts` | - | 旧格式兼容转换 |
| `context/WorkbenchStore.ts` | ~954 | Zustand 全局状态 |
| `context/TerminalStore.ts` | ~138 | 终端命令状态 |
| `actions/ActionHandler.ts` | ~281 | 统一动作分发 |
| `actions/templateParser.ts` | ~190 | 模板变量解析 |
| `actions/handlers/chatHandler.ts` | ~77 | -> setPendingMessage |
| `actions/handlers/shellHandler.ts` | ~115 | -> agentApi.dispatch |
| `actions/handlers/exportHandler.ts` | ~322 | Excel/CSV/JSON/PDF/PNG/SVG |
| `actions/handlers/apiHandler.ts` | ~229 | HTTP + 重试 + 超时 |
| `actions/handlers/updateHandler.ts` | ~90 | 组件数据更新 |
| `actions/handlers/navigateHandler.ts` | ~74 | 路由/外链 |
| `actions/handlers/customHandler.ts` | ~188 | 可扩展 + 4 个预置 |
| `services/FileService.ts` | ~525 | Socket.IO 文件读写 |
| `hooks/useSessionWorkbench.ts` | ~352 | 会话持久化 |
| `hooks/useComponentData.ts` | ~276 | 组件数据联动 |
| `hooks/useKeyboardShortcuts.ts` | ~108 | 快捷键 |
| `components/index.ts` | ~347 | 36 种组件注册 |
| `registry/index.ts` | ~205 | 注册表框架 |
| `components/file/FileViewer.tsx` | ~627 | 文件查看+编辑+保存 |
| `components/file/FileBrowser.tsx` | ~417 | 文件浏览器 |
| `components/file/OfficePreview.tsx` | ~1031 | Word/Excel/PPT |
| `components/code/CodeEditor.tsx` | ~296 | Monaco 编辑器 |
| `components/data/DataTable.tsx` | ~335 | 数据表格 |
| `components/form/Button.tsx` | ~60 | 交互按钮 |
