# LSC-AI 企业平台 UI/UX 设计调研报告

**调研时间**：2026-02-13
**适用对象**：大连中远川崎（DACKS）船舶制造企业 AI 统一工作平台
**调研范围**：工业软件设计原则、中国工业互联网趋势、船舶行业 UI 模式、IDP 界面设计、AI 对话交互、可用性无障碍、竞品参考

---

## 第一章 工业软件 UI/UX 设计原则

### 1.1 制造业/重工业用户特征

船舶重工行业用户与消费级互联网用户存在根本差异，LSC-AI 平台的用户画像需充分考虑以下特征：

**年龄与技术素养**
- 产线工人平均年龄偏大（35-55 岁），对新技术接受度差异极大
- 工程师群体技术素养较高，但习惯于 CAD/MES 等专业工具的操作逻辑
- 管理层关注数据和结果，对操作效率要求极高
- 行政人员习惯 Office/OA 类软件，需要低学习成本

**高压工作环境**
- 工业用户常处于疲劳、戴手套、多任务并行的状态；工业 HMI 设计中，操作员按下控件后若不能立即确认机器是否响应，犹豫会打断节奏、降低产出
- 设计必须提供即时、明确、不可忽略的反馈机制

**效率导向**
- 工业软件的核心目标是减少操作步骤和降低认知负荷，而非追求视觉华丽
- 用户需要在同一视图中看到尽可能多的关键信息，避免频繁切换页面

### 1.2 工业软件 vs 消费级软件的 UI 差异

| 维度 | 消费级软件 | 工业/企业级软件 |
|------|-----------|----------------|
| 信息密度 | 低密度、大留白 | 高密度、紧凑布局 |
| 色彩策略 | 丰富多彩、品牌表达 | 克制沉稳、蓝/灰/深色为主 |
| 交互频率 | 低频、探索式 | 高频、重复性操作 |
| 错误容忍 | 较高（可撤销） | 极低（操作可能影响生产） |
| 学习曲线 | 扁平（上手即用） | 陡峭但长期高效 |
| 数据展示 | 简化摘要 | 完整表格、多维图表 |
| 操作反馈 | 微动效、愉悦感 | 强确认、状态明确 |

### 1.3 企业软件设计规范建议

**色彩体系**
- **主色**：中远海运品牌蓝（PANTONE 2945，RAL 5017）作为品牌识别色
- **辅色**：中远海运红（PANTONE 1795，RAL 3020）用于强调和告警
- **功能色**：绿色（成功/正常）、黄色（警告/注意）、红色（错误/危险）、蓝色（信息/进行中）
- **背景**：建议深色主题（#141414 ~ #1f1f1f），降低长时间注视的眼疲劳；同时提供浅色主题切换

**信息层级**
- 采用 F 型或 Z 型扫描布局，关键指标放在左上角
- 使用卡片（Card）组织信息块，每个卡片承载一个信息单元
- 表格是工业软件的核心交互组件，必须支持排序、筛选、分页、列固定、行展开

**操作效率**
- 常用操作必须在两次点击内到达
- 批量操作支持全选/反选/条件筛选
- 支持键盘快捷键（Tab 切换、Enter 提交、Esc 取消）

### 1.4 多端适配策略

| 场景 | 分辨率 | 设计重点 |
|------|--------|---------|
| 大屏看板 | 1920x1080 ~ 3840x2160 | 全局概览、实时数据、酷炫可视化、深色背景、大字号 |
| 桌面工作站 | 1920x1080 | 高密度信息、多面板并排、完整交互、键鼠优化 |
| 平板（车间） | 1024x768 ~ 1366x1024 | 触控优化、大按钮、简化导航、核心功能优先 |
| 手机（移动审批） | 375x812 ~ 428x926 | 极简信息、卡片式布局、底部导航、推送通知 |

大屏看板设计应采用深色背景（通常为深蓝到黑色渐变），搭配发光效果和动态数据流，突出数据可视化的视觉冲击力。3D 可视化模型在复杂业务场景中具有天然的视觉优势。

---

## 第二章 中国工业软件 UI/UX 趋势（2024-2026）

### 2.1 国内工业互联网平台设计风格

**主流平台 UI 特征总结**

| 平台 | 设计风格 | 特点 |
|------|---------|------|
| 树根互联（根云） | 深蓝科技风 | 工业设备监控大屏、实时数据流、设备拓扑图 |
| 海尔卡奥斯（COSMOPlat） | 蓝白简洁风 | 强调"大规模定制"可视化、用户旅程地图 |
| 用友精智 | 企业蓝灰风 | ERP 血统，表格密集、功能导航复杂但完整 |
| 工业富联（Fii Cloud） | 暗色科技风 | 产线数字孪生、设备状态热力图、边缘计算可视化 |

**共性特征**：
- 以蓝色/深蓝色为绝对主色调（代表科技、可靠、专业）
- 数据看板以深色背景为主，辅以发光/渐变效果
- 强调实时数据更新（WebSocket 推送 + 数字翻牌器动效）
- 功能模块采用卡片式布局 + 左侧树形导航

### 2.2 中国企业用户对 AI 产品的审美偏好

2024-2025 年的 UI 设计趋势显示：

- **扁平化仍是主流**，但正向"新拟态"方向演进（玻璃拟态 Glassmorphism、柔和阴影、光效元素）
- **AI 界面偏好**：中国企业用户期望 AI 产品具备"专业感"和"科技感"，而非过于消费化的卡通风格
- **情感化极简主义**：2025 年极简设计与情感化设计深度融合，设计师倾向于选择具有情感暗示的色彩
- **光效与发光元素**逐渐成为界面设计中的常见手法，通过发光的按钮、边框或光线效果来引导用户注意力

**对 LSC-AI 的建议**：采用"专业蓝 + 深色模式 + 微光效"的设计基调，既符合央企审美，又体现 AI 技术感。

### 2.3 央企/国企软件的特殊设计要求

**品牌合规**
- 必须使用中远海运官方品牌色体系（蓝 PANTONE 2945 + 红 PANTONE 1795）
- 登录页、关于页需展示集团 LOGO 和标准字体
- 避免使用西方政治敏感的图标或意象

