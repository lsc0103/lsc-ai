# Workbench 架构设计功能清单

> 来源: 架构文档 `应用化/架构文档/架构整合/sections/` 中的 HTML 文档
> 整理日期: 2026-02-07
> 目的: 梳理 Workbench 原始架构设计中定义的全部功能,用于与当前实现进行对比

---

## 1. 内容渲染能力

### 1.1 组件分类体系 (30+ 组件)

**数据展示组件:**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| DataTable | 数据表格 - 列配置/排序/筛选/分页/行选择/单元格渲染器/导出 | 09-前端组件:2.1, 12-Workbench:Phase3 |
| Card | 信息卡片 - 标题/内容/封面图/操作按钮/多种布局 | 09-前端组件:2.1 |
| Statistic | 统计数值 - 数值展示/趋势指示/前后缀/颜色主题 | 09-前端组件:2.1, 12-Workbench:Phase3 |
| Timeline | 时间线 - 事件展示/状态颜色/折叠展开 | 09-前端组件:2.1, 12-Workbench:Phase3 |
| Tree | 树形结构 | 09-前端组件:2.1 |

**图表组件 (ECharts):**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| BarChart | 柱状图 - xField/yFields/stacked/horizontal | 09-前端组件:2.1+3.3, 12-Workbench:Phase4 |
| LineChart | 折线图 - xField/yFields/smooth/area | 09-前端组件:2.1+3.3 |
| PieChart | 饼图 - nameField/valueField/donut | 09-前端组件:2.1+3.3 |
| AreaChart | 面积图 | 09-前端组件:2.1 |
| ScatterChart | 散点图 (标注为缺失, P2) | 12-1-Workbench开发计划:4.1 |

图表通用功能: 图例/工具提示/数据缩放/主题适配/响应式/数据动态更新/点击事件/导出图片

**内容展示组件:**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| MarkdownView | Markdown 渲染 - 完整语法/代码块高亮/表格渲染/目录导航 | 09-前端组件:2.1, 12-Workbench:Phase2 |
| CodeEditor/CodeBlock | Monaco Editor 代码编辑器 - 100+语言语法高亮/智能补全/折叠/搜索替换/只读+编辑模式/Diff对比视图/onSave ActionSchema | 09-前端组件:2.2+3.4, 12-Workbench:Phase2 |
| FilePreview | 文件预览 - 图片预览(缩放/旋转)/PDF预览/代码文件高亮/未知类型下载 | 09-前端组件:2.1, 12-Workbench:Phase2 |
| IframeEmbed/IFrame | 网页嵌入 - 域名白名单安全校验 | 09-前端组件:2.1 |
| TerminalOutput | 终端输出 - 命令执行结果展示/ANSI颜色支持/滚动优化/复制 | 12-Workbench:Phase2 |
| Image | 图片展示 | 09-前端组件:4.2 |

**表单组件:**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| FormBuilder/Form | 表单容器 - fields配置/horizontal+vertical+inline布局/submitText/onSubmit Action | 09-前端组件:2.1+3.5, 12-Workbench:Phase5 |
| Input | 输入框 | 09-前端组件:2.1 |
| Select | 下拉选择 - options label/value | 09-前端组件:2.1 |
| DatePicker | 日期选择 | 09-前端组件:2.1 |
| Checkbox/Radio | 勾选/单选 | 12-Workbench:Phase5 |
| Button | 按钮 - 触发 ActionSchema | 09-前端组件:2.1 |

**布局组件:**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| Container | 容器 - props: { title } | 09-前端组件:4.2 |
| Row/Col | 栅格布局 - Col span: 1-24, gutter | 09-前端组件:2.1 |
| Tabs | 标签页 | 09-前端组件:2.1 |
| Collapse | 折叠面板 | 09-前端组件:2.1 |
| Divider | 分割线 | 09-前端组件:2.1 |

**工具组件:**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| ExportButton | 导出按钮 | 09-前端组件:2.1 |
| RefreshButton | 刷新按钮 | 09-前端组件:2.1 |
| CopyButton | 复制按钮 | 09-前端组件:2.1 |
| ActionMenu | 操作菜单 | 09-前端组件:2.1 |

