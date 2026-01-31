# PM 场景测试 — 工程师执行指令

> **重要**：本文件由产品经理编写。工程师必须严格按照指令执行。

---

## 执行规则（铁律）

1. **不得修改 `expect` 断言** — 断言是测试的核心。如果断言失败，那就是 bug，直接报告。
2. **允许修改的内容** — 选择器（locator）和等待时间（waitForTimeout）。但修改前必须在 `pm-engineer-chat.md` 中说明原因。
3. **不得新增 `test.skip`** — 除非测试前提条件无法满足（如 DeepSeek 完全不可用），且必须说明原因。
4. **不得删除测试用例**。
5. **每个场景测试完成后 push 一次**，包含：测试结果截图、控制台输出、和结果摘要写入 `pm-engineer-chat.md`。

---

## 当前场景：S01 — Workbench 渲染正确性

### 测试文件
```
e2e/PM-scenarios/S01-workbench-render.spec.ts
```

### 前置准备

**1. 暴露 Zustand Store 供测试使用**

S01-05/06 需要直接注入 schema 到 WorkbenchStore。请在 `packages/web/src/main.tsx`（或应用入口）中添加以下代码（仅开发/测试环境）：

```typescript
// 在 app mount 之后添加
if (import.meta.env.DEV) {
  // 暴露 stores 供 E2E 测试使用
  import('./components/workbench/context/WorkbenchStore').then(({ useWorkbenchStore }) => {
    (window as any).__workbenchStore = useWorkbenchStore;
  });
}
```

然后修改 S01-05 中的 `page.evaluate` 代码，改用 `window.__workbenchStore.getState().open(schema)` 调用。

> 注意：这不算修改断言，是暴露测试接口。

**2. 确保服务已启动**
- `lsof -i:5173` — web 前端
- `lsof -i:3000` — server 后端
- Docker 服务运行中（PostgreSQL、Redis、MinIO、LibSQL）

### 执行命令

```bash
cd packages/web

# 先跑第一组（AI 触发，验证真实渲染）
npx playwright test e2e/PM-scenarios/S01-workbench-render.spec.ts --grep "S01-A"

# 结果出来后跑第二组（注入测试，需要先完成前置准备）
npx playwright test e2e/PM-scenarios/S01-workbench-render.spec.ts --grep "S01-B"

# 最后跑第三组
npx playwright test e2e/PM-scenarios/S01-workbench-render.spec.ts --grep "S01-C"
```

### 结果报告格式

在 `pm-engineer-chat.md` 中追加：

```markdown
### [工程师] 日期 — S01 执行结果

| 用例 | 结果 | 说明 |
|------|------|------|
| S01-01 代码展示 | ✅/❌/⏭ | 具体情况 |
| S01-02 表格展示 | ✅/❌/⏭ | 具体情况 |
| S01-03 图表展示 | ✅/❌/⏭ | 具体情况 |
| S01-04 多 tab | ✅/❌/⏭ | 具体情况 |
| S01-05 注入 LineChart | ✅/❌/⏭ | 具体情况 |
| S01-06 旧格式转换 | ⏭ (依赖 S01-05) | |
| S01-07 校验容错 | ✅/❌/⏭ | 具体情况 |

**失败用例详情**：
（贴完整错误信息 + 截图路径）

**console.error 收集**：
（贴 test-base 收集的控制台错误）
```

### 失败了怎么办

- **如果 S01-01/02/03 失败（Workbench 未打开）** → 确认是 P0-1 bug（showCode/showTable/showChart 不推送）。直接报告，不要试图修测试。
- **如果 S01-03 失败（图表是 JSON 文本）** → 确认是 P0-5 bug（schema 格式/转换问题）。截图 + 报告。
- **如果 S01-07 失败（Workbench 整体不显示）** → 确认是 P0-4 bug（校验过严）。检查 console 是否有 "Schema 验证失败" 日志。
- **如果 AI 根本没调用对应工具** → 用 `test.skip` 跳过并说明。这不是产品 bug，是 AI 行为问题。

### 修 Bug 流程（如果有失败）

1. 报告结果（不改代码）→ push
2. 等 PM review 确认是产品 bug
3. PM 指定修复方案
4. 工程师修产品代码
5. 重跑 S01 回归验证
6. 全部通过 → 进入 S02

---

## 后续场景预告（不要提前做）

- S02: 多轮对话上下文连贯性（验证 P0-2/P0-3 Memory 问题）
- S03: 本地模式完整流程（验证 P0-7 断连、P1-D1 数据丢失）
- S04: 安全边界测试（验证 P1-S1/S3）
- S05: 文件上传全链路（验证 P1-D4 二进制乱码、P0-6 上下文丢失）