**信创/国产化要求**
- 到 2027 年底，央国企必须 100% 完成信息化系统信创改造
- 前端需兼容信创浏览器（360 安全浏览器、奇安信可信浏览器等，均基于 Chromium）
- 字体优先使用思源黑体/宋体等开源中文字体，避免版权风险

**数据主权**
- 所有数据展示界面需标注数据来源和更新时间
- 敏感数据（人事、财务）需有脱敏展示模式
- 审计日志界面是必备功能模块

### 2.4 "数字中国"背景下的趋势

2024-2026 年信创产业市场规模预计增速 15-27%，企业数字化重点从"基础替代"向"数据智能"转型。对 LSC-AI 而言：

- **AI + 工业**是政策鼓励方向，UI 应突出"智能化"标签
- 国产大模型接入（DeepSeek、通义千问等）是合规必选项
- 数据可视化大屏是政府/国企数字化项目的"门面工程"，需重点投入设计

---

## 第三章 船舶行业专用 UI 模式

### 3.1 船舶设计软件 UI 参考

**AVEVA Marine 套件**
- AVEVA Initial Design 提供快速船体定义和分析，具有直观的图形用户界面
- 核心 UI 模式：三维模型视图 + 属性面板 + 树形结构浏览器 + 工具栏
- E3D 设计器采用多视口布局（平面图 + 剖面图 + 3D 透视同步）
- 颜色编码系统：不同管系/结构/舾装用不同颜色区分

**CATIA / 3DEXPERIENCE**
- Dassault 的 3DEXPERIENCE 平台提供 CATIA（3D 建模）+ SIMULIA（仿真）+ ENOVIA（协作）的集成环境
- UI 特征：Ribbon 工具栏 + Compass（罗盘导航）+ 3D 沉浸式工作区
- 深灰色背景是 CAD 软件的标准选择，降低对模型颜色的干扰

**对 LSC-AI 的参考价值**：
- Workbench 中的代码/表格/图表展示可借鉴 CAD 软件的多面板同步模式
- 属性面板（右侧 Inspector）是工程师熟悉的交互模式
- 树形结构浏览器（类似 FileBrowser）是工程软件的标准配置

### 3.2 造船 MES/ERP 系统界面特征

中国造船行业实施了 PDM、ERP 和 MES 系统。沪东中华发布的 DMS 5.0 系统覆盖生产计划、供应链、工时、质量和成本财务全流程。韩国 HD 现代集团与西门子合作构建设计-制造一体化平台。

**造船 MES 的典型 UI 布局**：

```
┌───────────────────────────────────────────────┐
│  顶部：生产进度总览（甘特图/里程碑）           │
├───────────┬───────────────────────────────────┤
│ 左侧导航   │  中央：工序详情表格/看板           │
│ - 分段制作  │  ┌─────────┬─────────┬─────────┐ │
│ - 总组      │  │ 切割    │ 焊接    │ 涂装    │ │
│ - 搭载      │  │ 进度条  │ 进度条  │ 进度条  │ │
│ - 舾装      │  └─────────┴─────────┴─────────┘ │
│ - 质检      │  右侧：详情/属性面板（可折叠）    │
├───────────┴───────────────────────────────────┤
│  底部：状态栏（告警数/在线设备/数据更新时间）    │
└───────────────────────────────────────────────┘
```

**关键 UI 模式**：
- 甘特图（Gantt Chart）：造船生产计划的核心可视化方式
- 看板（Kanban）：分段/总组/搭载各工序的状态流转
- 热力图：车间设备负荷/产能利用率
- 树形 BOM：物料清单层级展开

### 3.3 质量管理系统（QMS）界面布局

**典型 QMS 界面结构**：
- **检查单列表**：表格 + 状态标签（待检/合格/不合格/复检）
- **缺陷记录**：图片标注 + 位置定位（船体分段示意图上标点）
- **统计分析**：柏拉图（Pareto）、控制图（SPC）、趋势图
- **审批流程**：线性步骤条（Step Bar）+ 签字确认

**对 LSC-AI 的参考**：
- IDP 的文档审查结果展示可借鉴 QMS 的"缺陷标注"交互模式
- 合同审查的风险点高亮与 QMS 的不合格项标注逻辑一致

### 3.4 文档管理系统（DMS/EDM）交互模式

- **文档树**：按项目/船号/部门/类型多维度组织
- **版本管理**：版本号 + 修改人 + 修改时间 + 变更说明，支持 Diff 对比
- **审批流程**：多级签审（编制 -> 校对 -> 审核 -> 批准），每级显示状态
- **预览器**：内嵌 PDF/图纸预览，支持批注和标记
- **全文检索**：搜索框 + 高级筛选（文件类型/日期范围/负责人）

---

## 第四章 IDP（智能文档处理）界面设计

### 4.1 文档上传/预览/标注的最佳实践

**上传交互**：
- 拖拽区域（Drag & Drop Zone）+ 点击上传的双入口模式
- 拖拽时视觉反馈：区域边框高亮、背景色变化
- 上传进度条：每个文件独立显示进度百分比、文件名、大小、状态
- 文件类型验证在上传前执行，不符合条件的文件即时提示

**预览器设计**：
- 支持 PDF、Word、Excel、图片的内嵌预览
- 预览器应占据主视图区域（≥60% 宽度）
- 左侧缩略图导航 + 右侧属性/标注面板
- 支持缩放、翻页、全屏模式

**标注系统**：
- 矩形框选（Bounding Box）+ 自由画笔 + 文字批注
- 标注类型用颜色区分（红色-错误、黄色-警告、绿色-确认、蓝色-信息）
- 标注支持评论/回复线程
- 标注列表与文档定位联动（点击标注跳转到对应位置）

### 4.2 OCR 结果展示：原图 + 识别文本对照

**推荐布局方案**：

```
┌────────────────────────────────────────────────┐
│  工具栏：缩放 | 旋转 | 对照模式切换 | 导出      │
├──────────────────────┬─────────────────────────┤
│                      │                         │
│  原始文档图像         │  识别结果文本            │
│  (带 Bounding Box     │  (可编辑，与原文逐行     │
│   框选标注)           │   对应，高亮差异)        │
│                      │                         │
│  [置信度热力图覆层]    │  [字段提取结果表格]      │
│                      │                         │
├──────────────────────┴─────────────────────────┤
│  底部：置信度评分 | 手动修正计数 | 处理时间       │
└────────────────────────────────────────────────┘
```

