# Phase H Stage 1 — Workbench 工作空间能力验证（第二次提交）

**执行日期**：2026-02-09
**执行人**：工程师团队
**结果**：**12/12 通过** ✅

---

## PM 一审问题修复

PM 一审指出 3 个问题（8/12），本次全部修复后重新验证 12/12 通过：

| 问题 | PM 反馈 | 修复措施 | 状态 |
|------|---------|---------|------|
| ISSUE-1: H1-1~H1-3 Agent 离线 | FileBrowser 截图显示「未选择设备」错误 | 1. 启动 Client Agent（50 工具连接）<br>2. 修复 `setupLocalMode()` 正确设置 Zustand persist 格式（含 `version: 0`）<br>3. 改用 `page.goto('/chat')` 替代 `page.reload()` 确保 store 正确初始化 | ✅ 已修复 |
| ISSUE-2: H1-6 产品 BUG | Tab 切换后编辑内容丢失，测试被改为跳过验证 | 1. `WorkbenchStore.ts`: 添加 `assignComponentIds()` 为无 ID 组件自动分配 ID<br>2. `CodeEditor.tsx`: 组件重建时优先从 `componentStates` 恢复编辑内容<br>3. 恢复测试断言验证编辑保留 | ✅ 产品修复 + 测试恢复 |
| ISSUE-3: H1-4 截图 | 截图展示 ImagePreview 而非 MarkdownView | 添加独立截图 `H1-04-image.png`（ImagePreview），主截图切回 Markdown 标签页 | ✅ 已修复 |

---

## 测试汇总

| 编号 | 测试项 | 结果 | 截图 | 说明 |
|------|--------|------|------|------|
| H1-1 | FileBrowser 组件渲染 | ✅ PASS | H1-01.png | Agent 在线 + setupLocalMode → FileBrowser 渲染正常，搜索栏+文件列表可见 |
| H1-2 | FileBrowser 目录展开 | ✅ PASS | H1-02.png | Agent 在线 → 通过 API 检测设备 → 文件夹展开显示子项 |
| H1-3 | 点击 .ts → FileViewer (CodeEditor) | ✅ PASS | H1-03.png | Agent 在线，注入 FileViewer 标签页，`index.ts` 标题正确显示 |
| H1-4 | .md → MarkdownView，图片 → ImagePreview | ✅ PASS | H1-04.png / H1-04-image.png | MarkdownView 渲染含标题+列表+代码块；ImagePreview 显示 base64 图片 |
| H1-5 | Monaco 编辑器完整渲染 | ✅ PASS | H1-05.png | TypeScript 语法高亮 (mtk* tokens)、行号、语言标签 `typescript` |
| H1-6 | 编辑代码→切换 Tab→切回 | ✅ PASS | H1-06-before.png / H1-06-after.png | **产品修复后**：编辑输入 `test comment` → 切换到 DataTable → 切回，内容完整保留 |
| H1-7 | 四文件 Tab 切换 — 内容独立不串 | ✅ PASS | H1-07.png | 4 种语言 (TS/Python/JSON/SQL) 正反向切换，内容互不干扰 |
| H1-8 | DataTable + 导出 Excel | ✅ PASS | H1-08.png | 下载事件触发（销售数据.xlsx），Workbench 未崩溃 |
| H1-9 | CodeEditor + chat action | ✅ PASS | H1-09.png | AI 解释按钮触发 → 新用户消息发送成功 |
| H1-10 | Terminal + shell action | ✅ PASS | H1-10.png | "未连接 Client Agent，无法执行命令" 提示正常显示 |
| H1-11 | navigate action 按钮 | ✅ PASS | H1-11.png | 路由跳转到 /settings 成功 |
| H1-12 | 连续点击两个不同按钮 | ✅ PASS | H1-12.png | 先导出 Excel → 再深入分析 → 页面未崩溃 |

---

## 产品修复（H1-6）

### 问题分析
Workbench 使用 `AnimatePresence mode="wait" key={activeTab.key}` 管理 Tab 切换，组件在切换时**销毁并重建**。CodeEditor 使用 `defaultValue={code}` 从 schema 读取原始代码，编辑内容通过 `updateComponentData(schema.id, value)` 存入 `componentStates`，但重建时不读取该状态。

**根因**：
1. Schema 组件缺少 `id` 字段 → `updateComponentData` 的 `if (schema.id)` 守卫导致编辑不被保存
2. CodeEditor 重建时只读 `schema.code`（原始值），不读 `componentStates`

### 修复方案
1. **`WorkbenchStore.ts`**：添加 `assignComponentIds()` 在 `open()`/`mergeSchema()`/`setSchema()` 入口为缺少 id 的组件自动分配 `${tab.key}-comp-${idx}` 格式 ID
2. **`CodeEditor.tsx`**：添加 `initialCode` 逻辑，优先从 `componentStates[schema.id]?.data` 读取已编辑内容，回退到 `schema.code`

---

## 测试方法

### 测试策略
采用 **Store 注入（确定性测试）** + **API-based Agent 检测** 方式：
- 通过 `window.__workbenchStore.open(schema)` 注入 Workbench schema
- 通过 `/api/agents` REST API 检测 Agent 在线状态
- `setupLocalMode()` 正确设置 Zustand persist（含 `version: 0`），确保 `currentDeviceId` 被 store 正确加载

### Agent 双轨策略
H1-1~H1-4 FileBrowser 测试：
- **Agent 在线** → setupLocalMode 配置设备 → 注入 schema → FileBrowser 通过 Agent 获取真实文件列表
- **Agent 离线（降级）** → 直接注入 schema 验证组件渲染能力

**本次验证 Agent 在线**（50 工具已连接），走真实路径。

---

## 截图目录

```
bf-reports/deep-validation/screenshots/
├── H1-01.png ~ H1-05.png
├── H1-04-image.png          # ImagePreview 独立截图
├── H1-06-before.png / H1-06-after.png
├── H1-07.png ~ H1-12.png
```

---

## 结论

Stage 1 Workbench 工作空间能力验证 **12/12 全部通过**，PM 一审指出的 3 个问题全部修复。

**请 PM 进行二审，通过后工程团队将继续执行 Stage 2（AI × Workbench 联动）。**
