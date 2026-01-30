/**
 * LSC-AI Workbench Schema 类型定义
 *
 * Schema 驱动机制：AI 输出 JSON Schema，前端自动渲染对应组件
 * 这是整个 Workbench 系统的类型基础
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 组件类型枚举 */
export type ComponentType =
  // 布局组件
  | 'Container'
  | 'Row'
  | 'Col'
  | 'Tabs'
  | 'Collapse'
  // 代码相关
  | 'CodeEditor'
  | 'CodeDiff'
  | 'Terminal'
  | 'SQLEditor'
  // 数据展示
  | 'DataTable'
  | 'Statistic'
  | 'Card'
  | 'Timeline'
  | 'List'
  | 'Citation'
  // 图表
  | 'BarChart'
  | 'LineChart'
  | 'PieChart'
  | 'AreaChart'
  | 'ScatterChart'
  | 'Gantt'
  // 文件预览（新版 - 基于 filePath 加载）
  | 'FileViewer'      // 通用文件查看器（根据类型自动选择预览器）
  | 'FileBrowser'     // 文件浏览器
  // 文件预览（旧版 - 基于 URL/内容）
  | 'FilePreview'
  | 'ImagePreview'
  | 'PdfPreview'
  | 'VideoPreview'
  | 'AudioPreview'
  | 'MarkdownView'
  // Office 文档预览
  | 'WordPreview'
  | 'ExcelPreview'
  | 'PPTPreview'
  // 表单
  | 'Form'
  | 'Input'
  | 'Select'
  | 'DatePicker'
  | 'Button'
  // 其他
  | 'Alert'
  | 'Progress'
  | 'Empty';

/** 事件动作类型 */
export type ActionType =
  | 'chat'      // 发送消息到 AI 对话
  | 'api'       // 调用后端 API
  | 'export'    // 导出文件
  | 'navigate'  // 页面导航
  | 'update'    // 更新组件数据
  | 'custom'    // 自定义动作
  | 'shell';    // 执行 shell 命令（通过 Client Agent）

/** 事件动作定义 */
export interface WorkbenchAction {
  type: ActionType;
  /** chat 类型：发送的消息内容 */
  message?: string;
  /** api 类型：API 端点 */
  endpoint?: string;
  /** api 类型：请求方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** api 类型：请求参数 */
  params?: Record<string, unknown>;
  /** export 类型：导出格式 */
  format?: 'excel' | 'csv' | 'pdf' | 'json' | 'png' | 'svg';
  /** export 类型：文件名 */
  filename?: string;
  /** navigate 类型：目标路径 */
  path?: string;
  /** update 类型：目标组件 ID */
  targetId?: string;
  /** update 类型：更新的数据 */
  data?: unknown;
  /** custom 类型：自定义处理器名称 */
  handler?: string;
  /** shell 类型：要执行的命令 */
  command?: string;
}

// ============================================================================
// 组件 Schema 基础
// ============================================================================

/** 组件 Schema 基础接口 */
export interface BaseComponentSchema {
  /** 组件类型 */
  type: ComponentType;
  /** 组件唯一标识（用于数据联动） */
  id?: string;
  /** 组件样式 */
  style?: React.CSSProperties;
  /** 组件类名 */
  className?: string;
  /** 子组件（布局组件使用） */
  children?: ComponentSchema[];
}

// ============================================================================
// 布局组件 Schema
// ============================================================================

/** 容器组件 */
export interface ContainerSchema extends BaseComponentSchema {
  type: 'Container';
  /** 内边距 */
  padding?: number | string;
  /** 背景 */
  background?: string;
}

/** 行组件 */
export interface RowSchema extends BaseComponentSchema {
  type: 'Row';
  /** 列间距 */
  gutter?: number | [number, number];
  /** 垂直对齐 */
  align?: 'top' | 'middle' | 'bottom';
  /** 水平对齐 */
  justify?: 'start' | 'end' | 'center' | 'space-around' | 'space-between';
}

