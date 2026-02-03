# LSC-AI E2E 测试指导方案 — 真实用户体验场景

> **目标**：以真实用户的视角全面测试 LSC-AI 平台，不仅验证功能结果，更关注过程中的 UI 表现、交互体验、状态管理。
> **原则**：把自己当成一个真正的用户，像人一样使用这款 AI 产品，发现那些"功能能用但体验不好"的问题。

---

## 第一部分：测试架构重构

### 1.1 问题诊断

最新一轮测试 17/102 失败，根因分析：
- **截图显示 AI 没有回复**（只有蓝色用户气泡，没有 AI 回复气泡）
- 这是 DeepSeek API 限流或超时导致的，不是代码 bug
- 但测试没有对"AI 无回复"做容错，直接断言失败

### 1.2 测试分层改造

将现有测试分为两层，互不影响：

```
e2e/
├── ui/                    ← 纯前端测试（不依赖 AI 回复，稳定可靠）
│   ├── auth.spec.ts
│   ├── sidebar.spec.ts
│   ├── chat-ui.spec.ts
│   ├── workbench-ui.spec.ts
│   ├── routing.spec.ts
│   └── responsive.spec.ts
│
├── ai/                    ← AI 集成测试（依赖 DeepSeek，可能限流）
│   ├── chat-realflow.spec.ts
│   ├── tools-verify.spec.ts
│   ├── memory-verify.spec.ts
│   └── workbench-real.spec.ts
│
├── scenario/              ← 真实场景测试（本方案新增重点）
│   ├── user-journey.spec.ts       # 完整用户旅程
│   ├── mode-switch.spec.ts        # 远程/本地模式切换
│   ├── session-lifecycle.spec.ts  # 会话生命周期
│   ├── workbench-state.spec.ts    # Workbench 状态管理
│   └── agent-integration.spec.ts  # Client Agent 交互
│
└── helpers/
    ├── ai-retry.helper.ts  ← 新增：AI 回复重试机制
    └── ...existing...
```

### 1.3 AI 回复重试机制

创建 `e2e/helpers/ai-retry.helper.ts`，所有依赖 AI 回复的测试都用它：

```typescript
/**
 * 发送消息并等待 AI 回复，带重试机制
 * 解决 DeepSeek API 限流导致的测试不稳定问题
 */
export async function sendAndWaitWithRetry(
  page: Page,
  message: string,
  options: {
    timeout?: number;      // 单次等待超时，默认 60s
    retries?: number;      // 重试次数，默认 2
    retryDelay?: number;   // 重试间隔，默认 5s
    expectResponse?: boolean; // 是否必须有 AI 回复
  } = {}
): Promise<{ hasResponse: boolean; responseText: string }> {
  // 实现：发送 → 等待 → 超时重试 → 返回结果
}
```

---

## 第二部分：真实用户旅程测试（重点新增）

### 2.1 新用户首次使用旅程 — `user-journey.spec.ts`

**模拟场景**：一个新员工第一次打开 LSC-AI，从登录到完成一个实际任务。

```
测试流程：
1. 打开 localhost:5173 → 应该跳转到登录页
2. 看到登录页 → UI 检查：
   - logo 是否显示？
   - 输入框是否有 placeholder？
   - 按钮文字是否正确？
   - 页面是否有明显的样式错乱？
3. 输入错误密码 → 错误提示是否友好？是否有抖动动画？错误后输入框是否保留用户名？
4. 输入正确密码登录 →
   - 登录按钮是否显示 loading 状态？
   - 跳转是否流畅？有没有白屏闪烁？
5. 进入主界面 →
   - 侧边栏是否正常渲染？
   - 欢迎页是否显示？
   - 建议卡片是否可点击？
   - 整体布局有无溢出、重叠、滚动条异常？
6. 点击建议卡片发送第一条消息 →
   - 输入框内容是否被建议文本填充？
   - 发送后欢迎页是否消失？
   - 用户消息气泡是否立即出现？
   - AI 回复开始前是否有 loading/typing 指示？
   - 流式输出过程中文字是否逐字/逐句出现？（不是突然出现一大段）
   - 流式输出过程中是否显示"停止生成"按钮？
   - 输出完成后"停止生成"按钮是否消失？
   - 侧边栏是否自动出现了这个会话的标题？
7. 继续对话，发送"帮我写一个 Python 快速排序" →
   - AI 是否调用了 Workbench 工具？
   - Workbench 面板是否自动打开？
   - 代码是否有语法高亮？
   - 代码块是否有复制按钮？点击复制是否有反馈？
8. 点击侧边栏"新对话" →
   - 是否创建了新会话？
   - 主区域是否回到欢迎页？
   - Workbench 是否关闭或清空？
   - URL 是否变化？
9. 切回刚才的历史对话 →
   - 之前的消息是否完整加载？
   - 加载过程是否有 loading 指示？
   - Workbench 之前的代码是否恢复？
   - 滚动位置是否在最新消息处？
```

