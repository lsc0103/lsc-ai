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

> **注意**：本节早期版本存在选择器猜测和笼统描述的问题，已基于源码全面修正。
> 完整的测试用例定义请参考 → **`.claude/test-plan-v2.md` 中的 M5 模块（12 个测试用例）**。
> 本节仅保留架构说明和实施要点，不再重复用例列表。

### 4.1 实际代码架构（测试必须基于真实实现）

**模式切换不是一个 toggle 按钮**，而是通过 `WorkspaceSelectModal` 弹窗实现。

#### 关键组件和文件

| 组件 | 文件路径 | 作用 |
|------|---------|------|
| WorkspaceSelectModal | `packages/web/src/components/agent/WorkspaceSelectModal.tsx` | 模式选择弹窗，Radio 选项：「本地电脑」/「云端服务器」，本地模式需选择已配对设备 + 填工作目录 |
| AgentStatusIndicator | `packages/web/src/components/agent/AgentStatusIndicator.tsx` | 显示当前模式、设备名、工作路径、连接状态，提供「切换」和「退出」按钮 |
| AgentInstallGuide | `packages/web/src/components/agent/AgentInstallGuide.tsx` | 分步引导：功能说明 → 下载安装（按 OS）→ 输入 6 位配对码 → 确认绑定 |
| agent store | `packages/web/src/stores/agent.ts` | Zustand 状态：`devices[]`、`currentDeviceId`、`workDir`、`isConnected`、`pairingCode`，持久化到 localStorage `lsc-ai-agent` |
| ChatInput | `packages/web/src/components/chat/ChatInput.tsx` | 加号菜单中「选择工作目录」触发 WorkspaceSelectModal；发消息时带上 `deviceId` + `workDir` |
| socket.ts | `packages/web/src/services/socket.ts` | `sendChatMessage()` 将 `deviceId` 和 `workDir` 放入 `chat:message` 事件发给 Server |
| ChatGateway | `packages/server/src/gateway/chat.gateway.ts` | **路由决策**（第187-221行）：有 `deviceId` → `handleClientAgentMessage()`；无 → Platform Agent |
| AgentGateway | `packages/server/src/gateway/agent.gateway.ts` | Agent WebSocket namespace `/agent`，管理 `onlineAgents` Map，`sendTaskToAgent()` 派发任务 |
| AgentService | `packages/server/src/modules/agent/agent.service.ts` | `generateAgentPairingCode()`：6位码，5分钟有效；`confirmAgentPairing()`：验证码 + 创建 ClientAgent DB 记录 |

#### 用户操作流程（真实 UI 路径）

```
1. 用户点击 ChatInput 左侧加号菜单 → 「选择工作目录」
2. WorkspaceSelectModal 弹窗打开
3. Radio 选择「本地电脑」或「云端服务器」
4. 本地电脑：
   a. 如果有已配对在线设备 → 设备列表显示（设备名、主机名、平台、状态 Tag、最后在线时间）
   b. 如果无设备 → 显示「安装 Client Agent」按钮 → 打开 AgentInstallGuide
   c. 选择设备 + 填写工作目录 → 确认
5. 云端服务器：
   a. 填写工作目录（默认 /workspace）→ 确认
6. 确认后 → AgentStatusIndicator 出现在 ChatInput 上方
   - 显示模式图标（桌面/云端）、设备名、路径、连接状态
   - 提供「切换」按钮（重新打开 WorkspaceSelectModal）和「退出」按钮（clearWorkspace）
7. 之后发送的每条消息自动携带 deviceId + workDir
```

#### 配对流程（6 位码）

```
1. 用户在 AgentInstallGuide 第3步点击「生成配对码」
   → Browser: POST /agents/pairing-code → Server 生成6位数字（Math.random().toString().substring(2,8)）
2. 用户本地运行 Client Agent CLI: `lsc-agent pair -u http://server:3000`
   → Agent 连接 /agent namespace → emit 'agent:request_pairing_code'
   → Server 返回配对码 → Agent 终端显示（控制台 ASCII / Windows PowerShell / macOS osascript / Linux zenity）
3. 用户在浏览器输入 Agent 显示的 6 位码 → 点击「确认绑定」
   → Browser: POST /agents/confirm-pairing { code, userId }
   → Server 验证码 → 创建 ClientAgent DB 记录 → AgentGateway.notifyAgentPaired()
   → Agent 收到 'agent:paired' 事件（含 userId、token、llmConfig）
4. 配对成功 → 刷新设备列表 → 新设备出现
```

#### 消息路由和上下文连贯性

- ChatGateway 收到带 `deviceId` 的消息 → `handleClientAgentMessage()`
- Server 从 Mastra Memory 取出 `previousMessages`（第610行），打包进 `task.payload.history`
- 通过 `AgentGateway.sendTaskToAgent(deviceId, task)` 发给 Client Agent
- Agent 收到 `agent:task` 事件 → TaskExecutor 执行 → 通过 `agent:stream`/`agent:tool_call`/`agent:task_result` 回传
- AgentGateway 转发为 `chat:stream` 事件推送到浏览器
- **因此**：同一 session 内远程→本地切换，上下文通过 server 端 Memory 传递，理论上连贯

### 4.2 测试用例

**详见 `.claude/test-plan-v2.md` M5 模块**，共 12 个测试用例，分三组：
- M5-A（4个）：工作空间选择 UI — 弹窗打开、云端模式、本地模式无设备、退出工作空间
- M5-B（3个）：Agent 配对流程 — 安装引导、配对码生成、设备列表
- M5-C（5个）：本地模式核心功能 — 发消息、文件操作、Shell 命令、上下文连贯、离线感知

### 4.3 实施要点

**选择器确认**：写测试前必须读源码确认实际渲染的元素，不要猜：

| 要找什么 | 读哪个文件 |
|---------|-----------|
| 加号菜单中的「选择工作目录」 | `ChatInput.tsx` — 找 Dropdown menu items |
| 弹窗中的 Radio 选项 | `WorkspaceSelectModal.tsx` — 找 Radio.Group + Radio 的 value 和 label |
| 设备列表项 | `WorkspaceSelectModal.tsx` 第217-267行 — 找设备卡片的 className 和结构 |
| 安装引导步骤 | `AgentInstallGuide.tsx` — 找 Steps 组件和每步内容 |
| 状态指示器 | `AgentStatusIndicator.tsx` — 找模式图标、文字、按钮 |

**Agent 不可用时的处理**：
```typescript
// ✅ 正确
test.skip(!agentOnline, 'Client Agent 未运行，跳过本地模式测试');

// ❌ 禁止
if (!agentOnline) { console.log('skip'); return; }
```

---

## 五、后续行动

> 本审查报告到此结束。第5轮测试的问题已识别清楚。
> **下一步不是修补旧测试，而是按全新的 V2 测试方案重新编写。**
>
> 完整测试方案请参考 → **`.claude/test-plan-v2.md`**
> - 7 个模块，73 个测试用例
> - 基于平台实际实现的业务功能（非猜测）
> - 每个用例标注了真实组件路径和选择器来源
> - 包含执行策略、报告格式、验收标准