**缺失但设计中提到的高级组件 (P2):**
| 组件 | 设计描述 | 文档出处 |
|------|---------|---------|
| Gantt | 甘特图 - 项目管理场景核心 | 12-1-Workbench开发计划:4.1 |
| SQLEditor | SQL编辑器 - 语法高亮/自动补全/执行查询 | 12-1-Workbench开发计划:4.1 |
| Citation | 引用组件 - 引用来源/参考文献 | 12-1-Workbench开发计划:4.1 |

### 1.2 Schema 驱动渲染机制

**基础 Schema 结构:**
```typescript
interface ComponentSchema {
  type: string;                    // 组件类型
  props?: Record<string, any>;     // 组件属性
  children?: ComponentSchema[];    // 子组件
  actions?: ActionSchema[];        // 交互动作
}
```

**渲染流程:**
1. AI 输出 JSON Schema (workbench-schema 代码块格式)
2. SchemaValidator 安全校验 (组件白名单/XSS防护/IFrame域名白名单/递归校验)
3. ComponentRegistry 组件查找 (注册表映射)
4. SchemaRenderer 递归渲染组件
5. 绑定事件处理
6. Workbench 展示

**AI Schema 输出格式:**
```json
{
  "type": "workbench",
  "tabs": [
    {
      "title": "数据分析",
      "components": [
        { "type": "DataTable", ... },
        { "type": "BarChart", ... }
      ]
    }
  ]
}
```
> 出处: 09-前端组件:3.1-4.4, 12-Workbench:2.2

---

## 2. 交互能力

### 2.1 Action 系统 (事件处理)

**Action 类型:**
| Action 类型 | 设计描述 | 触发方式 | 文档出处 |
|------------|---------|---------|---------|
| `chat` | 发送消息到 AI 对话,触发新一轮 AI 响应 | click/submit | 09-前端组件:5.1, 12-Workbench:2.3 |
| `api` | 调用后端 API, 可触发 UI 更新 | click/change/submit | 09-前端组件:5.1+5.2 |
| `export` | 导出文件 (Excel/CSV/PDF/JSON/PNG/SVG) | click | 09-前端组件:5.1, 12-1:1.2 |
| `navigate` | 页面导航 (内部路由/外部链接) | click | 09-前端组件:5.1+5.2 |
| `update` | 更新组件数据 - 通过 targetId 指定目标组件 | click/change | 12-Workbench:2.3, 12-1:2.2 |
| `shell` | 执行 Shell 命令 (通过 Client Agent) | click | 文档中场景暗示 |
| `custom` | 自定义动作 | - | CLAUDE.md 提及 |

**ActionSchema 接口:**
```typescript
interface ActionSchema {
  trigger: 'click' | 'change' | 'submit';
  type: 'chat' | 'api' | 'export' | 'navigate' | 'update';
  payload: any;
}
```
> 出处: 09-前端组件:3.1, 12-Workbench:2.3

### 2.2 AI 生成交互按钮

设计中 AI 可以在 Workbench Schema 中定义按钮及其 action, 用户点击后触发 AI 响应。这是核心交互闭环:

**关键场景:**
- 代码审查: "一键应用所有建议" / "逐个确认" 按钮
- Bug 修复: "应用修复" / "查看更多方案" 按钮
- 数据分析: "导出 Excel" / "生成周报" / "深入分析" 按钮
- 合同审查: "生成审查报告" / "标注问题条款" 按钮
- 运维监控: "AI 智能诊断" / "批量重启" 按钮
- 安全扫描: "一键修复所有" / "生成报告" 按钮
- 项目管理: "更新进度" / "生成周报" / "调整计划" 按钮
- PPT 生成: "下载 PPTX" / "在线编辑" / "全屏预览" 按钮
- 知识问答: "继续提问" / "查看更多来源" 按钮
- 内容创作: "生成配图" / "SEO优化" / "导出公众号格式" 按钮

> 出处: 12-Workbench:4.1-4.10 全部场景

### 2.3 数据联动