**关键 UI 检查点（每一步都要验证）**：
- 有没有 console error？（`page.on('console', ...)` 捕获）
- 有没有网络请求失败？（`page.on('requestfailed', ...)` 捕获）
- 页面有没有未捕获的 JS 错误？
- 布局有没有溢出（元素超出可视区域）？
- 文字有没有截断（overflow:hidden 导致看不到完整文字）？

### 2.2 远程/本地模式切换 — `mode-switch.spec.ts`

**这是你特别强调的核心场景：**

```
场景 A：远程模式 → 本地模式 → 上下文连贯
1. 创建 session1，在远程模式下发送："我叫测试员小王，正在开发一个船舶管理系统"
2. 等待 AI 回复
3. 切换到本地模式（点击 Agent 切换按钮/下拉菜单）
   - UI 检查：切换按钮在哪？是否容易找到？
   - 切换时是否有 loading？
   - 切换后标题/状态栏是否显示"本地模式"？
4. 在本地模式下发送："你还记得我叫什么名字吗？我在做什么项目？"
5. 验证 AI 回复包含"小王"和"船舶"
   - 如果上下文不连贯 → 这是一个 bug

场景 B：有 Workbench 的会话切换
1. session1 远程模式下发送："用 workbench 展示一段 Python 代码"
2. 确认 Workbench 打开，代码显示
3. 新建 session2
4. 在 session2 发送一条普通消息
5. 切回 session1
   - Workbench 面板是否恢复？
   - 代码内容是否完整？
   - 对话消息是否完整？
   - 是否有闪烁或重新加载的感觉？

场景 C：快速切换压力测试
1. 创建 3 个不同会话，每个发一条不同内容的消息
2. 快速在 3 个会话间来回切换（模拟用户快速点击）
3. 验证：
   - 每个会话的消息不会错乱（session1 的消息不会出现在 session2 里）
   - 没有 JS 错误
   - 没有白屏
   - 没有无限 loading
```

### 2.3 会话生命周期 — `session-lifecycle.spec.ts`

```
完整生命周期测试：
1. 创建新会话 → 验证 URL、侧边栏
2. 发送消息 → 验证消息和 AI 回复
3. 刷新页面 → 验证消息完整恢复
   - 用户消息还在吗？
   - AI 回复还在吗？
   - Workbench 还在吗？
   - 加载过程有没有闪烁？
4. 重命名会话 → 侧边栏标题是否立即更新？
5. 发送更多消息 → 会话时间排序是否更新？
6. 删除会话 →
   - 确认弹窗是否出现？
   - 删除后跳转到哪？（应该跳到欢迎页或其他会话）
   - 侧边栏列表是否立即移除？
   - 有没有误删其他会话？

特殊场景：
- 在 AI 正在回复时删除会话 → 会怎样？
- 在 AI 正在回复时刷新页面 → 回来后消息是否完整？
- 在 AI 正在回复时切换到其他会话 → 原会话的回复是否继续？切回来是否正常？
```

### 2.4 Workbench 状态管理 — `workbench-state.spec.ts`

