# 第5轮测试代码审查报告 + 工程师测试指导

> **审查人**：产品经理（远程 Claude Opus 4.5）
> **审查日期**：2026-01-30
> **审查范围**：第5轮新增 67 个测试用例（10 个文件）
> **总体评价**：⚠️ 测试覆盖面不错，但约 36% 的测试是"永远通过"的空壳，Client Agent 完全未测试

---

## 一、审查结论

| 指标 | 数值 | 评价 |
|------|------|------|
| 新增测试数 | 67 | ✅ 数量达标 |
| 有效测试数 | ~43 | ⚠️ 只有 64% 有真实断言 |
| 空壳测试数 | ~24 | ❌ 36% 用 console.log 代替 expect |
| Client Agent 测试 | 0 | ❌ 完全缺失 |
| agent-integration.spec.ts | 未创建 | ❌ 测试指南中规划了但没实现 |

---

## 二、逐文件审查

### 2.1 ✅ 质量合格的文件

**`e2e/helpers/ai-retry.helper.ts`** — 好
- sendAndWaitWithRetry 实现了重试机制，解决 DeepSeek 限流问题

**`e2e/fixtures/test-base.ts`** — 好
- afterEach 自动截图 + console error 收集 + request fail 收集

**`e2e/ui/auth.spec.ts`** (6 tests) — 好
- 登录页 UI 检查，断言扎实

**`e2e/ui/routing.spec.ts`** (6 tests) — 较好
- 路由守卫测试，大部分有断言

**`e2e/ui/chat-ui.spec.ts`** (10 tests) — 较好
- 聊天界面 UI，大部分有断言

### 2.2 ⚠️ 有问题的文件

**`e2e/ui/sidebar.spec.ts`** (7 tests)
- 问题：部分测试只检查元素存在，没验证交互结果
- 修复要求：删除会话后需验证列表数量减少

**`e2e/scenario/user-journey.spec.ts`** (15 tests)
- 问题：**~6 个测试用 console.log 代替 expect**
- 典型问题代码模式：
  ```typescript
  // ❌ 错误 — 这永远不会失败
  const panel = page.locator('.workbench-panel');
  if (await panel.isVisible()) {
    console.log('Workbench panel visible');  // 应该是 expect
  } else {
    console.log('Workbench not triggered');  // 这也不会导致测试失败
  }

  // ✅ 正确 — 这会在异常时报错
  await expect(page.locator('.workbench-panel')).toBeVisible({ timeout: 30000 });
  ```
- 修复要求：所有 console.log 检查点改为 expect 断言

**`e2e/scenario/session-lifecycle.spec.ts`** (10 tests)
- 问题：特殊场景（AI回复中删除/刷新/切换）只有 console.log
- 修复要求：至少验证操作后页面不崩溃（no JS error），会话状态正确

**`e2e/scenario/workbench-state.spec.ts`** (8 tests)
- 问题：AI 不回复时静默跳过，不是 test.skip()
- 问题：Workbench 内容恢复只检查面板存在，没验证内容一致
- 修复要求：
  - AI 不回复 → 用 test.skip('AI not responding') 而不是 return
  - 内容恢复 → 验证代码文本包含关键内容

### 2.3 ❌ 严重问题的文件

**`e2e/scenario/mode-switch.spec.ts`** (8 tests) — **基本是空壳**
- **5/8 个测试没有任何 expect 断言**
- 所有涉及 Agent 的逻辑都是 `console.log('Agent not available')` 然后通过
- 没有启动 Client Agent，没有测试配对流程
- 没有测试远程→本地切换后上下文连贯性
- **这个文件等于没写**

**`e2e/scenario/agent-integration.spec.ts`** — **未创建**
- 测试指南中明确规划了，但完全没有实现
- 配对流程、本地工具执行、断连处理 — 全部缺失

---

## 三、必须修复的问题清单

### P0 — 必须立即修复

| # | 文件 | 问题 | 修复方式 |
|---|------|------|---------|
| 1 | mode-switch.spec.ts | 5/8 测试无断言 | 启动 Client Agent，编写真实的模式切换测试 |
| 2 | agent-integration.spec.ts | 完全未创建 | 新建文件，实现配对/工具执行/断连测试 |
| 3 | user-journey.spec.ts | ~6 处 console.log 代替 expect | 全部替换为 expect 断言 |

### P1 — 必须修复

| # | 文件 | 问题 | 修复方式 |
|---|------|------|---------|
| 4 | workbench-state.spec.ts | AI 不回复时静默 return | 改为 test.skip() 并注明原因 |
| 5 | workbench-state.spec.ts | 内容恢复只查面板不查内容 | 添加 textContent 断言 |
| 6 | session-lifecycle.spec.ts | 特殊场景缺断言 | 添加页面不崩溃 + 状态正确断言 |
| 7 | sidebar.spec.ts | 删除后未验证列表变化 | 添加 count 断言 |

---

## 四、Client Agent 测试实施指导

### 4.1 前提条件

```bash
# 确保 Client Agent 已启动
cd packages/client-agent
pnpm start
# 或后台运行
pnpm start &
```

### 4.2 需要创建的测试文件

**文件**：`e2e/scenario/agent-integration.spec.ts`

**测试用例（至少 10 个）**：

