# 产品经理指令 — V2 测试修正（必须严格执行）

> **发出人**：产品经理
> **日期**：2026-01-30
> **性质**：强制执行，不可跳过任何步骤，不可自行调整顺序
> **完成标志**：更新本文件底部「执行记录」区域，每完成一步打勾

---

## 你这轮测试的问题

1. 测试失败 → 你改测试代码让它通过 → 报告"全部通过"。**这是本末倒置。**
2. `expect(true).toBe(true)` 出现 8 次，M6 整个模块基本是空壳。
3. 所有失败笼统归为"DeepSeek 限流"，没有逐个分类。
4. 至少 2 个疑似产品 bug 被你的 fallback 代码埋掉了。

---

## 执行步骤（必须按顺序，不可跳步）

### 步骤 1：调查疑似产品 bug

**不改任何代码。只观察、截图、记录。**

用 headed 模式跑以下命令：

```bash
npx playwright test e2e/M3-workbench -g "M3-02" --headed --slow-mo=1000 --workers=1
npx playwright test e2e/M5-agent -g "M5-04" --headed --slow-mo=1000 --workers=1
```

逐项调查：

| 编号 | 调查什么 | 怎么判断 |
|------|---------|---------|
| BUG-1 | welcome 页（无 session）点「打开工作台」，Workbench 是否渲染？ | 截图。再在有 session 的页面试一次对比。如果无 session 不渲染、有 session 正常 → **产品 bug** |
| BUG-2 | 选云端模式确认后，打开浏览器 console 输入 `JSON.parse(localStorage.getItem('lsc-ai-agent'))` 看 state | 如果 currentDeviceId 没被清空或 workDir 没设置 → **确认是设计如此还是遗漏** |
| BUG-3 | headed 模式下 M5-04 的 `enterLocalMode()` 每一步：弹窗打开了吗？Radio 切换了吗？设备选中了吗？确认按钮点了吗？ | 哪一步断了就记录哪一步 |

**调查结果写到 `.claude/dev-log.md` 末尾**，格式：
```markdown
## [日期] BUG 调查

### BUG-1: Workbench welcome 页不渲染
- 现象：（描述 + 截图路径）
- 判定：产品 bug / 设计如此 / 测试问题
- 如果是产品 bug：哪个文件、哪行代码、建议修复方案

### BUG-2: ...
### BUG-3: ...
```

**步骤 1 完成后，在本文件底部「执行记录」打勾，然后 git commit + push。等待 PM review 后再继续步骤 2。**

---

### 步骤 2：删除所有 `expect(true).toBe(true)`

全局搜索：
```bash
grep -rn "expect(true).toBe(true)" e2e/
grep -rn "toBeGreaterThanOrEqual(0)" e2e/
```

每一处，二选一：
- 替换为真实断言
- 替换为 `test.skip(true, '具体原因：xxxxx')`

**禁止保留任何 `expect(true).toBe(true)` 和 `expect(count).toBeGreaterThanOrEqual(0)`。**

---

### 步骤 3：修复 M6 文件上传

当前 `page.waitForEvent('filechooser')` 在 headless 下可能不触发。替换为直接操作隐藏 input：

```typescript
// 替换前（不可靠）
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  fileItem.click(),
]);

// 替换后（可靠）
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(filePath);
```

6 个测试全部改用此方式。删除所有 `if (fileChooser) { ... } else { expect(true) }` 结构。

---

### 步骤 4：补齐缺失的测试逻辑

| 测试 | 问题 | 必须改成 |
|------|------|---------|
| M2-09 工具调用 | prompt"你好"不触发工具 | 改为"帮我搜索 Playwright 是什么"或"列出工作目录的文件"，确保触发工具调用 |
| M3-03 拖拽 | 没有拖拽操作 | 用 `page.mouse` 拖拽分割线，验证拖拽前后宽度变化 |
| M3-10 切换恢复 | 切回后没验证 Workbench | 切回 session1 后 `expect(wb).toBeVisible()` |
| M3-11 隔离 | 只检查会话数量 | 切到 session1 验证有代码关键词，切到 session2 验证有表格元素 |
| M3-12 刷新恢复 | 没检查 Workbench | 刷新后 `expect(wb).toBeVisible()` |
| M5-12 离线感知 | 只测了在线 | 补充：停止 Agent → 刷新设备列表 → 检查状态变为离线（或 test.skip 并注明无法在自动化中停止 Agent 进程） |

---

### 步骤 5：对 M3/M4 失败逐个分类

重跑：
```bash
npx playwright test e2e/M3-workbench --workers=1
npx playwright test e2e/M4-session --workers=1
```

对每个失败的测试，在报告中写明：

| 测试 | 错误类型 | 有 429 状态码吗 | 判定 |
|------|---------|----------------|------|
| M3-xx | timeout / 选择器找不到 / 断言不匹配 | 是/否 | 限流 / 选择器问题 / 产品 bug |

**不允许写"全部是限流"。必须逐个填。**

---

### 步骤 6：全量回归 + 提交报告

全部修完后逐模块跑：
```bash
npx playwright test e2e/M1-auth --workers=1
npx playwright test e2e/M7-navigation --workers=1
npx playwright test e2e/M2-chat-core --workers=1
npx playwright test e2e/M3-workbench --workers=1
npx playwright test e2e/M4-session --workers=1
npx playwright test e2e/M5-agent --workers=1
npx playwright test e2e/M6-file-upload --workers=1
```

更新 `V2-TEST-REPORT.md`，git commit + push。

---

## 铁律（违反任何一条，整轮打回重做）

1. **测试失败 → 先查产品代码是否有 bug → 再决定改什么**
2. **禁止 `expect(true).toBe(true)`**
3. **禁止 `expect(count).toBeGreaterThanOrEqual(0)`**
4. **功能不可用 → `test.skip('原因')` 不是静默通过**
5. **每个失败必须分类：限流 / 选择器 / 产品 bug / 测试逻辑错误**
6. **发现产品 bug → 记录到 dev-log，不许用 fallback 绕过**

---

## 执行记录（每完成一步在此打勾，附 commit hash）

- [x] 步骤 1：调查疑似产品 bug — commit: ea048c7
- [x] 步骤 2：删除 expect(true).toBe(true) — commit: 554c73c
- [x] 步骤 3：修复 M6 文件上传 — commit: 554c73c
- [x] 步骤 4：补齐缺失测试逻辑 — commit: 554c73c
- [x] 步骤 5：M3/M4 失败逐个分类 — 结果记录在 dev-log.md
- [x] 步骤 6：全量回归 + 更新报告 — commit: f63af70
