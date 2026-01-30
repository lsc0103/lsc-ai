# LSC-AI E2E 测试方案 V2 — 基于实际业务功能

> **制定人**：产品经理（远程 Claude Opus 4.5）
> **日期**：2026-01-30
> **原则**：只测已实现的功能，基于真实组件和选择器，不编造不存在的 UI

---

## 平台功能现状总览

| 模块 | 实现状态 | 是否需要测试 |
|------|---------|-------------|
| 登录/鉴权 | ✅ 完整 | 是 |
| 聊天对话（远程模式） | ✅ 完整 | 是（核心） |
| 流式输出 + Markdown 渲染 | ✅ 完整 | 是（核心） |
| AI 工具调用（34个工具） | ✅ 完整 | 是（核心） |
| Workbench 可视化（33个组件） | ✅ 完整 | 是（核心） |
| 会话管理（CRUD） | ✅ 完整 | 是 |
| 文件上传/附件 | ✅ 完整 | 是 |
| 侧边栏导航 | ✅ 完整 | 是 |
| Agent 配对 + 本地模式 | ✅ 完整 | 是（核心） |
| 工作空间选择（本地/云端） | ✅ 完整 | 是 |
| Memory 持久化（上下文连贯） | ✅ 完整 | 是 |
| 项目管理 | ⚠️ 仅 UI 壳 | 简单测 UI 存在性 |
| RPA/定时任务 | ⚠️ 仅 UI 壳 | 简单测 UI 存在性 |
| 设置页面 | ⚠️ 仅 UI 壳 | 简单测 UI 存在性 |
| 暗色模式 | ❌ 未实现 | 不测 |
| 搜索功能 | ❌ 未实现 | 不测 |
| 语音输入 | ❌ 未实现 | 不测 |

---

## 测试模块划分（共 7 个模块）

```
e2e/
├── M1-auth/                  # 登录鉴权（不依赖AI）
├── M2-chat-core/             # 聊天核心交互（依赖AI）
├── M3-workbench/             # Workbench可视化（依赖AI）
├── M4-session/               # 会话生命周期（部分依赖AI）
├── M5-agent/                 # Client Agent 配对+本地模式（依赖Agent）
├── M6-file-upload/           # 文件上传与附件（部分依赖AI）
├── M7-navigation/            # 侧边栏+路由+页面壳（不依赖AI）
```

---

## M1：登录鉴权（8 个测试）

**依赖**：无（纯前端 + API）
**入口组件**：`LoginPage`（`pages/Login.tsx`）
**路由守卫**：`PrivateRoute`

```
M1-01. 未登录访问 /chat → 跳转到 /login
M1-02. 未登录访问 /settings → 跳转到 /login
M1-03. 登录页渲染完整性
       - 用户名输入框存在且有 placeholder
       - 密码输入框存在且 type=password
       - 登录按钮存在
       - 页面无 JS 错误
M1-04. 空表单提交 → 表单验证提示
M1-05. 错误密码登录 → 错误提示信息
       - expect：显示错误消息（不是空白或崩溃）
       - expect：用户名输入框内容保留（不被清空）
M1-06. 正确密码登录（admin / Admin@123）
       - expect：跳转到 /chat
       - expect：localStorage 包含 lsc-ai-auth（token 存储）
M1-07. 登录后刷新页面 → 保持登录状态（token 持久化）
M1-08. 登出功能
       - 点击侧边栏底部头像 → 下拉菜单 → 退出
       - expect：跳转到 /login
       - expect：localStorage 中 lsc-ai-auth 被清除
```

---

## M2：聊天核心交互（15 个测试）

**依赖**：AI（DeepSeek），需要 ai-retry.helper.ts
**核心组件**：`ChatInput`、`MessageList`、`MessageBubble`、`WelcomeScreen`、`ToolSteps`

### M2-A：欢迎页 + 基础发送（5 个）