/** 列组件 */
export interface ColSchema extends BaseComponentSchema {
  type: 'Col';
  /** 栅格占位数（0-24） */
  span?: number;
  /** 偏移 */
  offset?: number;
  /** 弹性布局 */
  flex?: string | number;
}

/** 标签页组件 */
export interface TabsSchema extends BaseComponentSchema {
  type: 'Tabs';
  /** 标签页项 */
  items: Array<{
    key: string;
    label: string;
    children?: ComponentSchema[];
    icon?: string;
    disabled?: boolean;
  }>;
  /** 默认激活的标签页 */
  defaultActiveKey?: string;
}

/** 折叠面板 */
export interface CollapseSchema extends BaseComponentSchema {
  type: 'Collapse';
  /** 面板项 */
  items: Array<{
    key: string;
    label: string;
    children?: ComponentSchema[];
  }>;
  /** 默认展开的面板 */
  defaultActiveKey?: string[];
  /** 是否手风琴模式 */
  accordion?: boolean;
}

// ============================================================================
// 代码相关组件 Schema
// ============================================================================

/** 代码编辑器 */
export interface CodeEditorSchema extends BaseComponentSchema {
  type: 'CodeEditor';
  /** 代码内容 */
  code: string;
  /** 编程语言 */
  language: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 显示行号 */
  lineNumbers?: boolean;
  /** 高度 */
  height?: number | string;
  /** 高亮行 */
  highlightLines?: number[];
  /** 文件路径（用于显示） */
  filePath?: string;
  /** 编辑时的回调动作 */
  onChangeAction?: WorkbenchAction;
}

/** 代码对比 */
export interface CodeDiffSchema extends BaseComponentSchema {
  type: 'CodeDiff';
  /** 原始代码 */
  original: string;
  /** 修改后代码 */
  modified: string;
  /** 编程语言 */
  language: string;
  /** 原始文件名 */
  originalTitle?: string;
  /** 修改后文件名 */
  modifiedTitle?: string;
  /** 高度 */
  height?: number | string;
}

/** 终端输出 */
export interface TerminalSchema extends BaseComponentSchema {
  type: 'Terminal';
  /** 输出内容（支持 ANSI 颜色） */
  content: string;
  /** 标题 */
  title?: string;
  /** 高度 */
  height?: number | string;
  /** 是否自动滚动到底部 */
  autoScroll?: boolean;
}

// ============================================================================
// 数据展示组件 Schema
// ============================================================================

/** 表格列定义 */
export interface TableColumn {
  /** 列标识 */
  key: string;
  /** 列标题 */
  title: string;
  /** 数据字段 */
  dataIndex: string;
  /** 宽度 */
  width?: number | string;
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right';
  /** 是否可排序 */
  sortable?: boolean;
  /** 渲染类型 */
  render?: 'text' | 'number' | 'date' | 'status' | 'action' | 'link';
  /** 状态映射（render=status 时使用） */
  statusMap?: Record<string, { text: string; color: string }>;
  /** 操作按钮（render=action 时使用） */
  actions?: Array<{
    label: string;
    action: WorkbenchAction;
    danger?: boolean;
  }>;
}

/** 数据表格 */
export interface DataTableSchema extends BaseComponentSchema {
  type: 'DataTable';
  /** 列定义 */
  columns: TableColumn[];
  /** 数据源 */
  data: Record<string, unknown>[];
  /** 行键字段 */
  rowKey?: string;
  /** 是否显示分页 */
  pagination?: boolean | { pageSize: number; total?: number };
  /** 是否可选择行 */
  selectable?: boolean;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 表格大小 */
  size?: 'small' | 'middle' | 'large';
  /** 选择行时的动作 */
  onSelectAction?: WorkbenchAction;
  /** 导出按钮 */
  exportable?: boolean;
}