```
场景 1：Workbench 内容持久化
1. 让 AI 用 workbench 工具展示代码
2. 记录 Workbench 内容
3. 切到新会话
4. 切回原会话
5. 验证 Workbench 内容是否完整恢复

场景 2：多会话各有 Workbench
1. session1：让 AI 展示 Python 代码
2. session2：让 AI 展示数据表格
3. session3：让 AI 展示图表
4. 切回 session1 → 应该是 Python 代码，不是表格
5. 切到 session2 → 应该是表格，不是代码
6. 切到 session3 → 应该是图表

场景 3：Workbench 交互
1. 让 AI 展示代码
2. 在 Workbench 中编辑代码 → 修改是否能保存？
3. 切换标签页 → 切回来内容是否保留？
4. 关闭 Workbench 面板 → 重新打开是否恢复？
5. 拖拽调整 Workbench 面板宽度 → 是否记住宽度？

场景 4：Workbench UI 细节
1. 代码块 → 语法高亮是否正确？行号是否显示？
2. 表格 → 列宽是否合理？数据是否对齐？有没有横向滚动？
3. 图表 → 是否有 tooltip？是否可交互？图例是否显示？
4. Markdown → 标题层级是否正确？链接是否可点击？
```

### 2.5 Client Agent 交互 — `agent-integration.spec.ts`

```
前提：需要本地 Client Agent 同时运行

场景 1：配对流程
1. 打开 LSC-AI 平台
2. 点击 Agent 相关入口（在哪？是否容易找到？）
3. 应该显示配对码或设备列表
4. 在本地运行 client-agent pair
5. 配对成功后 UI 如何反馈？状态指示器是否变绿？

场景 2：本地工具执行
1. 配对成功后，切换到本地模式
2. 发送："在桌面创建一个文件 test.txt，内容是 hello"
3. 验证：
   - AI 是否正确调用了 client agent 的工具？
   - 工具执行过程是否有进度指示？
   - 执行结果是否在对话中显示？
   - 本地是否真的创建了文件？

场景 3：断连处理
1. 配对成功后关闭 client-agent
2. 发送需要本地工具的消息
3. 验证：
   - 是否有友好的错误提示（而不是无限等待）？
   - 状态指示器是否变为离线？
   - 重新启动 client-agent 后是否自动重连？
```

---

## 第三部分：UI 细节检查清单

### 3.1 每个测试用例都应该检查的通用项

```typescript
// 在 test-base.ts 中添加全局检查
test.afterEach(async ({ page }, testInfo) => {
  // 1. 检查控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // 2. 检查网络请求失败（排除已知的可选请求）
  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
  });

  // 3. 检查页面有没有明显的布局问题
  const hasOverflow = await page.evaluate(() => {
    const body = document.body;
    return body.scrollWidth > window.innerWidth || body.scrollHeight > window.innerHeight * 1.5;
  });

  // 4. 截图保存（无论成功失败都保存，方便人工复查）
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.title}.png`,
    fullPage: true
  });
});
```

### 3.2 具体 UI 检查项

**登录页：**
- [ ] 输入框 focus 时有没有高亮边框？
- [ ] 密码框是否为 password 类型（显示圆点不是明文）？
- [ ] 按 Enter 是否能提交？还是必须点按钮？
- [ ] 记住密码功能是否存在？

**聊天界面：**
- [ ] 消息气泡的圆角、阴影、间距是否统一？
- [ ] 用户消息（蓝色）和 AI 消息的对齐方向是否正确？
- [ ] 长消息是否有合理的换行？（不是一行顶到底）
- [ ] 代码块内的代码是否有横向滚动？（不能超出气泡宽度）
- [ ] 复制代码按钮是否存在且可用？
- [ ] AI 回复中的 Markdown 是否正确渲染？（标题、列表、粗体、链接）
- [ ] 输入框是否支持多行？Shift+Enter 换行是否正常？
- [ ] 输入框为空时发送按钮是否禁用/变灰？
- [ ] 消息列表滚动到底部是否自动跟随新消息？
- [ ] 手动上滚后新消息是否不强制滚动到底（打断用户阅读）？

**侧边栏：**
- [ ] 会话列表过多时是否有滚动？滚动是否流畅？
- [ ] 长标题是否有省略号（...）？hover 时是否显示完整标题？
- [ ] 删除按钮是否需要二次确认？
- [ ] 当前选中的会话是否有高亮样式？
- [ ] 搜索功能是否存在？是否可用？

**Workbench：**
- [ ] 面板打开/关闭动画是否流畅？
- [ ] 面板和聊天区域的分割线是否可拖拽？
- [ ] 标签页是否可切换？切换时内容是否立即更新？
- [ ] 代码编辑器是否使用了 Monaco？是否有语法高亮？
- [ ] 表格是否可排序/筛选？
- [ ] 图表是否可交互（hover tooltip）？

---

## 第四部分：测试执行建议

### 4.1 执行顺序

```bash
# 第一步：纯 UI 测试（不依赖 AI，100% 稳定）
npx playwright test e2e/ui/