```
1. Agent 配对入口可见性
   - 登录后能找到 Agent 相关的 UI 入口（按钮/菜单/图标）
   - expect(agentEntry).toBeVisible()

2. 配对码显示
   - 点击配对入口 → 显示 6 位配对码或设备列表
   - expect(pairingCode).toHaveText(/\d{6}/) 或 expect(deviceList).toBeVisible()

3. Agent 在线状态指示
   - Client Agent 连接后，前端应显示"已连接"/"在线"状态
   - expect(statusIndicator).toHaveClass(/online|connected/)

4. 模式切换 UI
   - 找到远程/本地模式切换控件
   - 切换操作后 UI 反馈正确
   - expect(modeLabel).toHaveText(/本地|Local/)

5. 远程→本地切换上下文连贯
   - 远程模式发："我叫测试员小王"
   - 切到本地模式
   - 发："你还记得我叫什么吗？"
   - expect(aiResponse).toContain('小王')

6. 本地工具执行 — 文件操作
   - 本地模式下发："在桌面创建一个文件 test-agent.txt"
   - 验证 AI 调用了 Client Agent 工具
   - 验证执行结果在对话中显示

7. 本地工具执行 — Shell 命令
   - 本地模式下发："运行 ls 命令看看当前目录"
   - 验证返回了目录列表

8. Agent 断连感知
   - 停止 Client Agent 进程
   - 前端状态应变为"离线"
   - expect(statusIndicator).toHaveClass(/offline|disconnected/)

9. 断连后发消息的错误处理
   - Agent 离线时发送需要本地工具的消息
   - 应有友好错误提示，不是无限等待
   - expect(errorMessage).toBeVisible()

10. Agent 重连恢复
    - 重新启动 Client Agent
    - 状态应自动恢复为"在线"
    - 再次发送本地工具命令应成功
```

### 4.3 Mock 方案（如果 Client Agent 无法真正启动）

如果测试环境中无法运行 Client Agent CLI，可以用 Socket.IO client mock：

```typescript
import { io } from 'socket.io-client';

// 在测试 setup 中模拟一个 Agent 连接
const agentSocket = io('http://localhost:3000/agent', {
  auth: { token: 'test-token' }
});

// 监听工具调用请求，返回模拟结果
agentSocket.on('tool:execute', (data, callback) => {
  callback({ success: true, result: 'mock result' });
});

// 测试完成后断开
test.afterAll(() => agentSocket.disconnect());
```

### 4.4 mode-switch.spec.ts 重写指导

当前文件 5/8 测试是空壳，需要重写：

```typescript
// ❌ 当前代码 — 空壳
test('远程到本地切换', async ({ page }) => {
  const modeSwitch = page.locator('[data-testid="mode-switch"]');
  if (await modeSwitch.isVisible()) {
    console.log('Mode switch found');
  } else {
    console.log('Mode switch not available');
  }
  // 测试结束，什么都没验证
});

// ✅ 应该这样写
test('远程到本地切换', async ({ page }) => {
  // 1. 确认当前是远程模式
  const modeIndicator = page.locator('[data-testid="mode-indicator"]');
  await expect(modeIndicator).toContainText(/远程|Remote|Platform/);

  // 2. 找到切换控件
  const modeSwitch = page.locator('[data-testid="mode-switch"]');
  await expect(modeSwitch).toBeVisible();

  // 3. 如果 Agent 未连接，标记跳过（不是静默通过）
  const agentStatus = page.locator('[data-testid="agent-status"]');
  const isOnline = await agentStatus.textContent();
  if (!isOnline?.includes('在线') && !isOnline?.includes('online')) {
    test.skip(true, 'Client Agent 未连接，无法测试模式切换');
    return;
  }

  // 4. 执行切换
  await modeSwitch.click();

  // 5. 验证切换成功
  await expect(modeIndicator).toContainText(/本地|Local|Agent/);
});
```

**核心原则**：
- 功能不可用 → `test.skip()`，不是 `console.log()` 然后通过
- 每个测试必须至少有一个 `expect` 断言
- 如果依赖 Agent 但 Agent 未启动，明确跳过并说明原因

---

## 五、修复后的验收标准

1. **零空壳测试**：grep 所有测试文件，不应有 `console.log` 作为唯一验证手段
2. **Client Agent 测试覆盖**：agent-integration.spec.ts 至少 8 个测试，mode-switch.spec.ts 重写后至少 6 个有效测试
3. **test.skip 正确使用**：Agent 不可用时用 test.skip，不是静默通过
4. **headed 模式验证**：至少跑一次 `--headed --slow-mo=500` 观察 Agent 相关 UI

```bash
# 验收命令
npx playwright test e2e/scenario/mode-switch.spec.ts --headed --slow-mo=500
npx playwright test e2e/scenario/agent-integration.spec.ts --headed --slow-mo=500
```

---

## 六、执行优先级

1. **先修复空壳测试**（~1小时）— 把 console.log 改成 expect
2. **启动 Client Agent**（确认已运行）
3. **重写 mode-switch.spec.ts**（8 个真实测试）
4. **创建 agent-integration.spec.ts**（10 个测试）
5. **全量回归**：`npx playwright test` 确认不破坏已有测试
6. **headed 模式复查**：关键场景用 --headed 跑一遍

修复完成后，将测试结果截图和报告提交到 `.claude/dev-log.md`。