**WorkbenchContext 数据总线:**
```typescript
interface WorkbenchContext {
  data: Record<string, any>;        // 共享数据
  setData: (key: string, value: any) => void;
  getData: (key: string) => any;
  refreshData: (key: string) => void;
}
```

**联动机制:**
- 组件暴露自己的状态 (如 DataTable 的选中行)
- 其他组件可以订阅状态变化
- 通过 ID 引用数据: `"dataSource": "sales-table.selectedRows"`
- 表格选择 -> 图表联动更新
- 表单输入变化 -> 其他组件更新
- 变量引用: `"data": "${selectedRows}"`

> 出处: 09-前端组件:5.3, 12-1-Workbench开发计划:2.1-2.2

---

## 3. 本地模式集成 (Client Agent)

### 3.1 三方实时协作通道

```
浏览器 <-- WebSocket --> Platform <-- WebSocket --> Client Agent
```

**设计描述:**
- 浏览器 <-> Platform: 聊天消息流式输出/Workbench 实时更新/任务执行状态推送
- Platform <-> Client Agent: 指令下发/结果回传/心跳保活
- Workbench 展示完整执行过程 (工具调用/文件操作/代码生成等)

> 出处: 01-架构总览:3.2+3.4.2, 12-Workbench:1.1

### 3.2 本地文件浏览

**设计描述:** 进入本地模式后, Workbench 侧边栏 (wb-sidebar) 显示当前工作路径下的文件树:
- 文件树形结构展示 (文件夹/文件图标)
- 文件点击打开在编辑器中
- 当前打开文件高亮
- 项目结构预览

**场景示例:** "帮我创建一个 Vue3 项目" -> Workbench 左侧显示项目文件树, 右侧显示代码编辑器
> 出处: 12-Workbench:4.1 场景"项目创建与初始化"

### 3.3 代码编辑保存到本地

**设计描述:** 用户在 Workbench 中:
1. 通过文件树点击打开本地文件
2. Monaco Editor 中编辑代码
3. 保存后通过 Client Agent 写回本地文件系统
4. CodeBlock 组件的 `onSave` ActionSchema 支持保存操作

**相关 Action:**
- "在 VS Code 打开" 按钮
- "应用修复" 按钮 (代码修复后保存到本地)
- "一键应用所有建议" (代码审查后批量应用)

> 出处: 09-前端组件:3.4, 12-Workbench:4.1

### 3.4 实时执行可视化

**设计描述:** 工具调用/文件操作/代码生成/命令执行的实时过程展示:
- 终端命令的实时输出 (TerminalOutput 组件)
- 文件创建/修改的实时预览
- 执行进度条和状态指示
- 工具调用过程展示 (ToolSteps 整合为 Workbench 的一部分)

> 出处: 12-Workbench:Phase6, 01-架构总览:3.4.2+3.4.3

---

## 4. Action 系统详细设计

### 4.1 ActionHandler 核心模块

```typescript
class ActionHandler {
  // chat: 发送消息给 AI, 触发新一轮对话
  async handleChat(message: string): Promise<void>;

  // export: 导出文件 (excel/csv/pdf/json/png/svg)
  async handleExport(format: string, data: any, filename: string): Promise<void>;

  // api: 调用后端 API
  async handleApi(endpoint: string, method: string, params: any): Promise<any>;

  // update: 更新组件数据 (通过 targetId)
  handleUpdate(targetId: string, data: any): void;

  // navigate: 页面导航 (内部/外部)
  handleNavigate(path: string, external?: boolean): void;
}
```
> 出处: 12-1-Workbench开发计划:1.1 架构设计

### 4.2 Action 触发点

| 组件 | 触发方式 | 设计描述 | 文档出处 |
|------|---------|---------|---------|
| Button | onClick -> action | 点击执行 ActionSchema | 09-前端组件:5.2, 12-1:1.1 |
| DataTable | onRowClick / onSelectAction | 行点击/行选择触发 action | 09-前端组件:3.2, 12-1:1.1 |
| Form | onSubmit | 表单提交触发 action | 09-前端组件:3.5 |
| CodeBlock | onSave | 编辑保存触发 action | 09-前端组件:3.4 |
| 图表组件 | onClick (点击事件) | 图表数据点点击 | 12-Workbench:Phase4 |