**关键设计要素**：
- 左右分栏同步滚动：原图和识别文本保持对齐
- Bounding Box 颜色编码：绿色（高置信度 >95%）、黄色（中 80-95%）、红色（低 <80%）
- 点击识别文本时，原图对应区域高亮
- 支持覆层模式（Overlay）：将识别文本以半透明红色叠加在原图上，便于快速校对
- 参考 Scribe OCR 的做法：精确地将可编辑 OCR 文本叠加在源图像上

### 4.3 表格提取结果的可视化

- 原图中的表格区域用蓝色矩形框标识
- 提取后的表格以可编辑 Ant Design Table 呈现
- 单元格级置信度：低置信度单元格背景标黄
- 支持合并/拆分单元格、添加/删除行列的手动修正
- 导出为 Excel/CSV 的一键操作

### 4.4 合同审查结果 UI 设计

**要素高亮模式**：
```
┌────────────────────────────────────────────────┐
│  合同文本（全文展示）                             │
│                                                │
│  甲方：[蓝色高亮] 大连中远川崎船舶工程有限公司    │
│  金额：[绿色高亮] ¥12,500,000.00                │
│  期限：[黄色高亮] 2026-03-01 至 2027-02-28       │
│  违约条款：[红色高亮/风险标注] 如乙方延期交付...  │
│                                                │
├────────────────────────────────────────────────┤
│  右侧面板：要素提取摘要                          │
│  ├── 合同基本信息（甲乙方/金额/日期）           │
│  ├── 风险评估（红/黄/绿三级）                    │
│  ├── 条款对比（与标准模板差异）                   │
│  └── 审查意见（AI 建议 + 人工批注）              │
└────────────────────────────────────────────────┘
```

**风险标注系统**：
- 三级风险：高风险（红色徽标 + 红色边框）、中风险（黄色）、低风险/合规（绿色）
- AI 为每个风险点生成一句话说明 + 相关法律条款引用
- 风险汇总卡片：总风险数、各级别数量、总体评分（类似信用评分仪表盘）

**对比视图**：
- 双栏 Diff View：左侧标准模板、右侧实际合同
- 差异高亮：新增内容绿色背景、删除内容红色删除线、修改内容黄色背景
- 同步滚动 + 差异跳转按钮（上一个差异/下一个差异）

### 4.5 文档版本对比界面

参考 Collaborator Diff Viewer 和 Draftable 的设计：
- 差异以颜色编码高亮：变更为黄色、新增为绿色、删除为红色
- 并排视图中双侧文档同步滚动
- 差异数量统计 + 快速跳转导航条
- 支持按变更类型筛选（仅看新增/仅看删除/全部）

### 4.6 批量文档处理的进度和状态展示

```
┌────────────────────────────────────────────────┐
│  批量处理任务面板                                │
├────────────────────────────────────────────────┤
│  总进度：████████████░░ 78%  (156/200 文件)      │
│  预计剩余时间：~3 分钟                           │
├────────────────────────────────────────────────┤
│  文件名          │ 类型  │ 状态    │ 置信度 │ 操作│
│  合同-001.pdf   │ PDF  │ ✅ 完成 │ 97.2% │ 查看│
│  发票-023.jpg   │ 图片 │ ✅ 完成 │ 89.1% │ 查看│
│  报告-007.docx  │ Word │ ⏳ 处理中│  --   │  -- │
│  图纸-112.pdf   │ PDF  │ ⏱ 排队  │  --   │  -- │
│  损坏文件.xxx   │ 未知 │ ❌ 失败 │  --   │ 重试│
├────────────────────────────────────────────────┤
│  统计：成功 156 | 失败 3 | 处理中 1 | 排队 40     │
│  [全部重试失败] [导出结果] [取消剩余]             │
└────────────────────────────────────────────────┘
```

关键设计原则：
- 每个文件独立显示进度和状态
- 失败的文件提供重试按钮和具体错误信息
- 总进度条 + 预计剩余时间减少用户焦虑
- 支持取消排队中的任务

---

## 第五章 AI 对话 + 文档处理的交互设计

### 5.1 AI 对话界面中嵌入文档预览

LSC-AI 的 Workbench 模式（Chat + 右侧面板）与 Claude Artifacts / ChatGPT Canvas 的设计理念一致。2024 年 7 月 Anthropic 推出 Claude Artifacts 的分屏视图，2024 年 10 月 OpenAI 推出 ChatGPT Canvas 直接挑战这一模式。这两者都是将创意输出从主聊天流中分离到侧面板中。

**推荐的 LSC-AI Workbench 布局**：

```
┌──────────────────┬──────────────────────────────┐
│                  │                              │
│  AI 对话区域      │  Workbench 工作区             │
│  (30-40% 宽度)   │  (60-70% 宽度)               │
│                  │                              │
│  用户: 分析这份   │  ┌──────────────────────────┐│
│  合同的风险点     │  │ [合同] [表格] [图表] [代码]││
│                  │  ├──────────────────────────┤│
│  AI: 已识别 3 个  │  │                          ││
│  风险条款...      │  │  (动态内容区域)           ││
│                  │  │  合同文本 + 风险高亮       ││
│  [输入框]        │  │                          ││
│                  │  └──────────────────────────┘│
└──────────────────┴──────────────────────────────┘
```

**关键交互**：
- 对话中提到的文档/数据自动在 Workbench 中渲染
- Workbench Tab 支持多内容并存（合同、提取表格、统计图表）
- 拖拽分隔条调整左右比例
- 对话区域的消息中嵌入"查看详情"按钮，点击跳转到 Workbench 对应 Tab

### 5.2 "对话驱动" vs "功能驱动"的 IDP 交互模式

| 模式 | 适用场景 | 交互方式 |
|------|---------|---------|
| 对话驱动 | 探索性分析、临时查询、不确定文档类型 | 用户上传文件 + 自然语言描述需求 → AI 自动选择处理流程 |
| 功能驱动 | 批量处理、标准化流程、高频重复操作 | 用户进入功能模块 → 选择模板 → 上传文件 → 自动处理 |
| 混合模式（推荐） | LSC-AI 全场景 | 功能模块提供标准入口，AI 对话作为"万能入口"补充 |

