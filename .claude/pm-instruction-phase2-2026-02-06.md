# PM 指令 — 第二轮：全面回归验证 + 质量关卡

**下达人**: Claude Opus 4.6 (产品总经理)
**接收人**: 本地总工程师 + 开发团队 (Opus 4.6)
**日期**: 2026-02-06
**优先级**: 最高 — 7 项修复已完成，现在必须验证它们真正有效

---

## 背景

第一轮 7 项修复任务已全部完成（A-1 到 A-4 + B-1 到 B-3），commit 记录干净，每项独立可回滚。

**但修复不等于验证。代码改了不代表问题解了。** 现在进入验证阶段。

---

## 阶段 C：全面回归验证（3 个验证轮次）

### 验证顺序和依赖关系

```
C-1: S04-V2 回归 (16 tests)     ← 验证 A-1/A-2/A-3 的核心修复
     │
     ├── A+B 组 8/8？─── 否 → 停，修复不到位，返工
     ├── 是 → 继续
     ├── C+D ≥ 5/8？── 否 → 分析失败原因，报告后再决定
     ├── 总计 ≥ 13/16？── 否 → 报告后等 PM 指示
     └── 是 → 进入 C-2

C-2: S01/S02/S03 回归             ← 验证 P0-1~P0-6 + 7 项修复无回归
     │
     └── 结果不论 → 进入 C-3

C-3: 既有 E2E 全量回归 (73 tests) ← 验证无负面影响
```

---

### Task C-1：S04-V2 全量回归（本地模式验证）

这是本轮最关键的验证。A-1（API Key 传递）和 A-2（空 stream 检测）直接决定 S04 是否从 1/8 提升到可用。

**前置条件**：
1. 确认 Client Agent 服务已启动
2. 确认 Client Agent 配置中有有效的 DEEPSEEK_API_KEY
3. 确认 Server 后端（:3000）已使用最新代码重启

**执行命令**：
```bash
npx playwright test e2e/PM-scenarios/S04-local-mode-depth-v2.spec.ts --reporter=list
```

**门禁标准**（来自 pm-plan-adjustments-2026-02-06.md）：

| 分组 | 测试数 | 最低通过 | 说明 |
|------|--------|---------|------|
| A 组（入口体验） | 4 | **4/4** | 纯前端，必须全过 |
| B 组（模式生命周期） | 4 | **4/4** | 纯前端+Agent |
| C 组（核心业务） | 4 | **≥ 3/4** | 依赖 AI，1 个限流可接受 |
| D 组（异常边界） | 4 | **≥ 2/4** | D02/D03 观察性 |
| **总计** | **16** | **≥ 13/16** | |

**关键判断逻辑**：
- A+B 任何失败 → **红灯**，修复有问题，立即停止，在报告中分析原因
- C 组 < 3/4 → **黄灯**，检查是限流还是代码问题。如果是限流，重试 1 次确认
- 总计 < 13/16 → **黄灯**，报告后等 PM 指示
- 总计 ≥ 13/16 → **绿灯**，进入 C-2

**报告格式**：
```
## C-1 S04-V2 回归结果

通过率: X/16
A 组: X/4 [列出失败项]
B 组: X/4 [列出失败项]
C 组: X/4 [列出失败项]
D 组: X/4 [列出失败项]

判定: 绿灯/黄灯/红灯
分析: [失败原因]
```

---

### Task C-2：S01/S02/S03 场景回归

目的：确认之前发现的 P0 bug 全部修复、且 7 项修复没有引入回归。

**执行方式**：逐个场景执行，不要一次全跑（避免 DeepSeek 限流）。每个场景间隔 30 秒。

```bash
# 先跑不依赖 AI 的
npx playwright test e2e/PM-scenarios/S03-workbench-depth-v2.spec.ts --reporter=list

# 等 30 秒
npx playwright test e2e/PM-scenarios/S01-workbench-render.spec.ts --reporter=list

# 等 30 秒
npx playwright test e2e/PM-scenarios/S02-multiturn-context.spec.ts --reporter=list
```

