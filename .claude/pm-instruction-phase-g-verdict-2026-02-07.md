# PM 指令 — Phase G 验收判定 + P0 修复 + 团队协作要求

**下达人**: Claude Opus 4.6 (产品总经理)
**接收人**: 本地总工程师 + 全体开发团队
**日期**: 2026-02-07
**优先级**: 最高

---

## 一、Phase G 业务验收判定：不通过

### 判定结果

| 链路 | 门禁 | 实际 | PM 判定 | 说明 |
|------|------|------|--------|------|
| BF-1 基础对话 | 6/6 | 5.5/6 | ✅ 通过 | AI 对话能力正常，回复质量高 |
| BF-2 Workbench | ≥4/5 | **1/5** | ❌ 不通过 | AI 调用了工具但面板不打开 |
| BF-3 Office | ≥3/4 | **0/4** | ❌ 不通过 | createWord/createExcel 全部失败 |
| BF-4 本地 Agent | 6/6 | **2/6** | ❌ 不通过 | 所有文件操作工具参数解析失败 |
| BF-5 会话管理 | 6/6 | 4/6 | ⚠️ 部分通过 | Working Memory 跨会话泄漏 |
| BF-6 完整场景 | ≥5/6 | 4/6 | ⚠️ 部分通过 | Workbench 间歇性工作，Word 生成失败 |

### 关键发现

**BF-2 核心问题**：AI 正确调用了 showTable/showChart/workbench 工具（采集记录中可见"隐藏步骤 > showTable ✅"），但 **Workbench 面板没有响应打开**。用户只看到聊天气泡里的文字描述。这不是 AI 不调用工具的问题（P0-1 已修复），是**工具执行了但前端没渲染**。

**BF-4 核心问题**：所有本地工具返回 `Cannot read properties of undefined (reading 'file_path')`。AI 尝试了 ls/bash/glob/read/write/rm 共 10+ 次调用，全部相同错误。这是工具参数传递链上的 bug。

**BF-3 核心问题**：createWord 工具调用状态红色 ❌ 失败（截图 BF-3.1 直接可见），AI fallback 到 write 工具创建了 .txt/.csv 文件。

**BF-4 采集标准偏差**：团队将 BF-4.2~4.5 标记为 ✅，但 AI 实际回复是"所有工具调用都失败"、"目前无法执行任何文件系统操作"。技术结果应反映**用户需求是否被满足**，不是"工具函数是否被调用"。后续采集请按此标准。

---

## 二、3 个 P0 修复任务

### P0-7：Workbench 工具调用成功但面板不打开

**现象**：AI 调用 showTable/showChart/workbench，工具状态显示 ✅ 成功，但 Workbench 面板不可见。间歇性——BF-2 中 5 次失败 4 次，BF-6 中 6 步成功 4 步。

**排查方向**：
1. 检查 showTable/showChart 工具的返回值是否正确触发了 `WorkbenchStore.open()` / `WorkbenchStore.mergeSchema()`
2. 检查 ChatGateway 中工具结果的 WebSocket 推送是否到达前端
3. 对比 BF-2（单独 Workbench 测试，大量失败）和 BF-6（完整场景，Workbench 正常）的差异——可能和会话状态/上下文长度有关
4. 检查 `workbench` 工具和 `showTable` 工具的代码路径差异——`workbench` 直接操作 store，`showTable` 是否走不同路径？

**验证标准**：连续 5 次调用 showTable/showChart，面板打开率 ≥ 4/5。

### P0-8：Office 工具（createWord/createExcel）执行失败

**现象**：createWord 调用状态红色 ❌（截图 BF-3.1 可见），AI fallback 到 write 创建 .txt。

**排查方向**：
1. 检查 createWord 工具的 execute 函数——参数 schema 是否与 AI 传递的参数匹配
2. 检查 MinIO 文件存储是否正常（Office 文件需要存到 MinIO）
3. 检查 createWord 依赖的 npm 包（docx/officegen 等）是否正确安装
4. 查看 Server 端日志中 createWord 的具体错误信息

**验证标准**：createWord 成功生成 .docx + 前端显示下载卡片。