```
M2-01. 新会话显示欢迎页
       - expect：标题"有什么可以帮你的？"可见
       - expect：4 个建议卡片可见
       - expect：输入框 placeholder 包含"Shift+Enter"

M2-02. 点击建议卡片触发消息发送
       - 点击任一建议卡片
       - expect：欢迎页消失
       - expect：用户消息气泡出现，内容与卡片文字一致

M2-03. 手动输入发送消息
       - 输入"你好"→ 点击发送按钮（或按 Enter）
       - expect：用户消息气泡出现（蓝色，右对齐）
       - expect：AI 回复气泡出现（左对齐）
       - expect：AI 回复内容非空

M2-04. 空消息不可发送
       - 输入框为空时
       - expect：发送按钮禁用或点击无效

M2-05. Shift+Enter 换行（不发送）
       - 在输入框按 Shift+Enter
       - expect：输入框变高（多行）
       - expect：消息未发送
```

### M2-B：流式输出 + 消息渲染（5 个）

```
M2-06. 流式输出过程可观察
       - 发送消息后
       - expect：AI 消息区域出现 typing indicator 或流式文字
       - expect：最终完成后 indicator 消失

M2-07. AI 回复 Markdown 正确渲染
       - 发送"用 Markdown 格式介绍一下你自己，包含标题、列表、粗体"
       - expect：回复中有 <h1>/<h2>/<h3> 标签（标题渲染）
       - expect：回复中有 <ul>/<ol> 标签（列表渲染）
       - expect：回复中有 <strong> 标签（粗体渲染）

M2-08. AI 回复代码块渲染
       - 发送"写一段 Python hello world 代码"
       - expect：出现带语法高亮的代码块（<pre><code> 或 .code-block）
       - expect：代码块有复制按钮
       - 点击复制按钮 → expect：按钮文字变为"Copied"或出现成功提示

M2-09. AI 工具调用展示
       - 发送"帮我搜索一下 Playwright 是什么"（触发 webSearch 工具）
       - expect：ToolSteps 区域出现
       - expect：显示工具名称
       - expect：工具有状态图标（运行中 spinner → 完成 ✓）

M2-10. 停止生成按钮
       - 发送一条消息
       - expect：AI 回复过程中出现"停止"按钮
       - 点击停止 → expect：流式输出中断，按钮消失
```

### M2-C：对话上下文连贯（5 个）

```
M2-11. 多轮对话上下文连贯
       - 发送"我叫测试员小王"→ 等 AI 回复
       - 发送"我叫什么名字？"
       - expect：AI 回复包含"小王"

M2-12. 刷新页面后消息恢复
       - 在某个会话中发送消息 → 等 AI 回复
       - 刷新页面（page.reload）
       - expect：用户消息和 AI 回复都还在
       - expect：消息顺序正确

M2-13. 刷新后继续对话上下文不丢失
       - 发送"记住数字 42"→ 等 AI 回复
       - 刷新页面
       - 发送"我刚才让你记住的数字是什么？"
       - expect：AI 回复包含"42"

M2-14. 长对话滚动行为
       - 连续发送 5 条消息（每条等 AI 回复）
       - expect：消息列表自动滚动到最新消息

M2-15. 侧边栏自动生成会话标题
       - 新会话发送第一条消息
       - expect：侧边栏出现新会话条目
       - expect：标题不是空的（应自动生成）
```

---

## M3：Workbench 可视化（12 个测试）

**依赖**：AI（DeepSeek）
**核心组件**：`WorkbenchLayout`、`Workbench`、`SchemaRenderer`、各渲染组件

### M3-A：Workbench 触发与布局（4 个）

```
M3-01. AI 自动触发 Workbench
       - 发送"用 workbench 展示一段 Python 快速排序代码"
       - expect：Workbench 面板自动打开（右侧出现）
       - expect：面板中显示代码内容

M3-02. 手动打开/关闭 Workbench
       - 点击 ChatInput 中的 Appstore 图标（加号菜单 → Workbench）
       - expect：Workbench 面板出现
       - 再次点击 → expect：面板关闭

M3-03. 分屏拖拽调整宽度
       - Workbench 打开状态下
       - 拖拽中间分割线
       - expect：左右面板宽度变化（widthRatio 在 0.25-0.75 之间）

M3-04. Workbench 标签页管理
       - 让 AI 用 workbench 展示两次不同内容
       - expect：出现多个标签页
       - 点击不同标签 → expect：内容切换
```

