# PM 修补指令 — Phase E 三个缺口修复

**下达人**: Claude Opus 4.6 (产品总经理)
**接收人**: 本地总工程师 + 开发团队
**日期**: 2026-02-07
**性质**: Phase E 修补，不是返工。工作量小，3 项可并行。

---

## 背景

Phase E 核心架构目标已达成（4 层结构、AI 调用削减、helper 提取）。以下 3 个缺口需要修补。

---

## E-fix-1：S01-V2 选择器统一到 data-testid（高优先级）

**问题**：S03 加固时给 Workbench 组件加了 10 个 `data-testid`，selectors.ts 也注册了。但 S01-V2 没用，仍然用 CSS class 选择器。

**需要替换的选择器**（S01-workbench-render-v2.spec.ts）：

| 当前（脆弱） | 替换为 | 出现次数 |
|-------------|--------|---------|
| `.workbench-container` | `[data-testid="workbench-container"]` 或 `SEL.workbench.container` | ~12 处 |
| `.workbench-tab` | `[data-testid="workbench-tab"]` 或 `SEL.workbench.tab` | ~3 处 |
| `.workbench-header` | `[data-testid="workbench-header"]` 或 `SEL.workbench.header` | ~2 处 |
| `.workbench-resizer` | `[data-testid="workbench-resizer"]` 或 `SEL.workbench.resizer` | ~1 处 |

**不需要替换的**：`[class*="CodeEditor"]`、`.ant-table`、`[class*="echarts"]` 这些是第三方组件/渲染内容的检测，没有对应 data-testid，保留合理。

**验证**：替换后跑 S01-V2 A+B 组（8 tests, 0 AI），必须 8/8。

---

## E-fix-2：S02-V2 B 组补充 slice 验证测试（中优先级）

**问题**：B 组声称验证"历史注入正确性"，但 B01/B02/B03 只测了通道稳定性、时序排列、字段结构。没有测试核心逻辑——`slice(-maxHistoryMessages)` 消息截断。

**补充测试**：在 B 组追加 B04：

```typescript
test('S02-B04 历史消息截断 — 超过 maxHistoryMessages 条后 API 返回受限', async ({ page, api }) => {
  // 1. 创建会话
  // 2. 通过 API 连续发送 25+ 条用户消息（不等 AI 回复，纯写入）
  // 3. 调用 GET /api/v1/sessions/:id 获取消息列表
  // 4. 验证返回的消息数 ≤ maxHistoryMessages (20)
  //    或验证 WebSocket chat:send 事件携带的 history 数组长度 ≤ 20
});
```

**注意**：这个测试 0 AI 调用，纯 API 验证。maxHistoryMessages = 20（来自 chat.gateway.ts）。

**验证**：B04 单独通过 + B 组 4/4。

---

## E-fix-3：workbench.helper.ts 消除 magic timeout（中优先级）

**问题**：helper 中有 6 处 `waitForTimeout`，S03 spec 通过 helper 间接引入了 magic timeout。

**需要替换的 6 处**：

| 位置 | 当前 | 替换为 |
|------|------|--------|
| `ensureSession` ~L31 | `waitForTimeout(1000)` | `page.waitForURL(/\/chat\//, { timeout: 5000 })` |
| `ensureCleanSession` ~L58 | `waitForTimeout(2000)` | `page.waitForSelector(SEL.chat.messageList, { timeout: 5000 })` |
| `injectSchema` ~L93 | `waitForTimeout(1500)` | `page.waitForSelector(SEL.workbench.container, { state: 'visible', timeout: 5000 })` |
| `mergeSchema` ~L115 | `waitForTimeout(1000)` | `page.waitForSelector(SEL.workbench.tab, { timeout: 3000 })` |
| `closeWorkbench` ~L130 | `waitForTimeout(500)` | `page.waitForSelector(SEL.workbench.container, { state: 'hidden', timeout: 3000 })` |
| `clearWorkbench` ~L142 | `waitForTimeout(500)` | `page.waitForSelector(SEL.workbench.container, { state: 'hidden', timeout: 3000 })` |

具体条件等待的选择器根据实际 DOM 行为调整，以上是建议方向。核心原则：等的是**状态变化**，不是**固定时间**。

**验证**：S03 全量 11/11 通过（AI 依赖项允许限流 skip）。

---

## 执行方式

3 项可并行，无文件冲突：
- E-fix-1 改 `S01-workbench-render-v2.spec.ts`
- E-fix-2 改 `S02-multi-turn-context-v2.spec.ts`
- E-fix-3 改 `workbench.helper.ts`

每项单独提交：
```
[E-fix-1] S01-V2 选择器统一到 data-testid
[E-fix-2] S02-V2 B04 补充 slice 截断验证
[E-fix-3] workbench.helper.ts 消除 6 处 magic timeout
```

**完成后跑一次 S01-V2 A+B + S02-V2 B 组 + S03 全量确认无回归。**

---

## 门禁

| 验证 | 要求 |
|------|------|
| S01-V2 A+B 组 | 8/8 |
| S02-V2 B 组 | 4/4（含新增 B04）|
| S03 全量 | ≥ 9/11（AI 项允许 skip）|
| workbench.helper.ts 中 `waitForTimeout` 数量 | 0 |

**开始执行。**