### P0-9：本地 Agent 工具参数解析失败

**现象**：所有本地工具返回 `Cannot read properties of undefined (reading 'file_path')`。A-1 修复（API Key 传递）已验证有效（C-1 S04 通过），但工具实际执行时参数为 undefined。

**排查方向**：
1. 检查 executor.ts 中工具调用的参数传递——AI 传的参数结构是否与工具定义的 Zod schema 匹配
2. 检查 tool-adapter 层——之前已知"嵌套 Schema 丢失"问题（P2-13），可能是此问题的表现
3. 对比 S04-V2 C 组（测试中通过）和 BF-4（验收中失败）的差异——可能和环境状态/工具版本有关
4. 检查 Client Agent 是否使用了最新的代码（A-1 修复后是否 rebuild）

**验证标准**：ls/write/read/rm 4 个基本操作全部成功返回结果。

---

## 三、关于验收方案的自我纠正

**PM 承认**：BF-1 到 BF-6 的验收场景过于简化，没有体现产品的真实设计深度。

- BF-2 把 Workbench 简化成了"展示表格和图表"，而架构设计（12-Workbench工作台.html）定义了 16 个应用场景——软件开发、数据分析、运维监控、RPA 流程可视化等，每个都有交互按钮和操作能力
- BF-4 把本地模式简化成了"创建/读取/删除文件"，而实际价值是工程师用 AI 构建、运行、调试完整项目

**P0-7/8/9 修复后，PM 将重新设计验收方案**，基于架构文档的真实场景，而不是简化版。

---

## 四、团队协作强制要求（PM 直接指令）

**以下要求立即生效，不是建议，是强制执行。**

### 总工程师必须使用 Agent Team 协作

从本次修复任务开始，**禁止总工程师一人完成所有工作**。

**原因**：
1. 刚才的 Phase G 验收（BF-1 到 BF-6 共 33 个验收点 + 7 个采集脚本 + 36 张截图），总工程师一人执行。结果：BF-4 的采集标准出了问题（工具失败标记为 ✅），BF-3 只跑了 BF-3.4 缺少了 BF-3.1/3.2/3.3 的独立报告。一个人精力有限，质量下降是必然的。
2. 3 个 P0 bug 涉及不同代码区域（前端 Workbench store、Server 端 Office 工具、Client Agent 参数传递），天然适合并行排查。
3. Opus 4.6 有 Agent Team 能力，不用就是浪费。

### 团队编制要求

本次 P0 修复，**最少 3 人团队**：

| 角色 | 负责 | 不可兼任 |
|------|------|---------|
| **工程师 A** | P0-7 Workbench 面板不打开 | 前端 + WebSocket 推送链路 |
| **工程师 B** | P0-8 Office 工具失败 | Server 端工具 + MinIO |
| **工程师 C** | P0-9 本地 Agent 参数解析 | Client Agent executor + tool-adapter |
| **Code Reviewer** | 每项修复的交叉审查 | 可由总工程师兼任 |

### 后续所有任务同理

今后任何超过 2 个独立子任务的工作，总工程师**必须**拆分给团队并行执行。单人作战模式到此为止。

---

## 五、执行流程

```
1. 组建 Agent Team（3 名工程师 + reviewer）
2. 三线并行排查 P0-7 / P0-8 / P0-9
3. 各自独立提交（[P0-7] / [P0-8] / [P0-9] 前缀）
4. 交叉 review
5. 重新跑 BF-2 / BF-3 / BF-4 验证修复效果
6. 推送结果等待 PM 二次判定
```

### 报告要求

每个 P0 修复完成后，在报告中包含：
1. **根因分析**：具体哪行代码、什么逻辑导致问题
2. **修复方案**：改了什么、为什么这样改
3. **全局搜索确认**：同类问题是否还有其他出现点
4. **验证结果**：修复后的实际运行截图

---

## 六、时间线

没有死线。**但修复必须彻底**。

宁可多花一天把根因找准，也不要急着交一个"看起来好了"的修复。上次 P0-2 只修了云端漏了本地就是赶工的结果。

**开始执行。**