### M3-B：内容类型渲染（5 个）

```
M3-05. 代码渲染（showCode）
       - 发送"用 showCode 展示一段 JavaScript 代码"
       - expect：Workbench 中出现 Monaco 编辑器或代码高亮区域
       - expect：有语法高亮（不是纯文本）

M3-06. 表格渲染（showTable）
       - 发送"用 showTable 展示一个3行3列的员工信息表"
       - expect：Workbench 中出现表格
       - expect：表头存在
       - expect：数据行数 ≥ 3

M3-07. 图表渲染（showChart）
       - 发送"用 showChart 画一个柱状图，数据：A=10, B=20, C=30"
       - expect：Workbench 中出现图表（canvas 或 svg 元素）

M3-08. Markdown 渲染
       - 发送"用 workbench 展示一篇 Markdown 格式的技术文档"
       - expect：Workbench 中出现渲染后的 Markdown（标题、列表等）

M3-09. 复合内容（多 Tab）
       - 发送"用 workbench 同时展示：tab1 代码，tab2 表格"
       - expect：出现多个标签页
       - expect：每个标签内容类型不同
```

### M3-C：Workbench 状态持久化（3 个）

```
M3-10. 切换会话后 Workbench 恢复
       - session1：让 AI 展示代码 → Workbench 打开
       - 新建 session2
       - 切回 session1
       - expect：Workbench 面板恢复
       - expect：内容与之前一致（代码文本包含关键内容）

M3-11. 多会话 Workbench 隔离
       - session1：展示代码
       - session2：展示表格
       - 切到 session1 → expect：是代码不是表格
       - 切到 session2 → expect：是表格不是代码

M3-12. 刷新页面后 Workbench 恢复
       - 让 AI 展示内容 → Workbench 打开
       - page.reload()
       - expect：Workbench 状态恢复（面板可见，内容存在）
```

---

## M4：会话生命周期（10 个测试）

**依赖**：部分依赖 AI
**核心组件**：`Sidebar`（会话列表）、`chat store`

```
M4-01. 新建会话
       - 点击侧边栏"新对话"按钮（PlusOutlined 图标）
       - expect：主区域显示欢迎页
       - expect：URL 变为 /chat（无 sessionId）

M4-02. 发送消息后会话出现在侧边栏
       - 新会话中发送一条消息
       - expect：侧边栏出现新的会话条目

M4-03. 切换会话加载历史消息
       - 有 2 个以上会话
       - 点击另一个会话
       - expect：消息列表更新为该会话的历史消息
       - expect：URL 包含 sessionId

M4-04. 当前会话高亮
       - 有多个会话
       - expect：当前会话在侧边栏有高亮样式（区别于其他）

M4-05. 删除会话
       - 触发会话删除（hover → 删除按钮 或 右键菜单）
       - expect：会话从侧边栏消失
       - expect：如果删除的是当前会话，跳转到欢迎页或另一个会话

M4-06. 快速切换不错乱
       - 创建 3 个会话，每个发不同内容（A: "苹果", B: "香蕉", C: "橘子"）
       - 快速在 A→B→C→A 之间切换
       - expect：每个会话显示自己的消息，不互相混淆

M4-07. 会话列表排序
       - 有多个会话
       - 在某个旧会话中发送新消息
       - expect：该会话移到列表顶部（按更新时间排序）

M4-08. 会话列表滚动
       - 创建足够多的会话（>10个）
       - expect：侧边栏会话列表可滚动
       - expect：无重叠或截断

M4-09. AI 回复中切换会话
       - 发送消息触发 AI 回复
       - AI 回复过程中切换到另一个会话
       - expect：页面不崩溃，无 JS 错误
       - expect：新会话正常显示

M4-10. AI 回复中刷新页面
       - 发送消息触发 AI 回复
       - AI 回复过程中刷新页面
       - expect：页面恢复正常
       - expect：之前的用户消息还在（AI 回复可能不完整，这是预期的）
```

---

## M5：Client Agent 配对 + 本地模式（12 个测试）