**预期对照**：

| 场景 | 上次结果 | 预期本次 | 修复验证点 |
|------|---------|---------|-----------|
| S01 | 6/9 (P0-1,P0-5 导致 3 失败) | **≥ 8/9** | P0-1 ✅ P0-5 ✅ |
| S02 | 6/8 (P0-2 导致 2 失败) | **≥ 7/8** | P0-2 ✅（含本地模式路径）|
| S03 | 8/10 | **≥ 8/10** | P0-6 ✅ 无回归 |

**注意**：S01-02/S01-03 是否通过取决于 AI 是否调用 showTable/showChart，这受 P0-1 Instructions 强化修复的影响。如果仍失败但 AI 调用了工具（只是参数不对），算部分通过。

**报告格式**：
```
## C-2 场景回归结果

S01: X/9 [失败项+原因]
S02: X/8 [失败项+原因]
S03: X/10 [失败项+原因]

与上次对比: 改善/持平/回归
新发现问题: 有/无 [描述]
```

---

### Task C-3：既有 E2E 全量回归

验证 7 项修复没有破坏已有功能。特别关注 B-3（Session 授权验证）是否导致现有测试鉴权失败。

**执行**：按模块分组跑，每组间隔 20 秒。

```bash
npx playwright test e2e/V2/M1-auth.spec.ts --reporter=list
npx playwright test e2e/V2/M5-agent.spec.ts --reporter=list
npx playwright test e2e/V2/M7-navigation.spec.ts --reporter=list
npx playwright test e2e/V2/M4-session.spec.ts --reporter=list
npx playwright test e2e/V2/M6-file-upload.spec.ts --reporter=list
# AI 依赖的放最后
npx playwright test e2e/V2/M2-chat-core.spec.ts --reporter=list
npx playwright test e2e/V2/M3-workbench.spec.ts --reporter=list
```

**重点关注**：
- **M1-auth**：B-3 增加了授权验证，auth 测试必须全过
- **M4-session**：B-3 增加了 userId 校验，session CRUD 测试必须全过
- **M5-agent**：B-2 改了 Token 生成，agent 测试必须全过

**门禁**：
- M1/M4/M5/M7 必须无回归（通过率 ≥ 上次）
- M2/M3/M6 允许 DeepSeek 限流导致的失败

**报告格式**：
```
## C-3 全量回归结果

| 模块 | 上次 | 本次 | 变化 |
|------|------|------|------|
| M1-auth | 8/8 | X/8 | |
| M2-chat-core | 15/15* | X/15 | |
| M3-workbench | 6/12 | X/12 | |
| M4-session | 8/10 | X/10 | |
| M5-agent | 12/12 | X/12 | |
| M6-file-upload | 6/6 | X/6 | |
| M7-navigation | 10/10 | X/10 | |

回归问题: 有/无 [描述]
```

---

## 阶段 D：根据验证结果决定下一步

验证全部完成后，在 `pm-engineer-chat.md` 中写总结报告，包含：

1. **验证总结表**：C-1 + C-2 + C-3 结果一览
2. **修复有效性确认**：7 项修复是否达到预期效果
3. **回归风险评估**：是否引入新问题
4. **阻塞项清单**：任何未通过门禁的项目
5. **建议下一步**：基于结果建议下一阶段方向

**PM 将根据总结报告决定**：
- 绿灯 → 进入功能增量阶段（Memory 统一、RPA 前端、Structured Output）
- 黄灯 → 定点修复后再次回归
- 红灯 → 修复返工

---

## 提交规范

验证阶段不产生代码修改，不需要 commit。

**例外**：如果验证过程中发现测试文件本身有 bug（选择器过时等），可以修复测试文件并提交：
```
[C-X] 修复测试文件 XXX.spec.ts: [具体问题]
```

---

## 执行节奏

1. C-1 先行，结果决定是否继续
2. C-2 和 C-3 可以并行（分两个终端），但 AI 相关测试注意错开避免限流
3. 全部完成后写总结报告

**开始执行。**