---

## 5. 应用场景 (10 大类 16 个场景)

### 场景 S01: 软件开发 - 项目创建与初始化
- **用户输入:** "帮我创建一个 Vue3 + TypeScript + Vite 项目"
- **Workbench 展示:** 左侧文件树 + 右侧代码编辑器(App.vue) + 终端输出(创建/安装/启动)
- **交互按钮:** "在 VS Code 打开" / "继续开发" / "查看预览"
- **核心组件:** FileTree, CodeEditor, TerminalOutput
- **出处:** 12-Workbench:4.1

### 场景 S02: 软件开发 - 代码审查与重构
- **用户输入:** "审查这个文件的代码质量,给出改进建议"
- **Workbench 展示:** Diff 对比视图(原代码 vs 建议修改) + 问题清单(警告/建议/通过)
- **交互按钮:** "一键应用所有建议" / "逐个确认"
- **核心组件:** DiffView, CodeEditor, ListItems
- **出处:** 12-Workbench:4.1

### 场景 S03: 软件开发 - Bug 调试与修复
- **用户输入:** "这个报错怎么解决?" + 错误日志
- **Workbench 展示:** 错误信息展示 + 根因分析列表 + 修复代码(Diff视图)
- **交互按钮:** "应用修复" / "查看更多方案"
- **核心组件:** Alert, DiffView, ListItems
- **出处:** 12-Workbench:4.1

### 场景 S04: 数据分析 - 数据查询与可视化
- **用户输入:** "查询上个月的销售数据,按地区分析"
- **Workbench 展示:** 统计卡片(总销售额/各地区) + 数据表格 + 柱状图 + AI洞察
- **交互按钮:** "导出 Excel" / "导出 PDF" / "生成周报" / "深入分析"
- **核心组件:** Statistic, DataTable, BarChart, Alert(info)
- **出处:** 12-Workbench:4.2

### 场景 S05: 数据分析 - 数据库查询
- **用户输入:** "查询订单表,找出金额大于1万的订单"
- **Workbench 展示:** SQL编辑器(语法高亮) + 执行结果表格 + 查询统计
- **交互按钮:** "执行" / "格式化" / "解释执行计划" / "导出结果" / "生成图表" / "保存为视图"
- **核心组件:** SQLEditor/CodeBlock, DataTable, Alert(success)
- **出处:** 12-Workbench:4.2

### 场景 S06: 文档处理 - 合同/文档审查
- **用户输入:** "审查这份合同,提取关键信息"
- **Workbench 展示:** 左侧PDF预览(分页) + 右侧信息提取面板(甲方/乙方/金额/有效期/付款) + 风险提示
- **交互按钮:** "生成审查报告" / "标注问题条款"
- **核心组件:** FilePreview(PDF), RightPanel, Alert(warning)
- **出处:** 12-Workbench:4.3

### 场景 S07: 文档处理 - 报告自动生成
- **用户输入:** "根据这些数据生成月度工作报告"
- **Workbench 展示:** 左侧报告大纲+字数统计 + 右侧Markdown编辑器(编辑/预览模式) + 内嵌图表
- **交互按钮:** "导出 Word" / "导出 PDF" / "发送邮件"
- **核心组件:** Sidebar(大纲), MarkdownEditor, Charts
- **出处:** 12-Workbench:4.3

### 场景 S08: 办公自动化 - PPT 演示文稿生成
- **用户输入:** "根据这份方案,生成一个10页的PPT"
- **Workbench 展示:** 左侧幻灯片缩略图 + 右侧幻灯片预览 + 模板选择
- **交互按钮:** "下载 PPTX" / "在线编辑" / "全屏预览" / "调整配色"
- **核心组件:** SlidePreview, Select(模板), Button
- **出处:** 12-Workbench:4.4

### 场景 S09: 办公自动化 - 会议纪要生成
- **用户输入:** "根据这段会议录音,生成会议纪要"
- **Workbench 展示:** 左侧音频转写(时间戳+发言人) + 右侧结构化纪要(主题/参会人/议题/待办)
- **交互按钮:** "导出 Word" / "发送参会人"
- **核心组件:** Timeline(转写), RightPanel(结构化), Button
- **出处:** 12-Workbench:4.4