/** 统计卡片 */
export interface StatisticSchema extends BaseComponentSchema {
  type: 'Statistic';
  /** 标题 */
  title: string;
  /** 数值 */
  value: number | string;
  /** 前缀 */
  prefix?: string;
  /** 后缀 */
  suffix?: string;
  /** 精度 */
  precision?: number;
  /** 趋势 */
  trend?: {
    value: number | string;
    direction: 'up' | 'down';
  };
  /** 颜色主题 */
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

/** 卡片 */
export interface CardSchema extends BaseComponentSchema {
  type: 'Card';
  /** 标题 */
  title?: string;
  /** 副标题 */
  extra?: string;
  /** 封面图 */
  cover?: string;
  /** 操作按钮 */
  actions?: Array<{
    label: string;
    icon?: string;
    action: WorkbenchAction;
  }>;
}

/** 时间线 */
export interface TimelineSchema extends BaseComponentSchema {
  type: 'Timeline';
  /** 时间线项 */
  items: Array<{
    /** 时间 */
    time?: string;
    /** 标题 */
    title: string;
    /** 描述 */
    description?: string;
    /** 状态颜色 */
    color?: 'blue' | 'green' | 'red' | 'gray';
    /** 图标 */
    icon?: string;
  }>;
  /** 是否倒序 */
  reverse?: boolean;
}

/** 列表 */
export interface ListSchema extends BaseComponentSchema {
  type: 'List';
  /** 列表项 */
  items: Array<{
    /** 标题 */
    title: string;
    /** 描述 */
    description?: string;
    /** 图标 */
    icon?: string;
    /** 状态 */
    status?: 'success' | 'warning' | 'error' | 'info';
    /** 额外内容 */
    extra?: string;
    /** 点击动作 */
    action?: WorkbenchAction;
  }>;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 列表大小 */
  size?: 'small' | 'default' | 'large';
}

// ============================================================================
// 图表组件 Schema
// ============================================================================

/** 图表基础配置 */
interface BaseChartSchema extends BaseComponentSchema {
  /** 图表标题 */
  title?: string;
  /** 高度 */
  height?: number;
  /** 是否显示图例 */
  legend?: boolean;
  /** 是否显示工具提示 */
  tooltip?: boolean;
}

/** 柱状图 */
export interface BarChartSchema extends BaseChartSchema {
  type: 'BarChart';
  /** X 轴数据 */
  xAxis: string[];
  /** 系列数据 */
  series: Array<{
    name: string;
    data: number[];
    color?: string;
  }>;
  /** 是否水平显示 */
  horizontal?: boolean;
  /** 是否堆叠 */
  stack?: boolean;
}

/** 折线图 */
export interface LineChartSchema extends BaseChartSchema {
  type: 'LineChart';
  /** X 轴数据 */
  xAxis: string[];
  /** 系列数据 */
  series: Array<{
    name: string;
    data: number[];
    color?: string;
    smooth?: boolean;
  }>;
  /** 是否显示面积 */
  area?: boolean;
}

/** 饼图 */
export interface PieChartSchema extends BaseChartSchema {
  type: 'PieChart';
  /** 数据 */
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  /** 是否环形图 */
  donut?: boolean;
  /** 内半径（环形图） */
  innerRadius?: number;
}

/** 面积图 */
export interface AreaChartSchema extends BaseChartSchema {
  type: 'AreaChart';
  /** X 轴数据 */
  xAxis: string[];
  /** 系列数据 */
  series: Array<{
    name: string;
    data: number[];
    color?: string;
  }>;
  /** 是否堆叠 */
  stack?: boolean;
}

/** 散点图 */
export interface ScatterChartSchema extends BaseChartSchema {
  type: 'ScatterChart';
  /** 数据点 */
  data: Array<{
    name?: string;
    value: [number, number]; // [x, y]
    color?: string;
    size?: number;
  }>;
  /** X 轴标签 */
  xAxisName?: string;
  /** Y 轴标签 */
  yAxisName?: string;
  /** 是否显示回归线 */
  regression?: boolean;
}

/** 甘特图任务 */
export interface GanttTask {
  /** 任务 ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 开始时间 */
  start: string;
  /** 结束时间 */
  end: string;
  /** 进度（0-100） */
  progress?: number;
  /** 依赖的任务 ID */
  dependencies?: string[];
  /** 任务颜色 */
  color?: string;
  /** 分组/类别 */
  group?: string;
}

/** 甘特图 */
export interface GanttSchema extends BaseComponentSchema {
  type: 'Gantt';
  /** 任务列表 */
  tasks: GanttTask[];
  /** 标题 */
  title?: string;
  /** 高度 */
  height?: number | string;
  /** 是否显示进度 */
  showProgress?: boolean;
  /** 是否显示依赖线 */
  showDependencies?: boolean;
  /** 点击任务的动作 */
  onTaskClick?: WorkbenchAction;
}

/** SQL 编辑器 */
export interface SQLEditorSchema extends BaseComponentSchema {
  type: 'SQLEditor';
  /** 初始 SQL 语句 */
  sql?: string;
  /** 数据库类型（用于语法高亮） */
  dialect?: 'mysql' | 'postgresql' | 'sqlite' | 'mssql';
  /** 高度 */
  height?: number | string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 执行按钮动作 */
  onExecuteAction?: WorkbenchAction;
  /** 结果数据（用于显示查询结果） */
  result?: {
    columns: string[];
    rows: Record<string, unknown>[];
  };
}

/** 引用项 */
export interface CitationItem {
  /** 引用 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 作者 */
  authors?: string[];
  /** 来源（期刊、网站等） */
  source?: string;
  /** 发布日期 */
  date?: string;
  /** 链接 */
  url?: string;
  /** 摘要 */
  abstract?: string;
  /** 引用类型 */
  type?: 'article' | 'book' | 'website' | 'paper' | 'other';
}

/** 引用组件 */
export interface CitationSchema extends BaseComponentSchema {
  type: 'Citation';
  /** 引用列表 */
  citations: CitationItem[];
  /** 标题 */
  title?: string;
  /** 显示样式 */
  displayStyle?: 'list' | 'card' | 'compact';
  /** 是否显示摘要 */
  showAbstract?: boolean;
}

// ============================================================================
// 文件预览组件 Schema（新版 - 基于 filePath）
// ============================================================================

/**
 * 文件类型枚举
 * 用于指定或自动检测文件的类型
 */
export type FileType =
  | 'code'      // 代码文件
  | 'text'      // 纯文本
  | 'markdown'  // Markdown
  | 'image'     // 图片
  | 'pdf'       // PDF
  | 'word'      // Word 文档 (.doc, .docx)
  | 'excel'     // Excel 表格 (.xls, .xlsx)
  | 'ppt'       // PPT 演示 (.ppt, .pptx)
  | 'video'     // 视频
  | 'audio'     // 音频
  | 'unknown';  // 未知类型

/**
 * 文件查看器组件
 *
 * 通过 filePath 加载文件内容（由 Client Agent 读取）
 * 根据文件类型自动选择合适的预览器
 *
 * AI 输出示例：
 * ```json
 * {
 *   "type": "FileViewer",
 *   "filePath": "D:/project/src/index.ts",
 *   "title": "入口文件"
 * }
 * ```
 */
export interface FileViewerSchema extends BaseComponentSchema {
  type: 'FileViewer';
  /** 文件路径（绝对路径或相对于工作目录） */
  filePath: string;
  /** 显示标题（默认使用文件名） */
  title?: string;
  /** 文件类型（可选，自动检测） */
  fileType?: FileType;
  /** 编程语言（代码文件使用） */
  language?: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 高度 */
  height?: number | string;
  /** 高亮行（代码文件使用） */
  highlightLines?: number[];
}

/**
 * 文件树节点
 */
export interface FileTreeNode {
  /** 文件/目录名 */
  name: string;
  /** 完整路径 */
  path: string;
  /** 是否是目录 */
  isDirectory: boolean;
  /** 子节点（目录时使用） */
  children?: FileTreeNode[];
  /** 文件大小（字节） */
  size?: number;
  /** 修改时间 */
  modifiedTime?: string;
}

/**
 * 文件浏览器组件
 *
 * 显示目录结构，支持：
 * - 展开/折叠目录
 * - 点击文件打开预览
 * - 拖放文件到其他区域
 *
 * AI 输出示例：
 * ```json
 * {
 *   "type": "FileBrowser",
 *   "rootPath": "D:/project/src",
 *   "patterns": ["**\/*.ts", "**\/*.tsx"]
 * }
 * ```
 */
export interface FileBrowserSchema extends BaseComponentSchema {
  type: 'FileBrowser';
  /** 根目录路径 */
  rootPath?: string;
  /** 文件过滤模式（glob patterns） */
  patterns?: string[];
  /** 排除模式 */
  excludePatterns?: string[];
  /** 是否显示隐藏文件 */
  showHidden?: boolean;
  /** 是否显示文件大小 */
  showSize?: boolean;
  /** 是否显示修改时间 */
  showModifiedTime?: boolean;
  /** 高度 */
  height?: number | string;
  /** 选择文件时的动作 */
  onSelectAction?: WorkbenchAction;
}

// ============================================================================
// 文件预览组件 Schema（旧版 - 基于 URL/内容）
// ============================================================================

/** 文件预览 */
export interface FilePreviewSchema extends BaseComponentSchema {
  type: 'FilePreview';
  /** 文件 URL */
  url: string;
  /** 文件名 */
  filename: string;
  /** 文件类型（可选，自动检测） */
  fileType?: 'image' | 'pdf' | 'code' | 'text' | 'video' | 'audio' | 'unknown';
  /** 高度 */
  height?: number | string;
}

/** 图片预览 */
export interface ImagePreviewSchema extends BaseComponentSchema {
  type: 'ImagePreview';
  /** 图片 URL */
  src: string;
  /** 替代文本 */
  alt?: string;
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 是否可缩放 */
  zoomable?: boolean;
}

/** PDF 预览 */
export interface PdfPreviewSchema extends BaseComponentSchema {
  type: 'PdfPreview';
  /** PDF URL（二选一） */
  url?: string;
  /** PDF 数据源（base64 data URL，二选一） */
  src?: string;
  /** 高度 */
  height?: number | string;
  /** 初始页码 */
  page?: number;
}

/** 视频预览 */
export interface VideoPreviewSchema extends BaseComponentSchema {
  type: 'VideoPreview';
  /** 视频源（URL 或 base64 data URL） */
  src: string;
  /** 高度 */
  height?: number | string;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
  /** 是否静音 */
  muted?: boolean;
}

/** 音频预览 */
export interface AudioPreviewSchema extends BaseComponentSchema {
  type: 'AudioPreview';
  /** 音频源（URL 或 base64 data URL） */
  src: string;
  /** 文件名（显示用） */
  filename?: string;
  /** 高度 */
  height?: number | string;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
}

/** Markdown 渲染 */
export interface MarkdownViewSchema extends BaseComponentSchema {
  type: 'MarkdownView';
  /** Markdown 内容 */
  content: string;
  /** 是否显示目录 */
  toc?: boolean;
}

// ============================================================================
// Office 文档预览组件 Schema
// ============================================================================

/**
 * Word 文档预览
 *
 * 支持 .doc, .docx 文件
 * 通过 filePath 加载或提供 URL
 */
export interface WordPreviewSchema extends BaseComponentSchema {
  type: 'WordPreview';
  /** 文件路径（优先使用） */
  filePath?: string;
  /** 文件 URL（备选） */
  url?: string;
  /** 文件数据（base64，用于拖放预览） */
  fileData?: string;
  /** 原始文件名 */
  filename?: string;
  /** 显示标题 */
  title?: string;
  /** 高度 */
  height?: number | string;
}

/**
 * Excel 预览
 *
 * 支持 .xls, .xlsx 文件
 * 提供表格视图和基本的编辑功能
 */
export interface ExcelPreviewSchema extends BaseComponentSchema {
  type: 'ExcelPreview';
  /** 文件路径（优先使用） */
  filePath?: string;
  /** 文件 URL（备选） */
  url?: string;
  /** 文件数据（base64，用于拖放预览） */
  fileData?: string;
  /** 原始文件名 */
  filename?: string;
  /** 显示标题 */
  title?: string;
  /** 是否只读 */
  readOnly?: boolean;
  /** 默认显示的工作表索引 */
  defaultSheet?: number;
  /** 高度 */
  height?: number | string;
}

/**
 * PPT 预览
 *
 * 支持 .ppt, .pptx 文件
 * 提供幻灯片预览和导航
 */
export interface PPTPreviewSchema extends BaseComponentSchema {
  type: 'PPTPreview';
  /** 文件路径（优先使用） */
  filePath?: string;
  /** 文件 URL（备选） */
  url?: string;
  /** 文件数据（base64，用于拖放预览） */
  fileData?: string;
  /** 原始文件名 */
  filename?: string;
  /** 显示标题 */
  title?: string;
  /** 默认显示的幻灯片索引 */
  defaultSlide?: number;
  /** 高度 */
  height?: number | string;
}

// ============================================================================
// 表单组件 Schema
// ============================================================================

/** 表单字段定义 */
export interface FormField {
  /** 字段名 */
  name: string;
  /** 标签 */
  label: string;
  /** 字段类型 */
  type: 'input' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox' | 'radio';
  /** 默认值 */
  defaultValue?: unknown;
  /** 占位符 */
  placeholder?: string;
  /** 是否必填 */
  required?: boolean;
  /** 选项（select/radio 使用） */
  options?: Array<{ label: string; value: string | number }>;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 表单 */
export interface FormSchema extends BaseComponentSchema {
  type: 'Form';
  /** 表单字段 */
  fields: FormField[];
  /** 提交按钮文本 */
  submitText?: string;
  /** 提交动作 */
  onSubmitAction?: WorkbenchAction;
  /** 布局方式 */
  layout?: 'horizontal' | 'vertical' | 'inline';
}

/** 按钮 */
export interface ButtonSchema extends BaseComponentSchema {
  type: 'Button';
  /** 按钮文本 */
  text: string;
  /** 按钮类型 */
  variant?: 'primary' | 'default' | 'dashed' | 'text' | 'link';
  /** 图标 */
  icon?: string;
  /** 是否危险按钮 */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 点击动作 */
  action?: WorkbenchAction;
}

/** 输入框 */
export interface InputSchema extends BaseComponentSchema {
  type: 'Input';
  /** 输入类型 */
  inputType?: 'text' | 'password' | 'number' | 'email' | 'tel' | 'url' | 'textarea';
  /** 占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 标签 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 前缀 */
  prefix?: string;
  /** 后缀 */
  suffix?: string;
  /** 最大长度 */
  maxLength?: number;
  /** 行数（textarea） */
  rows?: number;
  /** 是否可清空 */
  allowClear?: boolean;
  /** 验证状态 */
  status?: 'success' | 'warning' | 'error';
  /** 帮助文本 */
  helpText?: string;
  /** 变更动作 */
  onChangeAction?: WorkbenchAction;
}

/** 选择器选项 */
export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

/** 选择器 */
export interface SelectSchema extends BaseComponentSchema {
  type: 'Select';
  /** 选项列表 */
  options: SelectOption[];
  /** 占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: string | number | (string | number)[];
  /** 标签 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 是否多选 */
  multiple?: boolean;
  /** 是否可搜索 */
  searchable?: boolean;
  /** 是否可清空 */
  allowClear?: boolean;
  /** 验证状态 */
  status?: 'success' | 'warning' | 'error';
  /** 帮助文本 */
  helpText?: string;
  /** 变更动作 */
  onChangeAction?: WorkbenchAction;
}

/** 日期选择器 */
export interface DatePickerSchema extends BaseComponentSchema {
  type: 'DatePicker';
  /** 占位符 */
  placeholder?: string;
  /** 默认值（YYYY-MM-DD 格式） */
  defaultValue?: string;
  /** 标签 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 是否可清空 */
  allowClear?: boolean;
  /** 日期格式 */
  format?: string;
  /** 验证状态 */
  status?: 'success' | 'warning' | 'error';
  /** 帮助文本 */
  helpText?: string;
  /** 变更动作 */
  onChangeAction?: WorkbenchAction;
}

// ============================================================================
// 其他组件 Schema
// ============================================================================

/** 警告提示 */
export interface AlertSchema extends BaseComponentSchema {
  type: 'Alert';
  /** 提示类型 */
  alertType: 'success' | 'info' | 'warning' | 'error';
  /** 标题 */
  message: string;
  /** 描述 */
  description?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否可关闭 */
  closable?: boolean;
}

/** 进度条 */
export interface ProgressSchema extends BaseComponentSchema {
  type: 'Progress';
  /** 进度值（0-100） */
  percent: number;
  /** 进度条类型 */
  progressType?: 'line' | 'circle' | 'dashboard';
  /** 状态 */
  status?: 'normal' | 'success' | 'exception' | 'active';
  /** 显示信息 */
  format?: string;
}

/** 空状态 */
export interface EmptySchema extends BaseComponentSchema {
  type: 'Empty';
  /** 描述文字 */
  description?: string;
  /** 图片 */
  image?: string;
}

// ============================================================================
// 组件 Schema 联合类型
// ============================================================================

export type ComponentSchema =
  // 布局
  | ContainerSchema
  | RowSchema
  | ColSchema
  | TabsSchema
  | CollapseSchema
  // 代码
  | CodeEditorSchema
  | CodeDiffSchema
  | TerminalSchema
  // 数据展示
  | DataTableSchema
  | StatisticSchema
  | CardSchema
  | TimelineSchema
  | ListSchema
  // 图表
  | BarChartSchema
  | LineChartSchema
  | PieChartSchema
  | AreaChartSchema
  | ScatterChartSchema
  | GanttSchema
  // 代码编辑
  | SQLEditorSchema
  // 知识管理
  | CitationSchema
  // 文件预览（新版）
  | FileViewerSchema
  | FileBrowserSchema
  // 文件预览（旧版）
  | FilePreviewSchema
  | ImagePreviewSchema
  | PdfPreviewSchema
  | VideoPreviewSchema
  | AudioPreviewSchema
  | MarkdownViewSchema
  // Office 文档预览
  | WordPreviewSchema
  | ExcelPreviewSchema
  | PPTPreviewSchema
  // 表单
  | FormSchema
  | ButtonSchema
  | InputSchema
  | SelectSchema
  | DatePickerSchema
  // 其他
  | AlertSchema
  | ProgressSchema
  | EmptySchema;

// ============================================================================
// Workbench Schema（顶层）
// ============================================================================

/** Workbench 标签页 */
export interface WorkbenchTab {
  /** 标签页键 */
  key: string;
  /** 标签页标题 */
  title: string;
  /** 标签页图标 */
  icon?: string;
  /** 是否可关闭 */
  closable?: boolean;
  /** 标签页内容 */
  components: ComponentSchema[];
}

/** Workbench Schema（AI 输出的顶层结构） */
export interface WorkbenchSchema {
  /** 类型标识 */
  type: 'workbench';
  /** 工作台标题 */
  title?: string;
  /** 标签页列表 */
  tabs: WorkbenchTab[];
  /** 默认激活的标签页 */
  defaultActiveKey?: string;
  /** 工作台 ID（用于持久化） */
  workbenchId?: string;
}

// ============================================================================
// 运行时类型
// ============================================================================

/** 组件实例状态 */
export interface ComponentState {
  /** 组件 ID */
  id: string;
  /** 组件数据 */
  data: unknown;
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error?: string;
  /** 选中的行 Key（用于 DataTable） */
  selectedKeys?: React.Key[];
  /** 选中的行数据（用于 DataTable） */
  selectedRows?: unknown[];
  /** 表单值（用于 Form） */
  formValues?: Record<string, unknown>;
}

/** Workbench 运行时状态 */
export interface WorkbenchState {
  /** 当前 Schema */
  schema: WorkbenchSchema | null;
  /** 当前激活的标签页 */
  activeTabKey: string;
  /** 各组件状态 */
  componentStates: Map<string, ComponentState>;
  /** 是否可见 */
  visible: boolean;
  /** 宽度比例（0-1） */
  widthRatio: number;
}
