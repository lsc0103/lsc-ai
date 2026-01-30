/**
 * LSC-AI Workbench 演示/测试工具
 *
 * 用于测试 Workbench 框架功能
 * 可通过浏览器控制台调用
 */

import { useWorkbenchStore } from './context';
import type { WorkbenchSchema } from './schema/types';

// ============================================================================
// 示例 Schema
// ============================================================================

/**
 * 数据分析仪表盘示例
 */
export const demoDataAnalysisSchema: WorkbenchSchema = {
  type: 'workbench',
  title: '数据分析报告',
  workbenchId: 'demo-data-analysis',
  defaultActiveKey: 'overview',
  tabs: [
    {
      key: 'overview',
      title: '概览',
      icon: 'dashboard',
      components: [
        {
          type: 'Container',
          id: 'overview-container',
          padding: 16,
          children: [
            {
              type: 'Row',
              id: 'stats-row',
              gutter: 16,
              children: [
                {
                  type: 'Col',
                  id: 'col-1',
                  span: 6,
                  children: [
                    {
                      type: 'Statistic',
                      id: 'stat-1',
                      title: '总用户数',
                      value: 12849,
                      suffix: '人',
                      trend: {
                        direction: 'up',
                        value: '+12.5%',
                      },
                    },
                  ],
                },
                {
                  type: 'Col',
                  id: 'col-2',
                  span: 6,
                  children: [
                    {
                      type: 'Statistic',
                      id: 'stat-2',
                      title: '活跃用户',
                      value: 3842,
                      suffix: '人',
                      trend: {
                        direction: 'up',
                        value: '+8.3%',
                      },
                    },
                  ],
                },
                {
                  type: 'Col',
                  id: 'col-3',
                  span: 6,
                  children: [
                    {
                      type: 'Statistic',
                      id: 'stat-3',
                      title: '转化率',
                      value: 29.8,
                      suffix: '%',
                      trend: {
                        direction: 'down',
                        value: '-2.1%',
                      },
                    },
                  ],
                },
                {
                  type: 'Col',
                  id: 'col-4',
                  span: 6,
                  children: [
                    {
                      type: 'Statistic',
                      id: 'stat-4',
                      title: '平均停留',
                      value: 4.5,
                      suffix: '分钟',
                      trend: {
                        direction: 'up',
                        value: '+15.2%',
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'Alert',
              id: 'alert-1',
              alertType: 'info',
              message: '数据分析提示',
              description:
                '本周用户增长表现良好，活跃度持续上升。建议继续关注转化率指标的优化。',
              showIcon: true,
            },
          ],
        },
      ],
    },
    {
      key: 'details',
      title: '用户列表',
      icon: 'table',
      components: [
        {
          type: 'DataTable',
          id: 'user-table',
          columns: [
            { key: 'name', title: '姓名', dataIndex: 'name', width: 120 },
            { key: 'email', title: '邮箱', dataIndex: 'email', width: 200 },
            { key: 'status', title: '状态', dataIndex: 'status', width: 100, render: 'status' },
            { key: 'lastLogin', title: '最近登录', dataIndex: 'lastLogin', width: 160, render: 'date' },
            { key: 'visits', title: '访问次数', dataIndex: 'visits', width: 100, render: 'number', sortable: true },
          ],
          data: [
            { id: 1, name: '张三', email: 'zhangsan@example.com', status: 'active', lastLogin: '2026-01-22T10:30:00', visits: 156 },
            { id: 2, name: '李四', email: 'lisi@example.com', status: 'active', lastLogin: '2026-01-21T15:45:00', visits: 89 },
            { id: 3, name: '王五', email: 'wangwu@example.com', status: 'inactive', lastLogin: '2026-01-15T08:20:00', visits: 42 },
            { id: 4, name: '赵六', email: 'zhaoliu@example.com', status: 'pending', lastLogin: '2026-01-20T12:00:00', visits: 7 },
            { id: 5, name: '钱七', email: 'qianqi@example.com', status: 'active', lastLogin: '2026-01-22T09:15:00', visits: 234 },
          ],
          rowKey: 'id',
          pagination: { pageSize: 10 },
          exportable: true,
          size: 'small',
        },
      ],
    },
    {
      key: 'report',
      title: '报告',
      icon: 'file-markdown',
      components: [
        {
          type: 'MarkdownView',
          id: 'report-markdown',
          content: `# 数据分析周报

## 概述

本周用户数据表现良好，整体呈上升趋势。

### 关键指标

| 指标 | 本周 | 上周 | 变化 |
|------|------|------|------|
| 总用户数 | 12,849 | 11,423 | +12.5% |
| 活跃用户 | 3,842 | 3,548 | +8.3% |
| 转化率 | 29.8% | 30.4% | -2.1% |

### 趋势分析

1. **用户增长**: 新用户注册量持续增加，主要来源于:
   - 搜索引擎 (45%)
   - 社交媒体 (32%)
   - 直接访问 (23%)

2. **活跃度提升**: 日活用户数创新高

### 代码示例

\`\`\`typescript
// 获取用户统计数据
const stats = await api.getUserStats();
console.log(stats);
\`\`\`

> **注意**: 转化率略有下降，建议优化注册流程。

---

*报告生成时间: 2026-01-23*`,
        },
      ],
    },
  ],
};

/**
 * 代码编辑示例
 */
export const demoCodeEditorSchema: WorkbenchSchema = {
  type: 'workbench',
  title: '代码编辑器',
  workbenchId: 'demo-code-editor',
  defaultActiveKey: 'code',
  tabs: [
    {
      key: 'code',
      title: 'main.ts',
      icon: 'code',
      components: [
        {
          type: 'CodeEditor',
          id: 'code-editor-1',
          code: `/**
 * LSC-AI Workbench 示例代码
 *
 * 这是一个使用 Monaco Editor 的代码编辑器组件
 */

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users');
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

// 使用示例
const users = await fetchUsers();
console.log(\`Found \${users.length} users\`);

users.forEach(user => {
  console.log(\`- \${user.name} (\${user.email})\`);
});`,
          language: 'typescript',
          readOnly: false,
          lineNumbers: true,
          height: 450,
          filePath: 'src/services/user.ts',
        },
      ],
    },
    {
      key: 'preview',
      title: '预览',
      icon: 'eye',
      components: [
        {
          type: 'Alert',
          id: 'preview-info',
          alertType: 'info',
          message: '代码预览',
          description: '此标签页将展示代码运行结果或预览效果。',
          showIcon: true,
        },
      ],
    },
  ],
};

/**
 * 简单测试 Schema
 */
export const demoSimpleSchema: WorkbenchSchema = {
  type: 'workbench',
  title: '测试工作台',
  workbenchId: 'demo-simple',
  tabs: [
    {
      key: 'test',
      title: '测试',
      icon: 'experiment',
      components: [
        {
          type: 'Container',
          id: 'test-container',
          padding: 24,
          children: [
            {
              type: 'Alert',
              id: 'test-alert',
              alertType: 'success',
              message: 'Workbench 框架测试成功！',
              description:
                '恭喜！Schema 驱动渲染、组件注册表、状态管理等核心功能均正常工作。',
              showIcon: true,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * 交互式组件示例（测试 chat action）
 */
export const demoInteractiveSchema: WorkbenchSchema = {
  type: 'workbench',
  title: '交互式组件测试',
  workbenchId: 'demo-interactive',
  defaultActiveKey: 'actions',
  tabs: [
    {
      key: 'actions',
      title: '动作测试',
      icon: 'thunderbolt',
      components: [
        {
          type: 'Container',
          id: 'actions-container',
          padding: 24,
          children: [
            {
              type: 'Alert',
              id: 'actions-info',
              alertType: 'info',
              message: '交互式组件测试',
              description: '点击下方按钮测试 Workbench 与聊天界面的集成。',
              showIcon: true,
            },
            {
              type: 'Row',
              id: 'button-row',
              gutter: 16,
              style: { marginTop: 24 },
              children: [
                {
                  type: 'Col',
                  id: 'col-btn-1',
                  span: 8,
                  children: [
                    {
                      type: 'Button',
                      id: 'btn-chat-1',
                      text: '请帮我分析这些数据',
                      variant: 'primary',
                      icon: 'MessageOutlined',
                      action: {
                        type: 'chat',
                        message: '请帮我分析一下用户数据的增长趋势',
                      },
                    },
                  ],
                },
                {
                  type: 'Col',
                  id: 'col-btn-2',
                  span: 8,
                  children: [
                    {
                      type: 'Button',
                      id: 'btn-chat-2',
                      text: '生成周报',
                      variant: 'default',
                      icon: 'FileTextOutlined',
                      action: {
                        type: 'chat',
                        message: '请根据当前数据生成一份周报',
                      },
                    },
                  ],
                },
                {
                  type: 'Col',
                  id: 'col-btn-3',
                  span: 8,
                  children: [
                    {
                      type: 'Button',
                      id: 'btn-chat-3',
                      text: '导出 CSV',
                      variant: 'dashed',
                      icon: 'DownloadOutlined',
                      action: {
                        type: 'export',
                        format: 'csv',
                        filename: 'data-export.csv',
                        data: 'id,name,value\n1,Item A,100\n2,Item B,200',
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'Progress',
              id: 'progress-1',
              percent: 68,
              progressType: 'line',
              status: 'active',
              style: { marginTop: 24 },
            },
            {
              type: 'Card',
              id: 'card-1',
              title: '快捷操作卡片',
              extra: '更多',
              style: { marginTop: 24 },
              actions: [
                {
                  label: '查看详情',
                  icon: 'EyeOutlined',
                  action: {
                    type: 'chat',
                    message: '请展示详细信息',
                  },
                },
                {
                  label: '编辑',
                  icon: 'EditOutlined',
                  action: {
                    type: 'chat',
                    message: '我想编辑这个内容',
                  },
                },
              ],
              children: [
                {
                  type: 'Statistic',
                  id: 'card-stat',
                  title: '当前进度',
                  value: 68,
                  suffix: '%',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'preview',
      title: '图片预览',
      icon: 'picture',
      components: [
        {
          type: 'Container',
          id: 'preview-container',
          padding: 24,
          children: [
            {
              type: 'ImagePreview',
              id: 'image-1',
              src: 'https://picsum.photos/800/400',
              alt: '示例图片 - 随机风景',
              width: '100%',
              height: 300,
              zoomable: true,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * 图表示例
 */
export const demoChartSchema: WorkbenchSchema = {
  type: 'workbench',
  title: '数据可视化',
  workbenchId: 'demo-chart',
  defaultActiveKey: 'bar',
  tabs: [
    {
      key: 'bar',
      title: '柱状图',
      icon: 'bar-chart',
      components: [
        {
          type: 'Container',
          id: 'bar-container',
          padding: 16,
          children: [
            {
              type: 'BarChart',
              id: 'bar-chart-1',
              title: '月度销售额对比',
              xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
              series: [
                {
                  name: '2025年',
                  data: [320, 402, 301, 434, 490, 530],
                },
                {
                  name: '2026年',
                  data: [420, 532, 401, 554, 620, 680],
                },
              ],
              legend: true,
              tooltip: true,
              height: 350,
            },
            {
              type: 'BarChart',
              id: 'bar-chart-2',
              title: '部门业绩（堆叠）',
              xAxis: ['销售部', '技术部', '市场部', '运营部'],
              series: [
                { name: 'Q1', data: [120, 200, 150, 80] },
                { name: 'Q2', data: [150, 180, 170, 90] },
                { name: 'Q3', data: [180, 210, 160, 100] },
                { name: 'Q4', data: [200, 230, 180, 120] },
              ],
              stack: true,
              height: 300,
              style: { marginTop: 16 },
            },
          ],
        },
      ],
    },
    {
      key: 'line',
      title: '折线图',
      icon: 'line-chart',
      components: [
        {
          type: 'Container',
          id: 'line-container',
          padding: 16,
          children: [
            {
              type: 'LineChart',
              id: 'line-chart-1',
              title: '用户增长趋势',
              xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
              series: [
                {
                  name: '新用户',
                  data: [150, 230, 224, 218, 135, 147, 260],
                  smooth: true,
                },
                {
                  name: '活跃用户',
                  data: [320, 432, 401, 534, 390, 330, 520],
                  smooth: true,
                },
              ],
              legend: true,
              tooltip: true,
              height: 350,
            },
            {
              type: 'LineChart',
              id: 'line-chart-2',
              title: '流量分析（面积图）',
              xAxis: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
              series: [
                {
                  name: 'PV',
                  data: [820, 932, 1901, 2934, 2290, 1830, 920],
                },
                {
                  name: 'UV',
                  data: [320, 432, 901, 1234, 990, 530, 320],
                },
              ],
              area: true,
              height: 300,
              style: { marginTop: 16 },
            },
          ],
        },
      ],
    },
    {
      key: 'pie',
      title: '饼图',
      icon: 'pie-chart',
      components: [
        {
          type: 'Container',
          id: 'pie-container',
          padding: 16,
          children: [
            {
              type: 'Row',
              id: 'pie-row',
              gutter: 16,
              children: [
                {
                  type: 'Col',
                  id: 'pie-col-1',
                  span: 12,
                  children: [
                    {
                      type: 'PieChart',
                      id: 'pie-chart-1',
                      title: '访问来源',
                      data: [
                        { name: '直接访问', value: 335 },
                        { name: '搜索引擎', value: 679 },
                        { name: '邮件营销', value: 148 },
                        { name: '联盟广告', value: 234 },
                        { name: '视频广告', value: 154 },
                      ],
                      height: 320,
                    },
                  ],
                },
                {
                  type: 'Col',
                  id: 'pie-col-2',
                  span: 12,
                  children: [
                    {
                      type: 'PieChart',
                      id: 'pie-chart-2',
                      title: '设备分布（环形图）',
                      data: [
                        { name: 'iOS', value: 40, color: '#60A5FA' },
                        { name: 'Android', value: 35, color: '#34D399' },
                        { name: 'Windows', value: 15, color: '#FBBF24' },
                        { name: 'Mac', value: 10, color: '#F472B6' },
                      ],
                      donut: true,
                      innerRadius: 55,
                      height: 320,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * 文件浏览器示例
 */
export const demoFileBrowserSchema: WorkbenchSchema = {
  type: 'workbench',
  title: '文件浏览器',
  workbenchId: 'demo-file-browser',
  defaultActiveKey: 'browser',
  tabs: [
    {
      key: 'browser',
      title: '文件浏览',
      icon: 'folder',
      components: [
        {
          type: 'FileBrowser',
          id: 'file-browser-1',
          rootPath: 'D:/u3d-projects/lscmade7/lsc-ai-platform',
          patterns: ['*.ts', '*.tsx', '*.json', '*.md'],
          showSize: true,
          height: 500,
        },
      ],
    },
    {
      key: 'viewer',
      title: '文件查看',
      icon: 'file',
      components: [
        {
          type: 'FileViewer',
          id: 'file-viewer-1',
          filePath: 'D:/u3d-projects/lscmade7/lsc-ai-platform/package.json',
          height: 500,
        },
      ],
    },
  ],
};

/**
 * Office 文档预览示例
 */
export const demoOfficeSchema: WorkbenchSchema = {
  type: 'workbench',
  title: 'Office 文档预览',
  workbenchId: 'demo-office',
  defaultActiveKey: 'word',
  tabs: [
    {
      key: 'word',
      title: 'Word 文档',
      icon: 'file-word',
      components: [
        {
          type: 'WordPreview',
          id: 'word-preview-1',
          // 使用 URL 模式（Office Online Viewer）
          url: 'https://view.officeapps.live.com/op/view.aspx?src=https%3A%2F%2Ffile-examples.com%2Fstorage%2Ffe8c7eef0c6364f6c9504cc%2F2017%2F02%2Ffile-sample_100kB.doc',
          title: '示例 Word 文档',
          height: 500,
        },
      ],
    },
    {
      key: 'excel',
      title: 'Excel 表格',
      icon: 'file-excel',
      components: [
        {
          type: 'ExcelPreview',
          id: 'excel-preview-1',
          // 本地文件模式
          filePath: 'D:/example.xlsx',
          title: '示例 Excel 文件',
          height: 500,
        },
      ],
    },
    {
      key: 'ppt',
      title: 'PPT 演示',
      icon: 'file-ppt',
      components: [
        {
          type: 'PPTPreview',
          id: 'ppt-preview-1',
          filePath: 'D:/example.pptx',
          title: '示例 PPT 文件',
          height: 500,
        },
      ],
    },
  ],
};

// ============================================================================
// 测试函数
// ============================================================================

/**
 * 打开演示 Workbench
 */
export function openDemoWorkbench(
  demoType: 'simple' | 'data-analysis' | 'code-editor' | 'interactive' | 'chart' | 'file-browser' | 'office' = 'simple'
): void {
  const store = useWorkbenchStore.getState();

  let schema: WorkbenchSchema;
  switch (demoType) {
    case 'data-analysis':
      schema = demoDataAnalysisSchema;
      break;
    case 'code-editor':
      schema = demoCodeEditorSchema;
      break;
    case 'interactive':
      schema = demoInteractiveSchema;
      break;
    case 'chart':
      schema = demoChartSchema;
      break;
    case 'file-browser':
      schema = demoFileBrowserSchema;
      break;
    case 'office':
      schema = demoOfficeSchema;
      break;
    case 'simple':
    default:
      schema = demoSimpleSchema;
      break;
  }

  store.open(schema);
  console.log(`[Workbench Demo] 已打开: ${demoType}`);
}

/**
 * 关闭 Workbench
 */
export function closeDemoWorkbench(): void {
  const store = useWorkbenchStore.getState();
  store.close();
  console.log('[Workbench Demo] 已关闭');
}

/**
 * 切换 Workbench 可见性
 */
export function toggleDemoWorkbench(): void {
  const store = useWorkbenchStore.getState();
  store.toggle();
  console.log('[Workbench Demo] 切换可见性');
}

// ============================================================================
// 全局暴露（用于浏览器控制台测试）
// ============================================================================

// 在开发环境暴露到 window 对象
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).__WORKBENCH_DEMO__ = {
    open: openDemoWorkbench,
    close: closeDemoWorkbench,
    toggle: toggleDemoWorkbench,
    schemas: {
      simple: demoSimpleSchema,
      dataAnalysis: demoDataAnalysisSchema,
      codeEditor: demoCodeEditorSchema,
      interactive: demoInteractiveSchema,
      chart: demoChartSchema,
      fileBrowser: demoFileBrowserSchema,
      office: demoOfficeSchema,
    },
    store: useWorkbenchStore,
  };

  console.log(
    '%c[Workbench Demo]%c 调试工具已加载\n' +
      '  __WORKBENCH_DEMO__.open("simple")  - 打开简单测试\n' +
      '  __WORKBENCH_DEMO__.open("data-analysis")  - 打开数据分析示例\n' +
      '  __WORKBENCH_DEMO__.open("interactive")  - 打开交互式测试\n' +
      '  __WORKBENCH_DEMO__.open("chart")  - 打开图表示例\n' +
      '  __WORKBENCH_DEMO__.open("file-browser")  - 打开文件浏览器\n' +
      '  __WORKBENCH_DEMO__.open("office")  - 打开 Office 文档预览\n' +
      '  __WORKBENCH_DEMO__.close()  - 关闭 Workbench\n' +
      '  __WORKBENCH_DEMO__.toggle()  - 切换可见性',
    'color: #0071e3; font-weight: bold;',
    'color: inherit;'
  );
}