### 场景 S10: 运维监控 - 服务器状态监控
- **用户输入:** "查看所有服务器的运行状态"
- **Workbench 展示:** 统计卡片(正常/告警/故障/总数) + 服务器状态表格(CPU/内存/磁盘/网络) + 告警提示
- **交互按钮:** "AI 智能诊断" / "批量重启" / "导出报告"
- **核心组件:** Statistic, DataTable, Alert(warning/error)
- **出处:** 12-Workbench:4.5

### 场景 S11: 运维监控 - 日志分析与故障修复
- **用户输入:** "redis-01 挂了,帮我排查并修复"
- **Workbench 展示:** 诊断过程列表(检查步骤+结果) + 修复方案 + 执行进度条 + 终端执行记录
- **交互按钮:** "查看执行日志" / "回滚操作"
- **核心组件:** ListItems(诊断), Progress, TerminalOutput
- **出处:** 12-Workbench:4.5

### 场景 S12: 业务集成 - RPA 流程自动化
- **用户输入:** "自动审批所有金额小于1000元的报销单"
- **Workbench 展示:** 统计卡片(待处理/已通过/跳过/待处理) + 审批列表(实时状态) + 执行记录终端 + 进度条
- **交互按钮:** "暂停" / "停止" / "查看完整日志"
- **核心组件:** Statistic, ListItems, TerminalOutput, Progress
- **出处:** 12-Workbench:4.6

### 场景 S13: 知识管理 - 知识库问答
- **用户输入:** "公司的年假政策是什么?"
- **Workbench 展示:** AI回答区 + 引用来源(文档名/页码/原文摘录) + 相关问题推荐
- **交互按钮:** "继续提问" / "查看更多来源" / "导出回答"
- **核心组件:** Markdown, Citation, Button
- **出处:** 12-Workbench:4.7

### 场景 S14: 内容创作 - 文章写作
- **用户输入:** "帮我写一篇关于AI在制造业应用的公众号文章"
- **Workbench 展示:** 左侧大纲(带完成状态)+字数统计 + 右侧编辑器(正文编辑/预览/SEO分析) + 配图占位
- **交互按钮:** "生成配图" / "SEO优化" / "预览效果" / "导出公众号格式"
- **核心组件:** Sidebar(大纲), MarkdownEditor, Progress
- **出处:** 12-Workbench:4.8

### 场景 S15: 项目管理 - 项目进度追踪
- **用户输入:** "查看 XX 项目的当前进度"
- **Workbench 展示:** 整体进度条 + 甘特图(任务时间线) + 风险提示 + 待办事项列表(带截止日期)
- **交互按钮:** "更新进度" / "生成周报" / "调整计划"
- **核心组件:** Progress, Gantt, Alert(warning), ListItems
- **出处:** 12-Workbench:4.9

### 场景 S16: 安全合规 - 代码安全扫描
- **用户输入:** "扫描这个项目的安全漏洞"
- **Workbench 展示:** 统计卡片(高危/中危/低危/总数) + 漏洞列表表格 + 漏洞详情(位置/问题/修复) + Diff修复代码
- **交互按钮:** "一键修复所有" / "生成报告" / "导出PDF"
- **核心组件:** Statistic, DataTable, DiffView, CodeBlock
- **出处:** 12-Workbench:4.10

---

## 6. Workbench 核心功能 (02-功能清单)

### 6.1 工作台核心功能 (P0)
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 动态开启 | AI 执行任务时自动开启 Workbench | P0 |
| 分屏展示 | 左侧聊天,右侧工作台 | P0 |
| 返回主界面 | 点击返回按钮切回主界面 | P0 |
| 多标签页 | 工作台内支持多标签页 | P1 |
| 标签页管理 | 新增/关闭/切换标签页 | P1 |