**LSC-AI 推荐策略**：
- **高频标准流程**（如发票识别、合同审查）→ 功能驱动，提供专门的功能页面
- **低频探索需求**（如"这份图纸里有哪些修改"）→ 对话驱动
- **两种模式无缝切换**：功能页面内嵌 AI 助手按钮，对话中可跳转到功能页面

### 5.3 用户通过自然语言触发文档处理

AI 对话中的文档处理触发流程：

1. **上传阶段**：用户拖拽或粘贴文件到对话输入框
2. **意图识别**：AI 分析用户指令（"帮我审查这份合同" / "提取表格数据" / "翻译这份文档"）
3. **处理反馈**：对话中显示处理进度（Skeleton/Loading 动画）
4. **结果呈现**：
   - 简要摘要在对话气泡中展示
   - 详细结果在 Workbench 中渲染（表格/标注文档/图表）
   - 提供"导出"和"进一步分析"的 Action 按钮

### 5.4 处理结果在 Workbench 中的展示设计

根据不同文档类型，Workbench 应支持以下内容块：

| 文档类型 | Workbench 展示组件 | 交互 |
|---------|-------------------|------|
| 合同/文本 | 富文本 + 风险高亮 + 要素提取卡片 | 点击高亮跳转、修改建议 |
| 发票/票据 | 原图预览 + 字段提取表格 | 字段编辑、置信度标识 |
| 表格数据 | 可编辑 DataTable + 统计图表 | 排序筛选、图表联动 |
| 技术图纸 | 图片预览 + OCR 标注覆层 | 缩放、区域选择、批注 |
| 报告/周报 | Markdown 渲染 + 导出按钮 | 编辑、格式化、下载 |

---

## 第六章 可用性和无障碍设计

### 6.1 重工业环境下的可用性考虑

**手套操作**：
- 触控目标最小尺寸 48x48px（常规为 44x44px），戴手套时建议 56x56px
- 避免紧密排列的可点击元素，按钮间距 ≥ 12px
- 优先使用点击/轻触，避免长按、双击、复杂手势
- 投射式电容触摸屏（PCAP）可通过软件调整灵敏度以支持手套操作

**强光环境**：
- 提供高对比度模式（≥ 7:1 对比度，WCAG AAA 级别）
- 避免纯白色背景（刺眼），建议 #f5f5f5 或深色模式
- 关键状态信息不仅用颜色区分，同时用图标/文字标签辅助

**嘈杂环境**：
- 所有声音提示必须配合视觉提示（弹窗/闪烁/振动）
- 语音交互在车间环境中不可靠，AI 对话以文字输入为主
- 关键告警使用全屏遮罩 + 强烈视觉反馈

### 6.2 老龄化用户群体设计

**字号规范**：
- 正文：≥ 14px（推荐 16px）
- 辅助文字/标签：≥ 12px
- 标题：≥ 18px
- 大屏看板数字：≥ 36px
- 提供字号调节功能（小/中/大三档）

**对比度**：
- 文字/背景对比度 ≥ 4.5:1（WCAG AA）
- 重要操作按钮对比度 ≥ 7:1（WCAG AAA）
- 避免灰色文字在灰色背景上（低对比度陷阱）

**操作反馈**：
- 点击按钮后立即显示 Loading 状态（≤ 100ms 内响应）
- 操作成功/失败使用全屏 Toast（≥ 3 秒自动消失）
- 表单提交前显示确认对话框，支持二次确认
- 触控交互中使用触觉反馈（Touch Feedback）强化操作确认

### 6.3 中文界面排版规范

**中西文混排**：
- 中文与英文/数字之间添加半角空格（如"共 128 条记录"）
- 中文使用全角标点，英文/代码使用半角标点
- 字体栈：`-apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`

**数字表格**：
- 数字右对齐，文本左对齐
- 金额使用千分位分隔符（如 12,500,000.00）
- 日期统一格式：YYYY-MM-DD 或 YYYY年MM月DD日
- 表头固定（sticky），支持横向滚动

**技术术语**：
- 船舶行业术语保留中文（如"分段"、"总组"、"舾装"）
- 系统术语提供中英对照（如"工作台 Workbench"、"知识库 Knowledge Base"）
- Tooltip 提供术语解释

### 6.4 错误处理和状态反馈

**四态设计模型**（每个页面/组件必须设计四种状态）：

| 状态 | 设计方案 | 示例 |
|------|---------|------|
| **加载中** | Skeleton 骨架屏（表格用行骨架，卡片用块骨架） | 数据加载时的占位动画 |
| **空状态** | 插图 + 引导文案 + 操作按钮 | "暂无文档，点击上传" |
| **错误状态** | Alert 组件 + 具体错误信息 + 重试按钮 | "网络连接失败，请检查网络后重试" |
| **成功状态** | Toast 通知 + 数据刷新 | "文档处理完成" |

**企业级错误处理原则**：
- 错误消息使用非技术语言（避免"500 Internal Server Error"）
- 提供具体的修复建议（"请检查文件格式是否为 PDF/Word/Excel"）
- 不可恢复的错误提供"联系管理员"入口
- 错误日志自动记录（对接审计日志模块）

---

## 第七章 竞品 UI 参考

### 7.1 合合信息（TextIn）— 智能文档处理

TextIn 是 AI 驱动的企业级文档自动化处理平台，支持多种版式文档的智能采集、解析、分类、信息抽取及审核。

**UI 特点**：
- 可视化文档解析前端 ParseX：左侧原文档 + 右侧结构化解析结果
- 向量化模型 acge-embedding 支持语义搜索
- 在线体验入口降低试用门槛
- 深蓝色品牌主色 + 白色/浅灰背景 + 代码风格的技术美学

**LSC-AI 可借鉴点**：
- 文档解析结果的左右对照展示模式
- 在线体验的低门槛设计（不注册即可体验核心功能）

### 7.2 达观数据 — 智能文档审阅

达观 IDPS 平台采用 NLP、深度学习、计算机视觉技术，实现自动抽取关键信息、对比文档差异、审核风险、识别表格。