**依赖**：Client Agent CLI 必须运行
**核心组件**：`WorkspaceSelectModal`、`AgentStatusIndicator`、`AgentInstallGuide`
**核心状态**：`agent store`（`stores/agent.ts`）
**服务端**：`ChatGateway`（deviceId 路由）、`AgentGateway`（WebSocket）

> **重要前提**：运行这些测试前必须确认 Client Agent 已启动（`pnpm start` 或 `lsc-agent start`）。
> 如果 Agent 未运行，所有 M5 测试应 `test.skip('Client Agent 未运行')`，绝不能静默通过。

### M5-A：工作空间选择 UI（4 个）

```
M5-01. 打开工作空间选择弹窗
       - 组件入口：ChatInput 中的文件夹图标（加号菜单 → "选择工作目录"）
       - 点击后 → expect：WorkspaceSelectModal 弹窗打开（.ant-modal 可见）
       - expect：Radio 选项"本地电脑"和"云端服务器"可见

M5-02. 选择"云端服务器"模式
       - 打开弹窗 → 选择"云端服务器"
       - 输入工作目录路径（如 /workspace）
       - 点击确认
       - expect：弹窗关闭
       - expect：AgentStatusIndicator 显示云端模式

M5-03. 选择"本地电脑"模式 — 无已配对设备
       - 打开弹窗 → 选择"本地电脑"
       - 如果没有已配对设备：
         - expect：显示"安装 Client Agent"按钮或空设备列表

M5-04. 退出工作空间
       - 已选择工作空间后
       - 点击 AgentStatusIndicator 上的"退出"按钮
       - expect：回到默认状态（无工作空间选择）
       - expect：agent store 的 currentDeviceId 和 workDir 被清空
```

### M5-B：Agent 配对流程（3 个）

```
M5-05. 安装引导弹窗
       - 点击"安装 Client Agent"
       - expect：AgentInstallGuide 弹窗打开
       - expect：显示分步骤引导（Steps 组件）
       - expect：有下载说明（根据操作系统）

M5-06. 生成配对码
       - 在安装引导的配对步骤
       - expect：显示 6 位数配对码
       - expect：配对码格式正确（6 位数字）

M5-07. 设备列表显示
       - Agent 已配对且在线
       - 打开工作空间选择弹窗 → 选择"本地电脑"
       - expect：设备列表中显示已配对设备
       - expect：设备信息包含设备名、状态（在线/离线）
```

### M5-C：本地模式核心功能（5 个）

```
M5-08. 切换到本地模式并发送消息
       - 选择已配对的在线设备 + 工作目录
       - 确认进入本地模式
       - 发送"你好，我在本地模式下"
       - expect：AI 回复出现（来自 Client Agent）
       - expect：消息不为空

M5-09. 本地模式执行文件操作
       - 本地模式下发送"在工作目录下创建一个文件 test-e2e.txt，内容是 hello"
       - expect：AI 回复包含工具调用步骤（ToolSteps 可见）
       - expect：工具执行状态显示成功

M5-10. 本地模式执行 Shell 命令
       - 本地模式下发送"运行 ls 命令看看当前目录"
       - expect：AI 回复包含目录列表内容

M5-11. 远程→本地模式切换上下文连贯
       - 在远程模式下发送"记住密码是 test123"→ 等 AI 回复
       - 切换到本地模式（通过 WorkspaceSelectModal）
       - 在同一会话中发送"我刚才让你记住的密码是什么？"
       - expect：AI 回复包含"test123"
       - 注意：上下文通过 server 的 Mastra Memory 的 history 传递

M5-12. Agent 离线状态感知
       - Agent 在线时查看设备状态 → expect：显示"在线"
       - 停止 Client Agent 进程
       - 刷新设备列表
       - expect：设备状态变为"离线"
       - 尝试在本地模式下发送消息
       - expect：有错误提示（而非无限等待）
```

---

## M6：文件上传与附件（6 个测试）

**依赖**：AI + MinIO 存储
**核心组件**：`ChatInput`（文件上传）、`MessageBubble`（附件显示）