### 6.2 内容展示类型 (P0-P1)
| 类型 | 描述 | 优先级 |
|------|------|--------|
| 代码编辑器 | Monaco Editor, 语法高亮/编辑 | P0 |
| 文件预览 | 图片/PDF/Office 文档预览 | P0 |
| 数据表格 | 数据展示/排序/筛选 | P0 |
| 图表展示 | ECharts 图表(柱/折/饼等) | P0 |
| Markdown 预览 | Markdown 文档渲染 | P0 |
| 网页嵌入 | iframe 嵌入 | P1 |
| 终端输出 | 命令执行结果展示 | P1 |
| 表单 | 动态表单(AI构建) | P1 |

### 6.3 AI 动态构建 (P1)
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 组件库调用 | AI 可调用预设组件库构建界面 | P1 |
| 报表生成 | AI 根据数据自动生成报表 | P1 |
| 交互响应 | 用户在 Workbench 操作可触发 AI 响应 | P1 |

> 出处: 02-功能清单:2.2

---

## 7. 技术架构层次

### 渲染层
- SchemaRenderer (JSON -> React)
- ComponentRegistry (30+ 组件注册表)
- TabManager (多标签页管理)
- LayoutEngine (分屏布局)

### 状态层
- WorkbenchContext (共享状态)
- DataStore (数据联动)
- ExecutionState (执行状态)
- HistoryManager (操作历史)

### 事件层
- ActionHandler (事件处理 - chat/api/export/navigate/update)
- ChatTrigger (触发 AI 对话)
- APIConnector (调用后端)
- ExportHandler (导出文件)

### 通信层
- Socket.IO (实时通信)
- StreamHandler (流式更新)
- AgentBridge (Client Agent 桥接)

> 出处: 12-Workbench:2.1

---

## 8. 与现有系统整合点

| 现有模块 | 整合方式 | 出处 |
|---------|---------|------|
| ToolSteps.tsx | 整合为 Workbench 一部分,增加工具输出的可视化预览 | 12-Workbench:2.4 |
| socket.ts | 扩展事件: workbench:update / workbench:open | 12-Workbench:2.4 |
| chat.ts store | 新增 workbenchState 状态管理 | 12-Workbench:2.4 |
| MessageBubble.tsx | 检测消息中 Schema 代码块,自动触发 Workbench 打开 | 12-Workbench:2.4 |
| ChatGateway | 新增 Workbench 相关事件转发 | 12-Workbench:2.4 |
| AgentGateway | 转发 Client Agent 工具输出到 Workbench | 12-Workbench:2.4 |

---

## 9. 预设模板系统

| 模板 | 描述 | 出处 |
|------|------|------|
| stats-report | 数据统计报表: 统计卡片 + 趋势图 + 明细表 | 09-前端组件:9.1 |
| compare-report | 对比分析: 双饼图 + 对比表格 | 09-前端组件:9.1 |
| timeline-report | 时间线报告: 事件时间线 | 09-前端组件:9.1 |

---

## 10. 关键创新点

1. **执行过程可视化** -- 不仅展示结果,还展示完整的任务执行过程 (文件创建/代码编写/命令执行) | 12-Workbench:六
2. **用户可介入编辑** -- AI 生成后用户可直接编辑,让 AI 基于修改继续工作,形成人机协作闭环 | 12-Workbench:六
3. **数据交互闭环** -- 组件间数据联动, 表格选择 -> AI 深入分析, 从"展示"到"交互"到"智能响应" | 12-Workbench:六
4. **三方实时协作** -- 浏览器 <-> Platform <-> Client Agent 三方实时通信, 本地/云端统一可视化 | 12-Workbench:六

---

## 11. 开发计划完成度 (12-1 文档评估)

| 维度 | 完成度 | 说明 |
|------|--------|------|
| 组件库 | 85% | 基础组件齐全,缺少 Gantt/SQLEditor/Citation/ScatterChart |
| 交互能力 | 0% | Button action 无法执行,无法触发 AI 对话/导出/API |
| 多代理协同 | 0% | 未利用内核子代理系统 |
| 数据联动 | 0% | 组件间无法传递数据 |
| 应用场景 | 30% | 能展示但无法交互,仅"软件开发"基本可用 |

> 出处: 12-1-Workbench开发计划:一、现状分析