**UI 特点**：
- 集文本比对、信息抽取、表格提取、审核于一体的综合界面
- 多行业模板（金融、制造、法律、政务）
- 文档 Diff 对比功能突出
- 风险审核结果以红黄绿三色标识

**LSC-AI 可借鉴点**：
- 合同审查的风险三级标注系统（红/黄/绿）
- 文档 Diff 对比的交互模式
- 行业模板机制

### 7.3 ABBYY Vantage / FlexiCapture

ABBYY Vantage 是排名领先的 IDP 解决方案，采用无代码/低代码设计。

**UI 特点**：
- Skill Designer：可视化配置文档处理技能（分类、OCR、提取）
- Skills Catalog：预置技能目录，可复制和重训练
- 低代码方式让业务人员（Citizen Developer）也能配置
- 支持多语言、手写体识别

**LSC-AI 可借鉴点**：
- "技能"概念：将文档处理能力打包为可复用的"技能"
- 低代码配置器的交互模式
- Human-in-the-Loop 验证界面

### 7.4 DocuSign — 合同管理

DocuSign CLM 管理合同全生命周期，提供创建、编辑、谈判、审批的电子化工具。

**UI 特点**：
- Maestro 无代码拖拽工作流设计器
- 五阶段合同管理（创建 → 谈判 → 路由 → 签署 → 归档）
- 并行审批 + AI 摘要 + 状态仪表盘
- 1000+ 合作伙伴集成

**LSC-AI 可借鉴点**：
- 合同生命周期的阶段展示（步骤条/进度条）
- 审批工作流的可视化设计器（参考 ReactFlow 编辑器）
- 移动端签署体验

### 7.5 泛微 / 蓝凌 — 企业 OA/文档管理

泛微拥有最强流程引擎（支持复杂条件分支、跨系统触发），蓝凌强在流程与知识库联动。大型集团可采用"泛微+钉钉/飞书"组合方案。

**UI 特点**：
- 复杂流程引擎的图形化配置
- 门户式首页（多 Widget 自由排列）
- 表单驱动的审批流程
- 知识库 + OA 流程联动

**LSC-AI 可借鉴点**：
- 门户式首页的 Widget 化设计
- 审批流程的节点图可视化
- 知识库与工作流的联动

### 7.6 飞书 / 钉钉 — 企业 AI 助手

钉钉发布 AI 钉钉 1.1"木兰"版本，推出 Agent OS 和 20+ 款 AI 新品，包括制造业"订单 Agent""质量 Agent"。飞书推出"My AI"助手。

**UI 特点**：
- AI 对话深度集成在工作流中（非独立入口）
- 制造业专属 Agent："订单 Agent"一键将订单图片转为排产表格
- 移动端优先的交互设计
- 卡片式消息（Rich Card）承载结构化信息

**LSC-AI 可借鉴点**：
- AI 助手嵌入工作流的模式（而非独立的"聊天"页面）
- 卡片式消息在对话流中承载结构化数据
- 移动端"质量 Agent"的预测故障+推送提醒模式

---

## 第八章 设计建议总结

### 8.1 LSC-AI 平台 UI 设计原则（DACKS 定制）

1. **专业优先**：蓝灰深色基调，中远海运品牌色为锚点，体现央企专业形象
2. **效率至上**：高信息密度、表格为核心、两次点击到达目标、键盘快捷键
3. **即时反馈**：每个操作 100ms 内有视觉响应，工业用户不能容忍"不确定"
4. **容错设计**：关键操作二次确认，误操作可撤销，错误信息具体可执行
5. **渐进式复杂度**：新手看到简洁界面，高级用户可展开详细面板
6. **四态完备**：每个视图覆盖加载中/空/错误/正常四种状态
7. **无障碍兼容**：大字号（≥14px）、高对比度（≥4.5:1）、大触控区域（≥48px）

### 8.2 技术选型建议

| 领域 | 推荐方案 | 理由 |
|------|---------|------|
| 组件库 | Ant Design 5 (已在用) | 中文企业软件生态最完善、信创兼容 |
| 图表 | ECharts (已在用) | 国产、大屏适配好、交互丰富 |
| 编辑器 | Monaco Editor (已在用) | 代码展示/编辑标准方案 |
| 文档预览 | PDF.js + Mammoth.js | PDF/Word 内嵌预览 |
| Diff 对比 | react-diff-viewer | 文档版本对比 |
| 流程编辑 | ReactFlow (已在用) | RPA/工作流可视化 |
| 文档标注 | Annotorious / react-pdf-annotator | IDP 文档标注 |
| 大屏适配 | CSS Scale + Container Queries | 多分辨率自适应 |

### 8.3 IDP 界面优先级路线图

| 阶段 | 功能 | UI 组件 |
|------|------|---------|
| P0 | 文档上传 + OCR 识别 + 结果展示 | Upload Dragger + Split View + DataTable |
| P0 | 合同要素提取 + 风险标注 | Rich Text + Highlight + Risk Card |
| P1 | 表格提取 + 可编辑校正 | Editable Table + Confidence Badge |
| P1 | 批量处理 + 队列管理 | Progress List + Status Table |
| P2 | 文档版本对比 | Diff Viewer + Sync Scroll |
| P2 | 文档标注协作 | Annotation Layer + Comment Thread |

---

## 第九章 关键参考资源与信息来源

