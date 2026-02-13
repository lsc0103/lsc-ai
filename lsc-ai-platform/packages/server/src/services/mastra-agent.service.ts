/**
 * Mastra Agent Service
 *
 * 策略：
 * 1. 使用 Mastra 框架核心能力（Agent、Memory、AgentNetwork）
 * 2. 注册专业化 Agent（代码专家、数据分析师、办公助手）
 * 3. 通过 Mastra 实例注册 AgentNetwork 实现多 Agent 协作
 * 4. 集成高级功能（上下文压缩、项目感知）作为辅助函数
 */

import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import { createLogger } from '@mastra/core/logger';
import { ModelFactory } from '../mastra/model-factory.js';
import { EmbeddingFactory } from '../mastra/embedding-factory.js';

// 导入所有工具
import { coreTools } from '../tools/core-tools.js';
import { officeTools } from '../tools/office-tools.js';
import { advancedTools, setConnectorService } from '../tools/advanced-tools.js';
import { ragTools } from '../tools/rag-tools.js';
import { idpTools, setIdpService } from '../tools/idp-tools.js';
import {
  processPaintingListTool, setPaintingListIdpService,
  processInspectionReportTool, setInspectionReportIdpService,
  reviewContractTool, setContractReviewIdpService,
} from '../tools/idp-scenarios/index.js';
import {
  workbenchTool,
  showCodeTool,
  showTableTool,
  showChartTool,
} from '../tools/workbench/index.js';

// 导入高级功能（作为辅助函数）
import type { detectProjectContext } from '../utils/projectContext.js';
import { ConnectorService } from '../modules/connector/connector.service.js';
import { IdpService } from '../modules/idp/idp.service.js';

@Injectable()
export class MastraAgentService implements OnModuleInit {
  private readonly logger = new Logger(MastraAgentService.name);

  private storage!: LibSQLStore;
  private vector!: LibSQLVector;
  private memory!: Memory;
  private mastra!: Mastra;
  private platformAgent!: Agent;
  private codeExpertAgent!: Agent;
  private dataAnalystAgent!: Agent;
  private officeWorkerAgent!: Agent;

  // 项目感知函数（延迟加载）
  private detectProjectContextFn?: typeof detectProjectContext;

  constructor(
    private configService: ConfigService,
    @Optional() private connectorService?: ConnectorService,
    @Optional() private idpService?: IdpService,
  ) {}

  async onModuleInit() {
    // Inject ConnectorService into the queryDatabase tool
    if (this.connectorService) {
      setConnectorService(this.connectorService);
      this.logger.log('ConnectorService 已注入到 queryDatabase 工具');
    }
    if (this.idpService) {
      setIdpService(this.idpService);
      setPaintingListIdpService(this.idpService);
      setInspectionReportIdpService(this.idpService);
      setContractReviewIdpService(this.idpService);
      this.logger.log('IdpService 已注入到 IDP 工具');
    }
    await this.initialize();
  }

  /**
   * 初始化服务
   */
  private async initialize() {
    this.logger.log('初始化 Mastra Agent 服务...');
    this.logger.log(`LLM 配置: ${ModelFactory.getConfigInfo()}`);
    this.logger.log(`Embedding 配置: ${EmbeddingFactory.getConfigInfo()}`);

    // 1. 初始化存储
    const libsqlUrl =
      this.configService.get<string>('LIBSQL_URL') ||
      'file:./data/lsc-ai.db';
    this.storage = new LibSQLStore({
      id: 'lsc-ai-storage',
      url: libsqlUrl,
    });
    this.logger.log(`LibSQL 存储已初始化: ${libsqlUrl}`);

    // 1.5 初始化向量存储（用于语义搜索）
    this.vector = new LibSQLVector({
      id: 'lsc-ai-vector',
      url: libsqlUrl,
    });
    this.logger.log('LibSQLVector 向量存储已初始化');

    // 2. 初始化 Memory（启用 Working Memory + Semantic Recall）
    this.memory = new Memory({
      storage: this.storage,
      vector: this.vector,
      embedder: fastembed,
      options: {
        lastMessages: 50,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
          scope: 'resource',
        },
        workingMemory: {
          enabled: true,
          template: `
## 用户偏好
- 语言: 中文
- 代码风格: {codeStyle}
- 常用技术栈: {techStack}

## 当前项目
- 项目名称: {projectName}
- 项目路径: {projectPath}
- 项目类型: {projectType}

## 近期任务上下文
- 当前任务: {currentTask}
- 重要记忆: {importantNotes}
`,
        },
      },
    });
    this.logger.log('Memory 系统已初始化（Semantic Recall + Working Memory）');

    // 3. 创建专业化 Agent
    this.createSpecializedAgents();

    // 4. 创建 Platform Agent（路由 Agent，拥有所有工具）
    this.platformAgent = new Agent({
      id: 'platform-agent',
      name: 'platform-agent',
      instructions: this.getPlatformInstructions(),
      model: ModelFactory.createFromEnv(),
      memory: this.memory,
      tools: {
        workbench: workbenchTool,
        showCode: showCodeTool,
        showTable: showTableTool,
        showChart: showChartTool,
        ...coreTools,
        ...officeTools,
        ...advancedTools,
        ...ragTools,
        ...idpTools,
        processPaintingList: processPaintingListTool,
        processInspectionReport: processInspectionReportTool,
        reviewContract: reviewContractTool,
      },
    });