```
M6-01. 上传文件入口
       - 点击 ChatInput 加号菜单 → "添加文件"
       - expect：文件选择器打开

M6-02. 上传图片并发送
       - 选择一张图片文件
       - expect：输入框下方显示文件列表（文件名 + 大小）
       - expect：有删除按钮可移除文件
       - 发送消息
       - expect：用户消息气泡中显示图片预览

M6-03. 上传多个文件
       - 选择 2-3 个文件
       - expect：所有文件都显示在列表中
       - 发送消息
       - expect：所有文件附件显示在消息中

M6-04. 移除待上传文件
       - 选择文件后，点击文件旁的删除按钮
       - expect：文件从列表中移除

M6-05. AI 针对上传文件的回复
       - 上传一个文本文件并发送"帮我分析这个文件"
       - expect：AI 回复中引用或分析了文件内容

M6-06. 文件大小限制
       - 上传超过 10MB 的文件
       - expect：显示错误提示（大小限制）
```

---

## M7：侧边栏 + 路由 + 页面壳（10 个测试）

**依赖**：无（纯前端）
**核心组件**：`Sidebar`、`MainLayout`、各页面组件

### M7-A：侧边栏交互（5 个）

```
M7-01. 侧边栏折叠/展开
       - 点击折叠按钮
       - expect：侧边栏宽度变窄（~56px）
       - expect：导航文字隐藏，只剩图标
       - 再次点击 → expect：展开恢复

M7-02. 导航到项目页面
       - 点击侧边栏"我的项目"（FolderOutlined）
       - expect：URL 变为 /projects
       - expect：页面显示"我的项目"标题

M7-03. 导航到任务页面
       - 点击侧边栏"RPA/任务"（ClockCircleOutlined）
       - expect：URL 变为 /tasks
       - expect：页面显示两个 Tab："定时任务"和"RPA 流程"

M7-04. 导航到设置页面
       - 点击底部头像 → 下拉菜单 → "设置"
       - expect：URL 变为 /settings
       - expect：显示用户名、显示名输入框

M7-05. 从其他页面回到聊天
       - 在 /projects 页面
       - 点击侧边栏"新对话"
       - expect：URL 变为 /chat
       - expect：显示欢迎页
```

### M7-B：页面壳验证（3 个）

```
M7-06. 项目页面 UI 壳
       - 导航到 /projects
       - expect："创建项目"按钮存在
       - expect：空状态提示存在
       - expect：页面无 JS 错误

M7-07. 任务页面 UI 壳
       - 导航到 /tasks
       - expect：Tab 组件存在（定时任务 / RPA 流程）
       - expect：空状态提示存在
       - expect：页面无 JS 错误

M7-08. 设置页面 UI 壳
       - 导航到 /settings
       - expect：用户名显示为"admin"
       - expect：显示名输入框存在
       - expect：保存按钮存在
```

### M7-C：路由守卫（2 个）

```
M7-09. 未登录访问任意受保护路由 → 跳转登录
       - 清除 localStorage
       - 直接访问 /chat、/projects、/tasks、/settings
       - expect：全部跳转到 /login

M7-10. 访问不存在的路由 → 跳转首页
       - 登录后访问 /nonexistent
       - expect：跳转到 / (→ /chat)
```

---

## 测试用例汇总

| 模块 | 用例数 | 依赖 | 优先级 |
|------|--------|------|--------|
| M1 登录鉴权 | 8 | 无 | P0 |
| M2 聊天核心 | 15 | AI | P0 |
| M3 Workbench | 12 | AI | P0 |
| M4 会话生命周期 | 10 | 部分AI | P0 |
| M5 Client Agent | 12 | Agent+AI | P0 |
| M6 文件上传 | 6 | AI+MinIO | P1 |
| M7 导航路由 | 10 | 无 | P1 |
| **总计** | **73** | | |

---

## 执行策略

### 执行顺序（严格按此顺序）

```bash
# 第1轮：不依赖AI的纯前端测试（应100%稳定）
npx playwright test e2e/M1-auth/
npx playwright test e2e/M7-navigation/

# 第2轮：AI相关核心测试（逐个跑，避免限流）
npx playwright test e2e/M2-chat-core/ --workers=1
npx playwright test e2e/M3-workbench/ --workers=1

# 第3轮：会话管理测试
npx playwright test e2e/M4-session/ --workers=1

# 第4轮：文件上传测试
npx playwright test e2e/M6-file-upload/ --workers=1

# 第5轮：Client Agent 测试（必须先确认 Agent 在运行）
npx playwright test e2e/M5-agent/ --workers=1
```