### 工业软件与制造业 UI 设计
- [Sandvik: Behind the Scenes of UI/UX Design in Digital Manufacturing](https://www.digitalmanufacturing.sandvik/en/news-stories/lpblog/2024/03/behind-the-scenes-of-uiux-design-in-digital-manufacturing/)
- [Explitia: UX/UI Design in Industrial Systems](https://explitia.com/blog/ux-ui-design-in-industrial-systems/)
- [AufaitUX: Manufacturing UX Design](https://www.aufaitux.com/blog/manufacturing-ux-design/)
- [OXD: User Interface and UX in Industrial Manufacturing](https://oxd.com/insights/the-pivotal-role-of-user-interface-and-user-experience-in-industrial-manufacturing/)

### 船舶行业软件与工程
- [AVEVA Marine Engineering Software](https://www.aveva.com/en/industries/marine/)
- [AVEVA Initial Design](https://www.aveva.com/en/products/initial-design/)
- [AVEVA Hull and Outfitting](https://www.aveva.com/en/products/hull-and-outfitting/)
- [Top 20 Software Used In Naval Architecture](https://www.marineinsight.com/naval-architecture/top-20-software-used-in-naval-architecture/)
- [船舶数字化建造发展现状与趋势](http://html.rhhz.net/jckxjsgw/html/69048.htm)
- [沪东中华 DMS 5.0 船舶数字化管理系统](https://finance.sina.cn/2024-01-16/detail-inacstpc7013095.d.html)

### 2024-2026 年 UI 设计趋势
- [CoDesign: 2024 UI 设计趋势总结与 2025 前瞻](https://codesign.qq.com/hc/article/annual-ui-trends-summary-and-outlook/)
- [荔枝软件: 2024-2026年 8 大 UI 设计趋势](https://www.lizhiruanjian.com/post/01HZ3HVPT1P5VKADJ1ME2JYZBY)
- [标记狮社区: 2025 年 UX/UI 设计趋势](https://mmmnote.com/article/7e8/14/article-ab01c96623e7fd2e.shtml)
- [Smashing Magazine: Designing AI Beyond Conversational Interfaces](https://www.smashingmagazine.com/2024/02/designing-ai-beyond-conversational-interfaces/)
- [PatternFly AI Conversation Design](https://www.patternfly.org/patternfly-ai/conversation-design/)

### IDP 与文档处理
- [TextIn 智能文档处理平台](https://www.textin.com/)
- [达观数据 智能文档审阅系统](https://www.datagrand.com/products/idps/)
- [ABBYY Vantage IDP Platform](https://www.abbyy.com/vantage/)
- [DocuSign CLM](https://www.docusign.com/products/clm/)
- [Draftable 文档对比工具](https://www.draftable.com/compare)
- [Collaborator Diff Viewer](https://support.smartbear.com/collaborator/docs/reference/ui/diff-viewer.html)
- [Scribe OCR 项目](https://github.com/scribeocr/scribeocr)

### AI 对话与交互设计
- [Artium.AI: Beyond Chat - AI Transforming UI Design Patterns](https://artium.ai/insights/beyond-chat-how-ai-is-transforming-ui-design-patterns)
- [IntuitionLabs: Conversational AI UI Comparison 2025](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025)
- [Altar.io: Claude Artifacts, ChatGPT Canvas, and Perplexity Spaces](https://altar.io/next-gen-of-human-ai-collaboration/)
- [VentureBeat: OpenAI launches ChatGPT Canvas, challenging Claude Artifacts](https://venturebeat.com/ai/openai-launches-chatgpt-canvas-challenging-claude-artifacts)
- [Medium: ChatGPT 4.0 Canvas vs. Claude 3.5 Artifacts](https://medium.com/@cognidownunder/chatgpt-4-0-canvas-vs-claude-3-5-artifacts-a-deep-dive-into-ai-workspaces-6afeecb1e093)

### 可用性与无障碍设计
- [Agriculture Design System: Loading, Empty and Error States](https://design-system.agriculture.gov.au/patterns/loading-error-empty-states)
- [Carbon Design System: Loading Pattern](https://carbondesignsystem.com/patterns/loading-pattern/)
- [Nielsen Norman Group: Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- [SAGE: User-Centered Design for Age-Friendly Apps](https://journals.sagepub.com/doi/full/10.1177/21582440241285393)
- [Frontiers: Age-Appropriate Smart Home Interface Design](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1097834/full)
- [World Usability Day 2024: Building Accessible, Usable Experiences](https://www.tpgi.com/world-usability-day-2024/)
- [Faytech: Glove Touch Screen Compatibility](https://www.faytech.us/touchscreen-monitor/capacitive/open-frame/can-open-frame-touch-screen-monitors-be-used-with-gloves-heres-what-you-need-to-know/)

### 文件上传与数据处理
- [Filestack: Designing an Intuitive Document Upload UI](https://blog.filestack.com/designing-an-intuitive-document-upload-ui/)
- [Uploadcare: File Uploader UX Best Practices](https://uploadcare.com/blog/file-uploader-ux-best-practices/)
- [Ant Design Pro](https://pro.ant.design/)
- [Ant Design Upload Component](https://ant.design/components/upload/)
- [Ant Design Visualization Page Spec](https://ant.design/docs/spec/visualization-page/)

### 数据可视化与大屏
- [Fuselab: Top Dashboard Design Trends 2025](https://fuselabcreative.com/top-dashboard-design-trends-2025/)
- [esensoft: 数据可视化大屏风格指南](https://www.esensoft.com/industry-news/data-visualization-3564.html)

### 企业 AI 与工作流
- [CSDN: 泛微、致远、蓝凌、钉钉、飞书六大平台对比](https://blog.csdn.net/Cloud_zhixing/article/details/146226839)
- [2025 年值得入坑 AI Agent 的五大框架](https://www.53ai.com/news/neirongchuangzuo/2025010419643.html)
- [2026 年 AI 解决方案在 UX/UI 设计中的应用趋势](https://blog.bigbigwork.com/archives/202512091)

### 信创与国产化
- [中远海运品牌色标准](http://www.csoa.cn/doc/1070.jsp)
- [信创国产化政策解读](https://www.cnblogs.com/zentaopms/p/19021169)
- [FineReport: 信创最新趋势](https://www.finereport.com/blog/article/68b8027ed2527e0eb7513dcd)

---

## 附录 A：Ant Design 5 组件清单与造船工业应用

基于 LSC-AI 已采用的 Ant Design 5 组件库，以下是与 IDP 和工业应用高度相关的组件：

### A.1 核心数据展示组件

| 组件 | IDP 应用场景 | 推荐用法 |
|------|-----------|---------|
| **Table** | 字段提取结果、批量文件列表、版本历史 | 支持行选中、列固定、行展开、虚拟滚动 |
| **Tree** | 文档树导航、BOM 层级 | 支持拖拽排序、多选、可搜索 |
| **Tabs** | Workbench 多内容标签（合同/表格/图表/代码） | 支持新增/删除 Tab、路由绑定 |
| **Segmented** | OCR 模式切换（原图/覆层/并排） | 紧凑式单选 |
| **Badge** | 置信度标识、处理状态（进行中/完成/失败） | 数字徽标 + 颜色编码 |
| **Tag** | 风险等级标签（高/中/低）、文件类型 | 可关闭、支持颜色主题 |

### A.2 表单与输入组件

| 组件 | IDP 应用场景 | 推荐用法 |
|------|-----------|---------|
| **Upload** | 文档上传、批量导入 | Dragger（拖拽）+ List（文件列表） |
| **Input** | 文档搜索、字段编辑 | Search 型、可清除、支持前缀/后缀图标 |
| **InputNumber** | 批量处理数量、字段数值编辑 | 支持加减按钮、输入验证 |
| **Select** | 文档类型筛选、处理模板选择 | 多选模式、虚拟列表 |
| **DatePicker** | 版本日期筛选、处理时间范围 | 范围选择（RangePicker） |
| **TextArea** | 文档备注、审查意见编辑 | 可自动扩展高度 |

### A.3 反馈与提示组件

| 组件 | IDP 应用场景 | 推荐用法 |
|------|-----------|---------|
| **Modal** | 风险确认对话、处理失败详情 | 自定义按钮、支持加载状态 |
| **Drawer** | 文档详情侧面板、处理日志展示 | 从右侧滑出、支持嵌套 |
| **Alert** | OCR 置信度警告、处理错误提示 | 四种类型（success/info/warning/error） |
| **Message** | 操作成功/失败提示 | 自动关闭、支持加载中 |
| **Notification** | 批量处理完成通知、系统告警 | 右上角推送、支持关闭 |
| **Progress** | 批量文件处理进度、页面加载 | Line/Circle 两种，支持百分比文字 |
| **Skeleton** | 文档预览加载占位 | 段落形状、头像形状、可定制 |
| **Empty** | 暂无文档状态 | 自定义图片和文案 |

### A.4 布局与导航组件

| 组件 | IDP 应用场景 | 推荐用法 |
|------|-----------|---------|
| **Layout** | 整体页面框架 | Header/Sider/Content/Footer 组合 |
| **Breadcrumb** | 文档树导航路径显示 | 支持点击返回上级 |
| **Pagination** | 文件列表分页、搜索结果分页 | 简洁模式、支持快速跳转 |
| **Affix** | 固定工具栏（顶部操作按钮） | 支持偏移量调整 |
| **Collapse** | 高级筛选条件折叠、审查意见折叠 | 支持手风琴模式、自定义头部 |
| **Divider** | 段落分割、字段分组 | 支持自定义样式 |

### A.5 数据可视化集成

| 库 | 推荐用途 | 造船应用 |
|----|---------|----------|
| **ECharts** | 统计分析图表 | 缺陷趋势图、处理成功率柱状图、合同风险分布饼图 |
| **G2Plot** | 商业化图表（蚂蚁集团开源） | 流程漏斗图、转化率路径分析 |
| **Monaco Editor** | 代码和 JSON 编辑/展示 | 格式校验结果、AI 建议的修改代码 |
| **React-PDF** | PDF 文档预览 | 合同/图纸渲染、标注层叠加 |

---

## 附录 B：Workbench 详细设计规范

### B.1 Split View 布局参数

```typescript
// LSC-AI Workbench 分屏配置
const workbenchConfig = {
  // 响应式断点
  breakpoints: {
    desktop: 1920,      // 左30% + 右70%
    laptop: 1366,       // 左35% + 右65%
    tablet: 1024,       // 竖屏，左50% + 右50%
  },

  // 最小/最大宽度比例
  minLeftRatio: 0.25,   // 左侧最小 25%
  maxLeftRatio: 0.50,   // 左侧最大 50%

  // 分隔条
  dividerWidth: 4,      // px
  dividerCursor: 'col-resize',

  // 动画
  resizeTransition: 'none',  // 拖拽时不动画（立即响应）
  tabSwitchTransition: 150,  // ms
};
```

### B.2 Workbench 内容块（Block）类型

```typescript
type WorkbenchBlockType =
  | 'rich-text'      // 富文本（合同/报告，支持高亮和批注）
  | 'data-table'     // 可编辑数据表
  | 'chart'          // ECharts 图表
  | 'code'           // 代码块（syntax highlight）
  | 'document'       // 文档预览（PDF/Word）
  | 'image'          // 图片预览（支持标注）
  | 'comparison'     // Diff 对比视图
  | 'markdown'       // Markdown 渲染
  | 'custom';        // 自定义组件

// 每个 Block 的数据结构
interface WorkbenchBlock {
  id: string;
  type: WorkbenchBlockType;
  title: string;
  icon: ReactNode;
  data: any;
  actions?: BlockAction[];  // 导出、编辑等操作
  metadata?: {
    createdAt: string;
    source: string;  // AI 对话 ID
  };
}
```

### B.3 Tab 管理逻辑

```typescript
// Workbench Tab 管理规则
interface WorkbenchStore {
  // 当前活跃 Tab
  activeTabId: string;

  // Tab 列表
  tabs: Array<{
    id: string;
    label: string;
    block: WorkbenchBlock;
    closable: boolean;  // 只有 AI 生成的 Tab 可关闭
  }>;

  // 操作
  addTab(block: WorkbenchBlock): void;       // AI 对话自动调用
  updateTab(id: string, block: WorkbenchBlock): void;  // 用户编辑
  removeTab(id: string): void;               // 用户主动关闭
  switchTab(id: string): void;               // 用户点击切换

  // 会话隔离
  setSessionId(sessionId: string): void;     // 新建对话时清空 Workbench
}
```

### B.4 与对话消息的关联

```typescript
// 对话消息中的 Workbench 触发器
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;

  // Workbench 关联
  workbench?: {
    action: 'create' | 'update' | 'highlight';
    blockId: string;
    blockData: WorkbenchBlock;
  };

  // 操作按钮
  actions?: Array<{
    label: string;
    type: 'view-detail' | 'export' | 'download' | 'edit';
    handler: () => void;
  }>;
}
```

---

## 附录 C：IDP 功能模块导航树

推荐 LSC-AI S5 Sprint 的功能导航层级结构：

```
📄 IDP（智能文档处理）
├── 📊 仪表盘
│   ├── 今日处理统计（文件数/置信度）
│   ├── 处理历史趋势图
│   └── 待审核文档提醒
│
├── 📁 文档管理
│   ├── 我的文档（按日期/类型）
│   ├── 共享文档（团队协作）
│   ├── 回收站（已删除文档，30天后清空）
│   └── 搜索/高级筛选
│
├── 🔄 处理流程
│   ├── 快速扫描（拖拽上传 → 自动识别 → 结果展示）
│   ├── 高级处理（选择模板 → 配置参数 → 批量处理）
│   └── 自定义流程（无代码工作流编辑器，见 Appendix D）
│
├── 📋 模板管理
│   ├── 发票识别（字段映射模板）
│   ├── 合同审查（风险条款库）
│   ├── 表格提取（表头识别规则）
│   ├── 自定义模板（用户创建和共享）
│   └── 模板版本管理
│
├── ✅ 质检审核
│   ├── 待审核列表（按优先级排序）
│   ├── 审核详情（原文 + 识别结果 + 修改建议）
│   ├── 批量审核（多选 → 批准/驳回）
│   └── 反馈记录（用于持续优化）
│
├── 📊 数据分析
│   ├── 处理成功率趋势
│   ├── 置信度分布
│   ├── 常见错误类型（用于改进 AI 模型）
│   └── 导出报告（按部门/时间段）
│
└── ⚙️ 系统设置
    ├── 字段库管理（行业术语词典）
    ├── 风险库管理（法律条款库）
    ├── 通知偏好（处理完成提醒方式）
    └── 权限管理（管理员专属）
```

---

## 附录 D：无代码工作流编辑器设计（ReactFlow 扩展方案）

基于 LSC-AI 已集成的 ReactFlow，IDP 工作流编辑器可包含以下节点类型：

```typescript
// IDP 工作流节点类型
type IDP_NodeType =
  | 'source'           // 输入源（上传文件）
  | 'classify'         // 文档分类节点
  | 'extract'          // 字段提取节点
  | 'ocr'              // OCR 识别节点
  | 'validate'         // 数据校验节点
  | 'human-review'     // 人工审核节点
  | 'transform'        // 数据转换节点（格式转换、字段映射）
  | 'condition'        // 条件分支节点
  | 'loop'             // 批量处理循环节点
  | 'notification'     // 通知节点（邮件/钉钉/飞书）
  | 'storage'          // 存储节点（数据库/文件系统/MinIO）
  | 'sink';            // 输出节点

// 节点配置示例
const sampleWorkflow = {
  nodes: [
    {
      id: '1',
      type: 'source',
      label: '上传合同',
      position: { x: 0, y: 0 },
      data: { maxFiles: 100, fileTypes: ['pdf', 'docx'] }
    },
    {
      id: '2',
      type: 'classify',
      label: '文档分类',
      position: { x: 200, y: 0 },
      data: {
        categories: ['采购合同', '服务合同', '技术合同'],
        model: 'custom-classifier-v2'
      }
    },
    {
      id: '3',
      type: 'extract',
      label: '要素提取',
      position: { x: 400, y: 0 },
      data: {
        template: 'contract-default',
        fields: ['甲方', '乙方', '金额', '期限', '风险条款']
      }
    },
    {
      id: '4',
      type: 'condition',
      label: '风险分级',
      position: { x: 600, y: 0 },
      data: {
        conditions: [
          { label: '高风险', operator: 'gt', field: 'risk_score', value: 7 },
          { label: '中风险', operator: 'between', field: 'risk_score', value: [4, 7] },
          { label: '低风险', operator: 'lt', field: 'risk_score', value: 4 }
        ]
      }
    },
    {
      id: '5-high',
      type: 'human-review',
      label: '高风险人工审核',
      position: { x: 800, y: -150 },
      data: { priority: 'high', reviewer: 'legal-team' }
    },
    {
      id: '5-medium',
      type: 'notification',
      label: '中风险通知',
      position: { x: 800, y: 0 },
      data: { channel: 'email', template: 'medium-risk-alert' }
    },
    {
      id: '5-low',
      type: 'storage',
      label: '低风险自动存档',
      position: { x: 800, y: 150 },
      data: { target: 'contracts-low-risk', format: 'json' }
    }
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
    { id: 'e3-4', source: '3', target: '4' },
    { id: 'e4-5-high', source: '4', target: '5-high', label: '高风险' },
    { id: 'e4-5-medium', source: '4', target: '5-medium', label: '中风险' },
    { id: 'e4-5-low', source: '4', target: '5-low', label: '低风险' }
  ]
};
```

---

## 结论与下一步行动

本调研报告为 LSC-AI 平台的 S5 Sprint（IDP 智能文档处理）提供了全面的 UI/UX 设计参考框架。核心建议总结：

### 设计最高优先级（必做）

1. **采用中远海运品牌蓝 + 深色模式**作为 IDP 模块的主色调
2. **实现 Workbench 分屏交互**（Chat 左30% + 内容右70%）
3. **设计四态完备的界面**（加载中/空/错误/正常）
4. **大字号 + 高对比度**以适配老龄化用户和工业环境
5. **文档版本对比**采用 Diff View（绿+黄+红三色编码）

### 技术选型优先级

1. 采用 Ant Design 5 现有组件（Upload/Table/Modal/Drawer/Notification）
2. 集成 ECharts 用于处理统计和趋势分析
3. 使用 React-PDF + PDF.js 实现 PDF 内嵌预览
4. 扩展 ReactFlow 支持 IDP 工作流的无代码编辑

### 后续设计工作（按优先级）

1. **P0**：IDP 仪表盘和文档快速扫描功能的原型设计
2. **P1**：合同审查模块的要素高亮 + 风险标注界面设计
3. **P2**：无代码工作流编辑器的拖拽配置界面
4. **P3**：大屏看板展示（监控处理进度、统计数据）

本报告已完整输出到文件 `.claude/ui-ux-research-report.md`，可供后续设计阶段参考。

---

**报告编制**：Claude Code（基于 AI 辅助调研）
**最后更新**：2026-02-13
**适用版本**：LSC-AI Phase I — S5 Sprint 及后续 UI 迭代