    this.logger.log('Platform Agent 已创建');

    // 5. 创建 Mastra 实例（注册所有 Agent，启用 AgentNetwork + Logger）
    const mastraLogger = createLogger({
      name: 'lsc-ai-mastra',
      level: 'info',
    });

    this.mastra = new Mastra({
      agents: {
        'platform-agent': this.platformAgent,
        'code-expert': this.codeExpertAgent,
        'data-analyst': this.dataAnalystAgent,
        'office-worker': this.officeWorkerAgent,
      },
      logger: mastraLogger,
    });

    // 将 Mastra 实例注入到所有 Agent（使 AgentNetwork 能够发现其他 Agent）
    this.platformAgent.__registerMastra(this.mastra);
    this.codeExpertAgent.__registerMastra(this.mastra);
    this.dataAnalystAgent.__registerMastra(this.mastra);
    this.officeWorkerAgent.__registerMastra(this.mastra);

    this.logger.log('Mastra 实例已创建，AgentNetwork 已启用（4 个 Agent）');

    // 6. 延迟加载高级功能
    this.loadAdvancedFeatures();

    this.logger.log('Mastra Agent 服务初始化完成 ✓');
  }

  /**
   * 创建专业化 Agent
   */
  private createSpecializedAgents() {
    // 代码专家 Agent
    this.codeExpertAgent = new Agent({
      id: 'code-expert',
      name: 'code-expert',
      instructions: `你是一个代码专家，擅长编程、代码分析、调试和开发任务。

## 核心能力
- 文件读写和编辑（read, write, edit）
- 代码搜索（glob, grep）
- Shell 命令执行（bash）
- Git 操作（git_status, git_diff）
- 代码展示（showCode）

## 工作原则
1. 先理解需求，再编写代码
2. 使用 showCode 在 Workbench 中展示代码
3. 修改文件前先读取确认
4. 遵循项目现有代码风格
5. 展示代码时可添加 actions 按钮（如 "AI解释代码"、"应用修复"）

### showCode actions 示例
\`\`\`json
{
  "code": "...",
  "language": "typescript",
  "actions": [
    { "label": "AI 解释", "action": { "type": "chat", "message": "请解释这段代码" } },
    { "label": "应用修复", "action": { "type": "shell", "command": "..." } }
  ]
}
\`\`\`

请用中文回复。`,
      model: ModelFactory.createFromEnv(),
      memory: this.memory,
      tools: {
        showCode: showCodeTool,
        ...coreTools,
      },
    });

    // 数据分析师 Agent
    this.dataAnalystAgent = new Agent({
      id: 'data-analyst',
      name: 'data-analyst',
      instructions: `你是一个数据分析专家，擅长数据处理、可视化和分析报告。

## 核心能力
- 数据表格展示（showTable）— 支持 actions 操作按钮
- 图表可视化（showChart，支持 ECharts）— 支持 actions 操作按钮
- SQL 查询（sql）
- 文件读取分析（read）
- 完整 Workbench 展示（workbench）— 支持完整交互式界面
- 网页数据获取（webSearch, webFetch）

## 工作原则
1. 优先使用图表和表格可视化数据
2. 使用 Workbench 组织多维度分析
3. 提供清晰的数据洞察和结论
4. 图表选择要匹配数据特征（趋势用折线图、对比用柱状图、占比用饼图）
5. 展示数据时添加 actions 按钮（如"导出 Excel"、"深入分析"、"生成报告"）

### showTable actions 示例
调用 showTable 时可添加 actions 参数：
\`\`\`json
{
  "headers": ["产品", "销量", "增长率"],
  "rows": [["商品A", 1200, "15%"], ["商品B", 800, "-5%"]],
  "title": "产品销售数据",
  "actions": [
    { "label": "导出 Excel", "action": { "type": "export", "format": "excel", "filename": "销售数据.xlsx" } },
    { "label": "深入分析趋势", "action": { "type": "chat", "message": "请深入分析这些产品的销售趋势和异常点" } }
  ]
}
\`\`\`

### showChart actions 示例
调用 showChart 时可添加 actions 参数：
\`\`\`json
{
  "chartType": "bar",
  "title": "月度销售趋势",
  "option": {
    "xAxis": { "type": "category", "data": ["1月", "2月", "3月"] },
    "yAxis": { "type": "value" },
    "series": [{ "name": "销售额", "data": [100, 150, 120], "type": "bar" }]
  },
  "actions": [
    { "label": "生成分析报告", "action": { "type": "chat", "message": "根据这个图表的数据生成详细分析报告" } },
    { "label": "导出图片", "action": { "type": "export", "format": "png", "filename": "月度趋势.png" } }
  ]
}
\`\`\`

请用中文回复。`,
      model: ModelFactory.createFromEnv(),
      memory: this.memory,
      tools: {
        workbench: workbenchTool,
        showTable: showTableTool,
        showChart: showChartTool,
        ...advancedTools,
      },
    });

    // 办公助手 Agent
    this.officeWorkerAgent = new Agent({
      id: 'office-worker',
      name: 'office-worker',
      instructions: `你是一个办公文档专家，擅长创建和处理各种办公文档。

## 核心能力
- 读取 Office 文件（readOffice：Word/Excel/PDF/PPT）
- 创建 Word 文档（createWord）
- 创建 Excel 表格（createExcel）
- 创建 PDF 文档（createPDF）
- 创建 PPT 演示文稿（createPPT）
- 创建图表（createChart）
- Workbench 预览（workbench, showTable）— 支持 actions 交互按钮

## 工作原则
1. 创建文档前确认格式和内容要求
2. 使用 Workbench 预览文档内容
3. 注意文档格式和排版美观
4. 支持批量处理多个文档
5. 展示表格数据时添加 actions 按钮（如"导出 Excel"、"创建文档"）

### showTable actions 示例（办公场景）
\`\`\`json
{
  "headers": ["文件名", "类型", "大小", "修改时间"],
  "rows": [["报告.docx", "Word", "2.3MB", "2026-02-07"]],
  "title": "文件列表",
  "actions": [
    { "label": "导出为 Excel", "action": { "type": "export", "format": "excel", "filename": "文件清单.xlsx" } },
    { "label": "批量处理", "action": { "type": "chat", "message": "请帮我批量处理这些文件" } }
  ]
}
\`\`\`

请用中文回复。`,
      model: ModelFactory.createFromEnv(),
      memory: this.memory,
      tools: {
        workbench: workbenchTool,
        showTable: showTableTool,
        ...officeTools,
        ...idpTools,
      },
    });

    this.logger.log('专业化 Agent 已创建: code-expert, data-analyst, office-worker');
  }

  /**
   * 延迟加载高级功能
   */
  private async loadAdvancedFeatures() {
    try {
      // 加载项目感知
      const projectContext = await import('../utils/projectContext.js');
      this.detectProjectContextFn = projectContext.detectProjectContext;
      this.logger.log('项目感知功能已加载');
    } catch (error) {
      this.logger.warn('高级功能加载失败（可选功能）:', (error as Error).message);
    }
  }

  /**
   * 获取 Platform Agent 指令
   */
  private getPlatformInstructions(): string {
    return `你是 LSC-AI 平台助手，负责帮助用户完成各种任务。

## 核心能力

你拥有以下能力：

### 1. Workbench 可视化（优先使用）
- \`workbench\` - 创建完整的 Workbench Schema
- \`showCode\` - 快速展示代码（带语法高亮）
- \`showTable\` - 快速展示数据表格
- \`showChart\` - 快速展示图表（ECharts）

### 2. 文件操作
- \`read\` - 读取文件（支持文本、图片、PDF）
- \`write\` - 写入文件
- \`edit\` - 编辑文件（精确替换）
- \`mkdir\` - 创建目录
- \`cp\` - 复制文件/目录
- \`mv\` - 移动/重命名
- \`rm\` - 删除文件/目录
- \`ls\` - 列出目录内容

### 3. 开发工具
- \`bash\` - 执行 Shell 命令
- \`glob\` - 文件搜索（模式匹配）
- \`grep\` - 内容搜索（正则表达式）
- \`git_status\` - Git 状态
- \`git_diff\` - Git 差异

### 4. Office 办公
- \`readOffice\` - 读取 Office 文件（Word/Excel/PDF/PPT）
- \`createWord\` - 创建 Word 文档
- \`editWord\` - 编辑 Word 文档
- \`createExcel\` - 创建 Excel 表格
- \`editExcel\` - 编辑 Excel 表格
- \`createPDF\` - 创建 PDF 文档
- \`createPPT\` - 创建 PowerPoint 演示文稿
- \`createChart\` - 创建图表

### 5. Web 和数据
- \`webSearch\` - 网页搜索
- \`webFetch\` - 网页抓取
- \`sql\` - SQL 查询
- \`sqlConfig\` - 配置 SQL 数据源
- \`queryDatabase\` - 查询外部数据库（通过连接名称执行只读SQL，管理员需在设置中配置连接）
- \`notebookEdit\` - Jupyter Notebook 编辑

### 6. 任务管理
- \`todoWrite\` - Todo 任务管理
- \`askUser\` - 询问用户
- \`undo\` - 撤销操作
- \`modificationHistory\` - 查看修改历史

### 7. 知识库检索
- \`searchKnowledge\` - 在知识库中搜索相关内容
  - 当用户询问业务知识、文档内容、规章制度等需要查阅资料的问题时，使用此工具
  - 搜索结果会返回相关文档片段和来源信息
  - 引用知识库内容时请注明出处（文档名称）
  - 可指定 knowledgeBaseId 搜索特定知识库，不传则搜索全部

### 8. 智能文档处理 (IDP)
- \`ocrDocument\` - OCR 文字识别（支持 PDF/图片，中英文）
  - 关键词: "识别"、"OCR"、"扫描"、"文字提取"
- \`extractTable\` - 从文档提取表格数据
  - 关键词: "提取表格"、"表格识别"、"读取表格"
- \`analyzeDocument\` - 全面文档分析（OCR+表格+版面）
  - 关键词: "分析文档"、"文档分析"
- \`compareDocuments\` - 对比两份文档差异
  - 关键词: "对比文档"、"比较文件"
- \`processPaintingList\` - 处理涂装清单（跨页表格合并）
  - 关键词: "涂装清单"、"出入涂"
- \`processInspectionReport\` - 处理检验报告（NDT 分类+字段提取）
  - 关键词: "检验报告"、"NDT"、"无损检测"
- \`reviewContract\` - 合同审查（要素提取+风险评估）
  - 关键词: "审查合同"、"合同审查"、"合同风险"

## 🚨 强制规则

### 关键词触发规则（最高优先级）

当用户消息包含以下关键词时，**必须**调用对应工具，**禁止**用纯文本回复：

| 用户关键词 | 必须调用的工具 | 示例 |
|-----------|---------------|------|
| "表格"、"用表格展示"、"列表展示"、"数据表" | \`showTable\` | "用表格展示员工信息" |
| "图表"、"柱状图"、"折线图"、"饼图"、"chart" | \`showChart\` | "用柱状图展示销售数据" |
| "代码"、"代码展示"、"展示代码"、"写一段代码" | \`showCode\` | "展示一段排序算法代码" |
| "工作台"、"workbench"、"在工作台展示" | \`workbench\` | "在工作台展示分析结果" |
| "识别"、"OCR"、"扫描"、"文字提取" | \`ocrDocument\` | "识别这份文档" |
| "提取表格"、"表格识别" | \`extractTable\` | "从PDF中提取表格" |
| "涂装清单"、"出入涂" | \`processPaintingList\` | "处理这份涂装清单" |
| "检验报告"、"NDT" | \`processInspectionReport\` | "分析这份检验报告" |
| "审查合同"、"合同审查" | \`reviewContract\` | "审查这份合同" |

⚠️ **禁止行为**：
- 禁止用 markdown 表格（\`| col1 | col2 |\`）代替 \`showTable\` 工具
- 禁止用 markdown 代码块（\`\`\`code\`\`\`）代替 \`showCode\` 工具
- 禁止描述图表数据而不调用 \`showChart\` 工具
- 禁止说"我无法展示图表"——你**有能力**调用 showChart 工具

### 规则1：必须使用 Workbench 展示结构化内容

当符合以下**任一条件**时，**必须**使用 Workbench 工具展示，**禁止**用纯文本输出：

1. 用户明确要求"在workbench里展示"、"用workbench显示"、"可视化展示"等
2. 需要展示**多个维度**的信息（如：产品信息+时间表+技术规格）
3. 需要展示**表格数据**（超过2行2列）
4. 需要展示**图表**（柱状图、折线图、饼图等）
5. 需要展示**代码**（超过3行）
6. 需要展示**结构化信息**（如产品发布计划、技术路线图、对比分析）

### 规则2：Workbench 内容组织

使用 Workbench 展示时，必须：
- **使用多个 block** 组织内容（概述用 markdown，数据用 table，趋势用 chart）
- **每个 block 有清晰的 title**
- **优先使用 table 和 chart**，而不是 markdown 文本

### 规则3：回复简洁

调用 Workbench 工具后：
- ✅ 正确："我已在 Workbench 中为你展示了2026年苹果产品路线图（包含4个维度：概述、时间表、销量预测、技术对比）"
- ❌ 错误：不要在文本中重复 Workbench 的内容

## 工具参数格式参考

### showTable 参数示例（基础）
\`\`\`json
{
  "title": "员工信息表",
  "headers": ["姓名", "部门", "薪资"],
  "rows": [
    ["张三", "技术部", 15000],
    ["李四", "市场部", 12000]
  ]
}
\`\`\`

### showTable 参数示例（带操作按钮）
\`\`\`json
{
  "title": "销售数据",
  "headers": ["产品", "销量", "金额"],
  "rows": [["商品A", 100, 5000], ["商品B", 200, 10000]],
  "actions": [
    { "label": "导出 Excel", "action": { "type": "export", "format": "excel", "filename": "销售数据.xlsx" } },
    { "label": "深入分析", "action": { "type": "chat", "message": "请深入分析这些销售数据的趋势和异常" } }
  ]
}
\`\`\`

### showChart 参数示例
\`\`\`json
{
  "title": "季度销售额",
  "chartType": "bar",
  "option": {
    "xAxis": { "type": "category", "data": ["Q1", "Q2", "Q3", "Q4"] },
    "yAxis": { "type": "value" },
    "series": [{ "name": "销售额", "data": [100, 150, 120, 200], "type": "bar" }]
  },
  "actions": [
    { "label": "生成报告", "action": { "type": "chat", "message": "根据这个图表数据生成季度分析报告" } }
  ]
}
\`\`\`

### showCode 参数示例（带操作按钮）
\`\`\`json
{
  "title": "快速排序算法",
  "language": "python",
  "code": "def quicksort(arr):\\n    if len(arr) <= 1:\\n        return arr\\n    pivot = arr[len(arr) // 2]\\n    left = [x for x in arr if x < pivot]\\n    middle = [x for x in arr if x == pivot]\\n    right = [x for x in arr if x > pivot]\\n    return quicksort(left) + middle + quicksort(right)",
  "actions": [
    { "label": "AI 解释代码", "action": { "type": "chat", "message": "请逐行解释这段快速排序代码" } }
  ]
}
\`\`\`

### workbench 新格式参数示例（完整交互式界面）
\`\`\`json
{
  "title": "应用监控",
  "tabs": [{
    "title": "状态总览",
    "components": [
      { "type": "Statistic", "title": "应用状态", "value": "运行中", "status": "success" },
      { "type": "Statistic", "title": "CPU 占用", "value": "23%", "suffix": "%" },
      { "type": "Terminal", "lines": ["[INFO] 应用已启动", "[INFO] 监听端口 8080"] },
      { "type": "Button", "text": "关闭应用", "variant": "default", "danger": true, "action": { "type": "shell", "command": "taskkill /f /im myapp.exe" } },
      { "type": "Button", "text": "重启应用", "variant": "primary", "action": { "type": "shell", "command": "taskkill /f /im myapp.exe && start myapp.exe" } }
    ]
  }]
}
\`\`\`

## Action 类型说明

工具支持可选的 \`actions\` 参数，用于生成交互按钮。7 种 action 类型：

| 类型 | 用途 | 关键参数 |
|------|------|---------|
| \`chat\` | 发消息给 AI 触发新一轮对话 | message: "要发送的消息" |
| \`export\` | 导出文件 | format: "excel"/"csv"/"pdf"/"json", filename |
| \`shell\` | 通过 Client Agent 执行命令 | command: "要执行的命令" |
| \`api\` | 调用后端 API | endpoint, method, params |
| \`navigate\` | 页面跳转 | path: "/目标路径" |
| \`update\` | 更新 Workbench 中的组件数据 | targetId, data |
| \`custom\` | 自定义动作 | handler: "处理器名" |

**使用原则**：
- 当用户可能需要进一步操作时，添加 actions（如"导出""深入分析""执行"等按钮）
- 不确定时可以不传 actions，保持纯展示
- 模板变量 \`\${selectedRows}\` 可引用用户在表格中选中的数据

## 工作流程

1. **可视化优先**：符合规则1的任一条件 → 立即使用 Workbench 工具
2. **交互增强**：展示数据时考虑用户可能的下一步操作，添加对应的 action 按钮
3. **文件操作**：读取文件前先检查路径，写入前确认用户意图
4. **Office 任务**：创建文档时注意格式和样式
5. **数据分析**：读取数据后用 \`showTable\` 或 \`showChart\` 可视化展示，附加导出和分析按钮

## 示例

**正确做法**：
- 用户："展示苹果产品发布信息"
- 你：调用 \`workbench\` 工具创建展示内容
- 你："我已在 Workbench 中为你展示了2026年苹果产品发布路线图，包含产品线、技术趋势、发布时间表和市场预测分析。"

**错误做法**：
- 用户："展示苹果产品发布信息"
- 你：调用 \`workbench\` 工具
- 你："我已创建了 Workbench 展示。以下是详细内容：\n\n# 产品路线图\n\n## 1. iPhone 18系列...[重复所有内容]"

请用中文回复用户，并合理使用工具完成任务。`;
  }

  /**
   * 处理对话（完整响应）
   */
  async chat(params: {
    message: string;
    threadId: string;
    resourceId: string;
    cwd?: string;
  }) {
    try {
      // 检查是否需要上下文压缩
      // （这里可以集成压缩功能，作为辅助处理）

      // 检测项目上下文（如果提供了 cwd）
      if (params.cwd && this.detectProjectContextFn) {
        try {
          const projectContext = await this.detectProjectContextFn(params.cwd);
          this.logger.log(`检测到项目类型: ${projectContext.type}`);
          // 可以将项目上下文添加到消息中
        } catch (error) {
          // 忽略项目检测错误
        }
      }

      // 使用 Mastra Agent 生成响应
      const result = await this.platformAgent.generate(params.message, {
        memory: {
          thread: params.threadId,
          resource: params.resourceId,
        },
      });

      return {
        text: result.text,
        toolCalls: result.toolCalls || [],
      };
    } catch (error) {
      this.logger.error('对话处理失败:', (error as Error).message);
      throw error;
    }
  }

  /**
   * 处理对话（带回调，用于兼容 ChatGateway）
   */
  async chatWithCallbacks(
    sessionId: string,
    userId: string,
    message: string | Array<any>,
    callbacks: {
      onText?: (text: string) => void;
      onToolCall?: (toolCall: any) => void;
      onToolResult?: (toolCall: any, result: any) => void;
      onTokenUsage?: (usage: any) => void;
      onDone?: (fullContent: string) => void;
      onError?: (error: Error) => void;
    },
    _options?: {
      cwd?: string;
      resumeMessages?: Array<{ role: string; content: string }>;
    }
  ): Promise<{ content: string; toolCalls: any[] }> {
    try {
      // 处理消息（支持多模态）
      let finalMessage: string;
      if (Array.isArray(message)) {
        // 提取文本部分（Mastra 当前不支持多模态，需要转换）
        const textParts = message.filter(m => m.type === 'text').map(m => m.text);
        const imageParts = message.filter(m => m.type === 'image_url');

        if (imageParts.length > 0) {
          this.logger.warn(`Mastra 当前不支持图片，已忽略 ${imageParts.length} 个图片`);
        }

        finalMessage = textParts.join('\n');
      } else {
        finalMessage = message;
      }

      // 准备消息列表（支持会话历史恢复）
      let messageList: any;
      if (_options?.resumeMessages && _options.resumeMessages.length > 0) {
        // 如果有历史消息，将它们与当前消息合并
        const historyMessages = _options.resumeMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // 添加当前消息
        messageList = [
          ...historyMessages,
          { role: 'user', content: finalMessage },
        ];

        this.logger.debug(`会话历史恢复: 加载了 ${historyMessages.length} 条历史消息`);
      } else {
        // 没有历史消息，只使用当前消息
        messageList = finalMessage;
      }

      // 使用流式响应并触发回调
      const stream = await this.platformAgent.stream(messageList, {
        memory: {
          thread: sessionId,
          resource: userId,
        },
      });

      let fullContent = '';
      const toolCalls: any[] = [];
      const toolResults: any[] = [];

      try {
        // 遍历完整流（包含工具调用）
        const reader = stream.fullStream.getReader();

        while (true) {
          const { done, value: chunk } = await reader.read();

          if (done) break;

          // 处理不同类型的 chunk
          switch (chunk.type) {
            case 'text-delta':
              // 文本增量
              if (chunk.payload?.text) {
                fullContent += chunk.payload.text;
                callbacks.onText?.(chunk.payload.text);
              }
              break;

            case 'tool-call':
              // 工具调用
              if (chunk.payload) {
                this.logger.log(`[Stream] 收到 tool-call 事件: ${chunk.payload.toolName} (${chunk.payload.toolCallId})`);
                const toolCall = {
                  id: chunk.payload.toolCallId,
                  name: chunk.payload.toolName,
                  arguments: chunk.payload.args || {},
                };
                toolCalls.push(toolCall);
                callbacks.onToolCall?.(toolCall);
                this.logger.log(`[Stream] onToolCall 回调已触发: ${chunk.payload.toolName}`);
              }
              break;

            case 'tool-result':
              // 工具结果
              if (chunk.payload) {
                this.logger.log(`[Stream] 收到 tool-result 事件: ${chunk.payload.toolName} (${chunk.payload.toolCallId})`);
                const toolResult = {
                  id: chunk.payload.toolCallId,
                  name: chunk.payload.toolName,
                  result: chunk.payload.result,
                };
                toolResults.push(toolResult);

                // 查找对应的 toolCall
                const toolCall = toolCalls.find(tc => tc.id === chunk.payload.toolCallId);
                callbacks.onToolResult?.(toolCall, toolResult);
                this.logger.log(`[Stream] onToolResult 回调已触发: ${chunk.payload.toolName}`);
              }
              break;
          }
        }

        // 等待所有 Promise 完成并获取 usage
        const [text, usage] = await Promise.all([
          stream.text,
          stream.usage,
        ]);

        // Token 使用统计回调
        if (usage) {
          const usageData = usage as any; // Mastra's LanguageModelUsage type
          callbacks.onTokenUsage?.({
            promptTokens: usageData.promptTokens || 0,
            completionTokens: usageData.outputTokens || usageData.completionTokens || 0,
            totalTokens: usageData.totalTokens || 0,
          });
        }

        // 如果没有收集到文本，使用 Promise 结果
        if (!fullContent && text) {
          fullContent = text;
        }

        // 完成回调
        callbacks.onDone?.(fullContent);

        return {
          content: fullContent,
          toolCalls,
        };
      } catch (streamError) {
        callbacks.onError?.(streamError as Error);
        throw streamError;
      }
    } catch (error) {
      this.logger.error('对话处理失败:', (error as Error).message);
      callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 处理对话（流式响应）
   */
  async *chatStream(params: {
    message: string;
    threadId: string;
    resourceId: string;
    cwd?: string;
  }): AsyncGenerator<{ type: string; data: any }> {
    try {
      // 使用 Mastra Agent 的流式响应
      const stream = await this.platformAgent.stream(params.message, {
        memory: {
          thread: params.threadId,
          resource: params.resourceId,
        },
      });

      // 遍历流并转换为标准格式
      for await (const chunk of stream.textStream) {
        yield {
          type: 'text-delta',
          data: { content: chunk },
        };
      }

      // 发送完成信号
      yield {
        type: 'finish',
        data: { reason: 'stop' },
      };
    } catch (error) {
      this.logger.error('流式响应失败:', (error as Error).message);
      yield {
        type: 'error',
        data: { message: (error as Error).message },
      };
    }
  }

  /**
   * 使用 AgentNetwork 处理复杂任务（多 Agent 协作）
   *
   * Platform Agent 作为路由 Agent，自动将任务分配给:
   * - code-expert: 代码相关任务
   * - data-analyst: 数据分析和可视化
   * - office-worker: 文档创建和处理
   */
  async networkChat(
    sessionId: string,
    userId: string,
    message: string,
    callbacks: {
      onText?: (text: string) => void;
      onToolCall?: (toolCall: any) => void;
      onToolResult?: (toolCall: any, result: any) => void;
      onDone?: (fullContent: string) => void;
      onError?: (error: Error) => void;
      onIterationComplete?: (context: {
        iteration: number;
        primitiveId: string;
        primitiveType: string;
        result: string;
        isComplete: boolean;
      }) => void;
    },
  ): Promise<{ content: string }> {
    try {
      this.logger.log(`[AgentNetwork] 启动多 Agent 协作: sessionId=${sessionId}`);

      const networkStream = await this.platformAgent.network(message, {
        memory: {
          thread: sessionId,
          resource: userId,
        },
        maxSteps: 15,
        routing: {
          additionalInstructions: `## 路由策略

根据用户需求精确路由到最合适的 Agent。优先使用专业 Agent，只在任务跨领域时使用 platform-agent。

### Agent 能力矩阵

**code-expert** - 代码与开发任务
  触发关键词: 代码、编程、函数、类、接口、重构、debug、编译、构建、Git、npm、pip、文件读写、搜索文件
  工具: read, write, edit, bash, glob, grep, git_status, git_diff, showCode

**data-analyst** - 数据分析与可视化
  触发关键词: 数据、分析、统计、图表、可视化、趋势、对比、SQL、查询、爬取、报表、Dashboard
  工具: showTable, showChart, workbench, sql, webSearch, webFetch

**office-worker** - 办公文档处理
  触发关键词: Word、Excel、PPT、PDF、文档、表格、演示、报告、模板、导出
  工具: readOffice, createWord, createExcel, createPDF, createPPT, createChart

**platform-agent** - 通用/复合任务
  使用场景: 不属于以上领域的通用问答, 或需要多种能力组合的复杂任务
  拥有所有工具

### 路由规则
1. 单一领域任务 → 直接路由到对应专业 Agent
2. 跨领域任务 → 使用 platform-agent 统一处理
3. 模糊任务 → 优先 platform-agent，由其判断是否需要委托`,
        },
      });

      // 读取 network stream
      let fullContent = '';
      const reader = networkStream.getReader();

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        if (chunk && typeof chunk === 'object') {
          const c = chunk as any;
          if (c.type === 'text-delta' && c.payload?.text) {
            fullContent += c.payload.text;
            callbacks.onText?.(c.payload.text);
          } else if (c.type === 'tool-call' && c.payload) {
            callbacks.onToolCall?.({
              id: c.payload.toolCallId,
              name: c.payload.toolName,
              arguments: c.payload.args || {},
            });
          } else if (c.type === 'tool-result' && c.payload) {
            const toolCall = {
              id: c.payload.toolCallId,
              name: c.payload.toolName,
            };
            callbacks.onToolResult?.(toolCall, {
              id: c.payload.toolCallId,
              name: c.payload.toolName,
              result: c.payload.result,
            });
          }
        }
      }

      callbacks.onDone?.(fullContent);

      this.logger.log(`[AgentNetwork] 协作完成: ${fullContent.length} 字符`);
      return { content: fullContent };
    } catch (error) {
      this.logger.error('[AgentNetwork] 协作失败:', (error as Error).message);
      callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 获取 Memory 实例
   */
  getMemory(): Memory {
    return this.memory;
  }

  /**
   * 获取 Storage 实例
   */
  getStorage(): LibSQLStore {
    return this.storage;
  }

  /**
   * 获取 Platform Agent
   */
  getPlatformAgent(): Agent {
    return this.platformAgent;
  }

  /**
   * 获取 Mastra 实例
   */
  getMastra(): Mastra {
    return this.mastra;
  }

  /**
   * 获取指定专业 Agent
   */
  getAgent(name: 'code-expert' | 'data-analyst' | 'office-worker' | 'platform-agent'): Agent {
    switch (name) {
      case 'code-expert': return this.codeExpertAgent;
      case 'data-analyst': return this.dataAnalystAgent;
      case 'office-worker': return this.officeWorkerAgent;
      case 'platform-agent': return this.platformAgent;
    }
  }

  /**
   * 从 Mastra Memory 读取会话历史消息
   * @param threadId 会话 ID（= sessionId）
   * @param resourceId 用户 ID（= userId）
   * @returns 历史消息数组
   */
  async getThreadMessages(threadId: string, resourceId: string) {
    try {
      // 使用 Memory.recall() 读取消息（正确的 Mastra Memory API）
      const result = await this.memory.recall({
        threadId,
        resourceId,
      });

      this.logger.log(`[Memory] 读取会话历史: ${threadId}, 消息数: ${result.messages.length}`);

      // 转换为前端格式
      return result.messages.map((msg: any) => {
        const parsed = this.parseMastraContent(msg.content);
        return {
          id: msg.id,
          role: msg.role,
          content: parsed.text,
          createdAt: msg.createdAt,
          toolCalls: msg.toolCalls,
          toolSteps: parsed.toolSteps.length > 0 ? parsed.toolSteps : undefined,
        };
      });
    } catch (error) {
      this.logger.error(`[Memory] 读取会话历史失败: ${threadId}`, error);
      return [];
    }
  }

  /**
   * 解析 Mastra Memory 存储的 content 字段
   * Mastra 使用 format:2 结构化存储消息，包含 parts 数组（text + tool-invocation）
   * 需要提取纯文本和工具调用步骤供前端渲染
   */
  private parseMastraContent(content: any): { text: string; toolSteps: any[] } {
    // 如果是字符串，尝试解析为 JSON
    let parsed = content;
    if (typeof content === 'string') {
      try {
        const maybeJson = JSON.parse(content);
        if (maybeJson && typeof maybeJson === 'object' && maybeJson.parts) {
          parsed = maybeJson;
        } else {
          return { text: content, toolSteps: [] };
        }
      } catch {
        return { text: content, toolSteps: [] };
      }
    }

    // 处理 format:2 结构化内容
    if (parsed && Array.isArray(parsed.parts)) {
      const textParts: string[] = [];
      const toolSteps: any[] = [];

      for (const part of parsed.parts) {
        if (part.type === 'text' && part.text) {
          textParts.push(part.text);
        } else if (part.type === 'tool-invocation' || part.type === 'tool-call') {
          toolSteps.push({
            id: part.toolCallId || part.id || `tool_${Date.now()}`,
            name: part.toolName || part.name || 'unknown',
            arguments: part.args || part.arguments,
            status: part.state === 'result' ? 'completed' : (part.state === 'error' ? 'failed' : 'completed'),
            result: typeof part.result === 'string' ? part.result : (part.result ? JSON.stringify(part.result) : undefined),
            error: part.error,
            startTime: Date.now(),
            endTime: Date.now(),
          });
        }
      }

      return {
        text: textParts.join('\n') || '',
        toolSteps,
      };
    }

    // 兜底：对象格式
    if (parsed && typeof parsed === 'object') {
      return { text: parsed.text || JSON.stringify(parsed), toolSteps: [] };
    }

    return { text: String(content || ''), toolSteps: [] };
  }

  /**
   * 获取会话摘要信息
   * @param threadId 会话 ID
   * @param resourceId 用户 ID
   * @returns 摘要信息
   */
  async getThreadSummary(threadId: string, resourceId: string) {
    try {
      // 使用 Memory.recall() 读取消息
      const result = await this.memory.recall({
        threadId,
        resourceId,
      });

      if (result.messages.length === 0) {
        return {
          messageCount: 0,
          lastMessage: null,
          lastActivity: null,
        };
      }

      const lastMsg = result.messages[result.messages.length - 1];
      if (!lastMsg) {
        return {
          messageCount: result.messages.length,
          lastMessage: null,
          lastActivity: null,
        };
      }

      // 安全地提取消息内容
      let content = '';
      if (typeof lastMsg.content === 'string') {
        content = lastMsg.content;
      } else if (lastMsg.content && typeof lastMsg.content === 'object') {
        content = JSON.stringify(lastMsg.content).substring(0, 100);
      }

      return {
        messageCount: result.messages.length,
        lastMessage: content.substring(0, 100) || '',
        lastActivity: (lastMsg as any).createdAt,
      };
    } catch (error) {
      this.logger.error(`[Memory] 读取会话摘要失败: ${threadId}`, error);
      return {
        messageCount: 0,
        lastMessage: null,
        lastActivity: null,
      };
    }
  }

  /**
   * 获取用户的 Working Memory（持久化上下文）
   */
  async getWorkingMemory(threadId: string, resourceId: string) {
    try {
      return await this.memory.getWorkingMemory({ threadId, resourceId });
    } catch (error) {
      this.logger.error(`[Memory] 获取 Working Memory 失败: ${threadId}`, error);
      return null;
    }
  }

  /**
   * 获取 LibSQLVector 实例
   */
  getVector(): LibSQLVector {
    return this.vector;
  }

  /**
   * 语义搜索历史消息
   * @param query 搜索查询文本
   * @param resourceId 用户 ID
   * @param threadId 可选，限定在某个会话内搜索
   */
  async semanticSearch(query: string, resourceId: string, threadId?: string) {
    try {
      const result = await this.memory.recall({
        threadId: threadId || `search-${resourceId}`,
        resourceId,
        vectorSearchString: query,
      });

      this.logger.log(`[SemanticSearch] 查询: "${query.substring(0, 50)}", 结果: ${result.messages.length} 条`);
      return result.messages;
    } catch (error) {
      this.logger.error(`[SemanticSearch] 搜索失败: ${query.substring(0, 50)}`, error);
      return [];
    }
  }

  /**
   * 删除 Mastra Memory 中的会话线程
   * 当用户删除会话时同步清理 Memory
   */
  async deleteThread(threadId: string) {
    try {
      const memoryStore = await this.storage.getStore('memory');
      if (memoryStore) {
        await memoryStore.deleteThread({ threadId });
        this.logger.log(`[Memory] 已删除线程: ${threadId}`);
      }
    } catch (error) {
      this.logger.error(`[Memory] 删除线程失败: ${threadId}`, error);
    }
  }
}
