/**
 * Workbench 组件注册
 *
 * 在此注册所有 Workbench 组件到 ComponentRegistry
 */

import { ComponentRegistry } from '../registry';

// 布局组件
import { Container } from './layout/Container';
import { Row } from './layout/Row';
import { Col } from './layout/Col';
import { Tabs } from './layout/Tabs';
import { Collapse } from './layout/Collapse';

// 代码组件
import { CodeEditor } from './code/CodeEditor';
import { Terminal } from './code/Terminal';
import { CodeDiff } from './code/CodeDiff';
import { SQLEditor } from './code/SQLEditor';

// 文件组件（新增）
import { FileViewer, FileBrowser, WordPreview, ExcelPreview, PPTPreview } from './file';

// 预览组件
import { MarkdownView } from './preview/MarkdownView';
import { ImagePreview } from './preview/ImagePreview';
import { PdfPreview } from './preview/PdfPreview';
import { VideoPreview } from './preview/VideoPreview';
import { AudioPreview } from './preview/AudioPreview';

// 数据展示组件
import { Statistic } from './data/Statistic';
import { DataTable } from './data/DataTable';
import { Card } from './data/Card';
import { Timeline } from './data/Timeline';
import { List } from './data/List';
import { Citation } from './data/Citation';

// 表单组件
import { Form } from './form/Form';
import { Button } from './form/Button';
import { Input } from './form/Input';
import { Select } from './form/Select';
import { DatePicker } from './form/DatePicker';

// 图表组件
import { BarChart } from './chart/BarChart';
import { LineChart } from './chart/LineChart';
import { PieChart } from './chart/PieChart';
import { AreaChart } from './chart/AreaChart';
import { ScatterChart } from './chart/ScatterChart';
import { Gantt } from './chart/Gantt';

// 其他组件
import { Alert } from './other/Alert';
import { Progress } from './other/Progress';

// ============================================================================
// 注册所有组件
// ============================================================================

