# PM 规划预告 — Phase E：测试基础设施升级

**下达人**: Claude Opus 4.6 (产品总经理)
**日期**: 2026-02-06
**状态**: 预告（Phase C 回归验证完成后启动）
**前置条件**: C-1/C-2/C-3 全部完成且结果 ≥ 绿灯/黄灯

---

## 背景

Opus 4.6 PM 对全部测试套件进行了重新审视，发现 S04 的设计缺陷不是个案。S01 和 S02 存在同类问题，只是程度较轻。如果不修，后续每轮验证都会浪费时间在"是 DeepSeek 限流还是真 bug"的判断上。

### 各套件现状评估

| 套件 | AI 依赖 | AI 调用次数 | 设计质量 | 判定 |
|------|---------|-----------|---------|------|
| S04-V2 | 25% (4/16) | 4 次 | 四层架构，标杆 | ✅ 已完成 |
| S03-V2 | 30% (3/10) | 3 次 | 基本合理，需加固 | ⚠️ 加固即可 |
| S01 | **45% (4/9)** | **4 次** | A 组启发式匹配，抖动 | ❌ 需重设计 |
| S02 | **100% (8/8)** | **14 次** | 全部依赖 AI，限流必崩 | ❌ 需重设计 |
| V2 E2E (73) | ~30% | ~20 次 | 结构合理，受修复影响小 | ✅ 可用 |

---

## Phase E 任务清单

### E-1：S01-V2 重新设计（Workbench 渲染验证）

**当前问题**：
- 4/9 测试依赖 AI 调用 showTable/showChart，用关键词启发式匹配判断 AI 意图
- Schema 注入代码重复率 85-90%，每个测试 50-100 行但仅 3-12 行断言
- 无 `data-testid`，耦合 CSS class 名

**重设计方向**：
```
S01-V2 (预计 12-14 tests, ≤ 2 次 AI 调用)

A 组 — 渲染正确性 (4 tests, 0 AI)
  注入已知 schema → 验证 Table/Chart/Code/Markdown 正确渲染
  用 schema 注入替代 AI 调用，测的是渲染引擎不是 AI

B 组 — 多 Tab 与容错 (4 tests, 0 AI)
  多 Tab 注入 → Tab 切换/关闭/accumulation
  畸形 schema → 容错降级（P0-4/P0-5 回归）

C 组 — AI 触发 Workbench (2 tests, 2 AI)
  仅保留 2 个 AI 测试，验证 AI 是否调用 workbench 工具
  失败时记录 AI 实际输出，标记为观察性而非阻断性

D 组 — UX 细节 (2-4 tests, 0 AI)
  Workbench 面板 resize/折叠/响应式
```

**关键变化**：AI 调用从 4 次降到 2 次，测试数从 9 增到 12-14。

---

### E-2：S02-V2 重新设计（多轮对话上下文验证）

**当前问题**：
- 8/8 全部依赖 AI（14 次调用），限流下大面积失败
- 上下文记忆测试本质上测的是 LLM 能力而非平台功能
- 10 秒硬编码等待防限流，粗糙且不可靠

**重设计方向**：
```
S02-V2 (预计 12 tests, ≤ 4 次 AI 调用)

A 组 — 消息持久化 (4 tests, 0 AI)
  发送消息 → 刷新页面 → 消息仍在（测 DB，不测 AI）
  切换会话 → 切回 → 历史完整（测 API，不测 AI 记忆）
  会话隔离：A 会话消息不出现在 B 会话（测前端路由）

B 组 — 历史注入正确性 (3 tests, 0 AI)
  构造 N 条历史 → 检查 API 传给 AI 的 history 数组长度和内容
  验证 slice(-maxHistoryMessages) 逻辑（P0-2 回归）
  Mock WebSocket 验证历史不重复注入

C 组 — AI 上下文连贯 (3 tests, 3 AI)
  3 轮对话，每轮 1 次 AI 调用（不是之前的 14 次）
  第 1 轮：告诉 AI 一个事实
  第 2 轮：问 AI 记不记得
  第 3 轮：在新会话中确认隔离
  限流时 graceful skip，不阻断

D 组 — 流式与并发 (2 tests, 1 AI)
  流式渲染：stop 按钮生命周期 + 无 undefined/[object Object]
  快速连发：2 条消息不丢失不乱序
```

**关键变化**：AI 调用从 14 次降到 4 次，测试数从 8 增到 12。上下文验证从"测 LLM 记忆"转为"测平台历史注入"。

---

### E-3：S03-V2 加固（非重设计）

S03 设计基本合理，不需要推翻重来。加固项：

1. 替换所有 `waitForTimeout(X)` 为条件等待
2. 关键 Workbench 组件添加 `data-testid`
3. S03-01 拆分：注入验证（0 AI）+ AI 触发验证（1 AI）
4. 统一使用 `SEL` 常量，消除硬编码 class 选择器

---

### E-4：统一测试工具函数

从 S04-V2 的设计中提取可复用模式：

```typescript
// 统一 schema 注入工厂
function createTestSchema(type: 'table' | 'chart' | 'code', data): WorkbenchSchema

// 统一 AI 调用封装（带 skip 逻辑）
function sendAIWithGracefulSkip(page, prompt, options): { success, response, skipped }

// 统一前置检查
function ensureServiceReady(page): { server, agent, ai }
```

避免每个测试文件重复实现 retry/skip/inject 逻辑。

---

## 执行优先级

```
E-1 (S01-V2) 和 E-2 (S02-V2) 并行，优先级最高
  │
  └── E-3 (S03 加固) 可同步进行
       │
       └── E-4 (工具函数) 在 E-1/E-2 完成后提取公共部分
```

预计工作量：E-1 + E-2 各需要 1 个工程师，E-3 + E-4 可由 1 个工程师完成。

---

## 与功能增量的关系

测试基础设施升级 (Phase E) 排在功能增量 (Phase F) **之前**。原因：

1. 没有可靠测试，功能增量的回归验证会反复浪费时间
2. S02 目前 14 次 AI 调用的设计，在 DeepSeek 限流常态化的情况下基本不可用
3. Phase E 预计 1-2 天，Phase F（Memory 统一、RPA 前端）需要数周，值得先投资

---

## 注意

本文件是规划预告，不是执行指令。Phase C 回归验证完成后，PM 将根据结果决定是否启动 Phase E 或直接进入功能增量。