### 关键规则

**1. 每个测试必须有 expect 断言**
```typescript
// ❌ 禁止
console.log('结果:', result);

// ✅ 必须
expect(result).toBeTruthy();
```

**2. 功能不可用时用 test.skip**
```typescript
// ❌ 禁止
if (!agentOnline) {
  console.log('Agent not available');
  return; // 测试永远通过
}

// ✅ 必须
test.skip(!agentOnline, 'Client Agent 未运行');
```

**3. AI 回复使用 sendAndWaitWithRetry**
```typescript
const { hasResponse, responseText } = await sendAndWaitWithRetry(page, '你好', {
  timeout: 60000,
  retries: 2,
});
// 如果AI确实不回复，这里会失败，不会假装通过
expect(hasResponse).toBe(true);
expect(responseText).not.toBe('');
```

**4. 选择器必须基于真实组件**

写测试前必须先读源码确认选择器，不要编造。关键选择器参考：

| 需要找的元素 | 到哪个文件确认 |
|------------|---------------|
| 登录表单 | `pages/Login.tsx` |
| 输入框/发送按钮 | `components/chat/ChatInput.tsx` |
| 消息气泡 | `components/chat/MessageBubble.tsx` |
| 工具调用展示 | `components/chat/ToolSteps.tsx` |
| 欢迎页/建议卡片 | `components/chat/WelcomeScreen.tsx` |
| Workbench 面板 | `components/workbench/Workbench.tsx` |
| 侧边栏 | `components/layout/Sidebar.tsx` |
| 工作空间弹窗 | `components/agent/WorkspaceSelectModal.tsx` |
| Agent 状态指示 | `components/agent/AgentStatusIndicator.tsx` |
| 安装引导 | `components/agent/AgentInstallGuide.tsx` |

**5. 截图规则**
- 每个测试无论成败都截图（在 test-base.ts 的 afterEach 中已实现）
- AI 相关测试在发送消息前后各截一次
- 发现 UI 异常立即额外截图

**6. headed 模式复查**

以下测试必须至少用 headed 模式跑一次，人眼确认 UI 表现：

```bash
npx playwright test e2e/M2-chat-core/ --headed --slow-mo=500 --workers=1
npx playwright test e2e/M3-workbench/ --headed --slow-mo=500 --workers=1
npx playwright test e2e/M5-agent/ --headed --slow-mo=500 --workers=1
```

---

## 与现有测试的关系

现有的 169 个测试不需要全部废弃。处理方式：

| 现有测试 | 处理 |
|---------|------|
| api-health/ (8) | 保留 |
| auth/ (5) | 合并到 M1 |
| chat-core/ (6) | 合并到 M2 |
| chat-history/ (4) | 合并到 M4 |
| chat-realflow/ (8) | 合并到 M2 |
| session-management/ (6) | 合并到 M4 |
| workbench/ (4) + workbench-real/ (7) | 合并到 M3 |
| agent/ (2) | 合并到 M5 |
| tools-verify/ (26) | 保留（API层验证） |
| memory-verify/ (8) | 保留（API层验证） |
| frontend-full/ (20) | 拆分到对应模块 |
| ui/ 新增 (29) | 修复空壳后归入对应模块 |
| scenario/ 新增 (41) | 重写后归入对应模块 |

**优先级**：先按本方案写新测试，再逐步合并旧测试。不要一边修旧一边写新。

---

## 验收标准

1. 73 个测试全部有 `expect` 断言（零空壳）
2. M1 + M7（纯前端）通过率 100%
3. M2 + M3 + M4（AI 相关）通过率 ≥ 90%（允许 DeepSeek 偶尔超时导致的 skip）
4. M5（Agent）在 Agent 运行时通过率 ≥ 80%
5. 每个模块至少 headed 模式跑一次并截图