# 第二步：用户旅程测试（依赖 AI，逐个跑）
npx playwright test e2e/scenario/user-journey.spec.ts

# 第三步：场景测试（核心，逐个跑）
npx playwright test e2e/scenario/mode-switch.spec.ts
npx playwright test e2e/scenario/session-lifecycle.spec.ts
npx playwright test e2e/scenario/workbench-state.spec.ts

# 第四步：Agent 交互测试（需要 client-agent 同时运行）
npx playwright test e2e/scenario/agent-integration.spec.ts

# 第五步：AI 集成测试（分组跑，避免限流）
npx playwright test e2e/ai/tools-verify.spec.ts --grep "Workbench"
npx playwright test e2e/ai/tools-verify.spec.ts --grep "文件操作"
# ...每组间隔 30 秒
```

### 4.2 headed 模式观察

**关键测试必须用 headed 模式跑一次**，人眼观察过程：

```bash
npx playwright test e2e/scenario/user-journey.spec.ts --headed --slow-mo=500
```

`--slow-mo=500` 会让每个操作慢 500ms，你能清楚看到：
- 页面加载是否有白屏？
- 动画是否流畅？
- 元素是否有闪烁？
- 布局是否有跳动（CLS）？

### 4.3 发现 bug 的处理

每发现一个 bug：
1. 立即截图 → 保存到 `bug/` 目录
2. 创建 `bug/bug-{编号}.md`，记录：
   - 复现步骤
   - 期望行为 vs 实际行为
   - 截图路径
   - 严重程度（P0/P1/P2）
3. 更新 `CLAUDE.md` 第五节「已知问题」
4. 如果是可以立即修复的 → 修复 → 重跑测试验证

### 4.4 测试报告要求

每次测试完成后，生成一份摘要写入 `.claude/dev-log.md`：

```
## [日期] | 场景测试第 N 轮

**运行模式**：headed / headless
**测试范围**：用户旅程 / 模式切换 / 会话生命周期 / ...
**结果**：X passed / Y failed / Z skipped

**发现的 UI 问题**：
1. [P1] 对话切换时 Workbench 内容闪烁一下再恢复
2. [P2] 侧边栏会话标题过长没有省略号

**发现的功能 bug**：
1. [P0] 远程模式切换到本地模式后上下文丢失

**过程观察**（headed 模式）：
- 登录后有 ~200ms 白屏
- 流式输出较流畅，无明显卡顿
- Workbench 面板打开动画偏快，没有过渡效果
```

---

## 第五部分：测试用例数量预估

| 测试模块 | 预估用例数 | 性质 |
|---------|-----------|------|
| user-journey | 15-20 | 全流程串行 |
| mode-switch | 8-10 | 核心场景 |
| session-lifecycle | 10-12 | 生命周期 |
| workbench-state | 10-12 | 状态管理 |
| agent-integration | 8-10 | Agent 交互 |
| UI 细节检查 | 20-25 | 纯前端 |
| **新增总计** | **71-89** | |
| 现有保留 | ~50 | 基础+AI |
| **总计** | **~150** | |

---

## 总结

这套测试方案和现有测试的核心区别：

1. **现有测试**：检查"结果对不对"（AI 回复了吗、元素存在吗）
2. **本方案**：检查"过程好不好"（动画流畅吗、布局跳动吗、交互自然吗、状态一致吗）

现有测试是"工程师视角"——功能能跑就行。
本方案是"用户视角"——体验要好，状态要连贯，操作要自然。