export function registerAllComponents(): void {
  // 布局组件
  ComponentRegistry.register('Container', Container, {
    name: 'Container',
    description: '容器组件，用于包裹其他组件',
    category: 'layout',
    hasChildren: true,
  });

  ComponentRegistry.register('Row', Row, {
    name: 'Row',
    description: '行组件，用于水平布局',
    category: 'layout',
    hasChildren: true,
  });

  ComponentRegistry.register('Col', Col, {
    name: 'Col',
    description: '列组件，用于栅格布局',
    category: 'layout',
    hasChildren: true,
  });

  ComponentRegistry.register('Tabs', Tabs, {
    name: 'Tabs',
    description: '标签页组件，用于切换显示内容',
    category: 'layout',
    hasChildren: true,
  });

  ComponentRegistry.register('Collapse', Collapse, {
    name: 'Collapse',
    description: '折叠面板组件，用于可折叠的内容区域',
    category: 'layout',
    hasChildren: true,
  });

  // 代码组件
  ComponentRegistry.register('CodeEditor', CodeEditor, {
    name: 'CodeEditor',
    description: '代码编辑器，支持语法高亮和编辑',
    category: 'code',
    hasChildren: false,
  });

  ComponentRegistry.register('Terminal', Terminal, {
    name: 'Terminal',
    description: '终端输出，支持 ANSI 颜色和自动滚动',
    category: 'code',
    hasChildren: false,
  });

  ComponentRegistry.register('CodeDiff', CodeDiff, {
    name: 'CodeDiff',
    description: '代码对比视图，支持并排和内联模式',
    category: 'code',
    hasChildren: false,
  });

  ComponentRegistry.register('SQLEditor', SQLEditor, {
    name: 'SQLEditor',
    description: 'SQL 编辑器，支持语法高亮和执行查询',
    category: 'code',
    hasChildren: false,
  });

  // 文件组件
  ComponentRegistry.register('FileViewer', FileViewer, {
    name: 'FileViewer',
    description: '文件查看器，通过 filePath 加载文件内容',
    category: 'file',
    hasChildren: false,
  });

  ComponentRegistry.register('FileBrowser', FileBrowser, {
    name: 'FileBrowser',
    description: '文件浏览器，显示目录结构',
    category: 'file',
    hasChildren: false,
  });

  // Office 文档预览组件
  ComponentRegistry.register('WordPreview', WordPreview, {
    name: 'WordPreview',
    description: 'Word 文档预览',
    category: 'file',
    hasChildren: false,
  });

  ComponentRegistry.register('ExcelPreview', ExcelPreview, {
    name: 'ExcelPreview',
    description: 'Excel 表格预览',
    category: 'file',
    hasChildren: false,
  });

  ComponentRegistry.register('PPTPreview', PPTPreview, {
    name: 'PPTPreview',
    description: 'PowerPoint 演示预览',
    category: 'file',
    hasChildren: false,
  });

  // 预览组件
  ComponentRegistry.register('MarkdownView', MarkdownView, {
    name: 'MarkdownView',
    description: 'Markdown 渲染，支持 GFM 和代码高亮',
    category: 'preview',
    hasChildren: false,
  });

  ComponentRegistry.register('ImagePreview', ImagePreview, {
    name: 'ImagePreview',
    description: '图片预览，支持缩放和全屏',
    category: 'preview',
    hasChildren: false,
  });

  ComponentRegistry.register('PdfPreview', PdfPreview, {
    name: 'PdfPreview',
    description: 'PDF 文档预览',
    category: 'preview',
    hasChildren: false,
  });

  ComponentRegistry.register('VideoPreview', VideoPreview, {
    name: 'VideoPreview',
    description: '视频预览播放器',
    category: 'preview',
    hasChildren: false,
  });

  ComponentRegistry.register('AudioPreview', AudioPreview, {
    name: 'AudioPreview',
    description: '音频预览播放器',
    category: 'preview',
    hasChildren: false,
  });

  // 数据展示组件
  ComponentRegistry.register('Statistic', Statistic, {
    name: 'Statistic',
    description: '统计卡片，展示数值和趋势',
    category: 'data',
    hasChildren: false,
  });

  ComponentRegistry.register('DataTable', DataTable, {
    name: 'DataTable',
    description: '数据表格，支持排序、分页和导出',
    category: 'data',
    hasChildren: false,
  });

  ComponentRegistry.register('Card', Card, {
    name: 'Card',
    description: '卡片组件，支持封面和操作按钮',
    category: 'data',
    hasChildren: true,
  });

  ComponentRegistry.register('Timeline', Timeline, {
    name: 'Timeline',
    description: '时间线组件，展示事件序列和任务进度',
    category: 'data',
    hasChildren: false,
  });

  ComponentRegistry.register('List', List, {
    name: 'List',
    description: '列表组件，展示条目和状态',
    category: 'data',
    hasChildren: false,
  });

  ComponentRegistry.register('Citation', Citation, {
    name: 'Citation',
    description: '引用组件，展示参考文献和来源',
    category: 'data',
    hasChildren: false,
  });

  // 表单组件
  ComponentRegistry.register('Form', Form, {
    name: 'Form',
    description: '表单组件，支持多种字段类型和验证',
    category: 'form',
    hasChildren: false,
  });

  ComponentRegistry.register('Button', Button, {
    name: 'Button',
    description: '按钮组件，支持多种样式和动作',
    category: 'form',
    hasChildren: false,
  });

  ComponentRegistry.register('Input', Input, {
    name: 'Input',
    description: '输入框组件，支持多种类型',
    category: 'form',
    hasChildren: false,
  });

  ComponentRegistry.register('Select', Select, {
    name: 'Select',
    description: '选择器组件，支持单选和多选',
    category: 'form',
    hasChildren: false,
  });

  ComponentRegistry.register('DatePicker', DatePicker, {
    name: 'DatePicker',
    description: '日期选择器组件',
    category: 'form',
    hasChildren: false,
  });

  // 图表组件
  ComponentRegistry.register('BarChart', BarChart, {
    name: 'BarChart',
    description: '柱状图，支持堆叠和水平显示',
    category: 'chart',
    hasChildren: false,
  });

  ComponentRegistry.register('LineChart', LineChart, {
    name: 'LineChart',
    description: '折线图，支持平滑曲线和面积填充',
    category: 'chart',
    hasChildren: false,
  });

  ComponentRegistry.register('PieChart', PieChart, {
    name: 'PieChart',
    description: '饼图，支持环形图样式',
    category: 'chart',
    hasChildren: false,
  });

  ComponentRegistry.register('AreaChart', AreaChart, {
    name: 'AreaChart',
    description: '面积图，支持堆叠和渐变填充',
    category: 'chart',
    hasChildren: false,
  });

  ComponentRegistry.register('ScatterChart', ScatterChart, {
    name: 'ScatterChart',
    description: '散点图，展示数据分布和相关性',
    category: 'chart',
    hasChildren: false,
  });

  ComponentRegistry.register('Gantt', Gantt, {
    name: 'Gantt',
    description: '甘特图，展示项目任务时间线',
    category: 'chart',
    hasChildren: false,
  });

  // 其他组件
  ComponentRegistry.register('Alert', Alert, {
    name: 'Alert',
    description: '警告提示，显示重要信息',
    category: 'other',
    hasChildren: false,
  });

  ComponentRegistry.register('Progress', Progress, {
    name: 'Progress',
    description: '进度条，显示任务完成进度',
    category: 'other',
    hasChildren: false,
  });

  console.log(
    '[Workbench] 已注册组件:',
    ComponentRegistry.getRegisteredTypes()
  );
}

// 自动注册
registerAllComponents();
