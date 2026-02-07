# PM 指令 — 第一轮修复任务

**下达人**: Claude Opus 4.6 (产品总经理)
**接收人**: 本地总工程师 + 开发团队 (Opus 4.6)
**日期**: 2026-02-06
**优先级**: 最高 — 阻断核心功能交付

---

## 背景

PM 审视 + 工程师审查共同确认：本地模式链路完全不可用（S04 通过率 1/8），根因已定位。现在进入修复阶段。

**核心原则：不写新功能，只修已有的。修完一个验证一个，不批量提交。**

---

## 任务一览

本轮共 7 项任务，分 2 个阶段，预计总工时 4-5 小时。

### 阶段 A：核心阻断修复（4 项，预计 1.5h）

修完这 4 项后立即跑 S04 验证，不等阶段 B。

---

### Task A-1：修复 executor.ts API Key 传递（15min）

**问题**：`executor.ts:330-332` — `deepseek()` 构造函数从 `process.env.DEEPSEEK_API_KEY` 读取 Key，但 Client Agent 的 Key 存在 Conf 配置中，从未传递给构造函数。

**修复要求**：
1. 从 Conf 配置中读取 `apiKey` 和 `baseUrl`
2. 显式传递给 `deepseek({ apiKey, baseURL })` 构造函数
3. 如果 Key 不存在，在执行前就报错（不要让空 Key 的请求发出去）

**验证**：
- Client Agent 启动后，手动发一条本地模式消息，确认 AI 有响应
- 在日志中确认 deepseek 构造函数收到了正确的 Key

**注意**：不要把 Key 打印到日志里，只打印"Key loaded: true/false"

---

### Task A-2：空 stream 错误检测（15min）

**问题**：`executor.ts:471-480` — AI 返回空 stream 时被当作"成功完成"处理，前端表现为永远没有回复。

**修复要求**：
1. 在 stream 处理完毕后检查：如果没有收到任何 text-delta，视为异常
2. 发送明确的错误信息给前端（例如"本地 AI 调用无响应，请检查 API Key 配置"）
3. 确保 `task_result` 中有错误标记，不要静默吞掉

**验证**：
- 故意传一个无效 Key，确认前端收到明确错误提示而非"无响应"

---

### Task A-3：修复 chat.gateway.ts:626 本地模式历史切片（30min）

**问题**：P0-2 修复时只修了云端模式路径（line 329），本地模式路径（line 626）被遗漏。`history.slice(0, -1)` 会丢掉最后一条历史消息。

**修复要求**：
1. 将 `chat.gateway.ts:626` 的 `history.slice(0, -1)` 改为与云端模式一致的逻辑
2. 使用 `history.slice(-maxHistoryMessages)` 取最近 N 条
3. **全局搜索**：确认整个项目中不再有其他 `slice(0, -1)` 的历史处理路径

**验证**：
- 本地模式下进行 3 轮对话，第 3 轮问 AI "我第一轮说了什么"，确认上下文连贯

**警告**：上次就是因为只修了一个路径漏了另一个。这次必须全局搜索 `slice.*-1` 确认没有遗漏。

---

### Task A-4：deploy-package 移除真实 API Key（15min）

**问题**：`deploy-package/.env:31` 硬编码了真实 API Key。

**修复要求**：
1. 将 deploy-package 中的真实 Key 替换为占位符（如 `sk-your-key-here`）
2. 检查 `.gitignore` 是否包含 `.env` 文件
3. 搜索整个仓库，确认没有其他地方硬编码了真实 Key

**验证**：
- `grep -r "sk-" . --include="*.env*"` 不应返回真实 Key

---

### 阶段 A 验证关卡

**A-1 到 A-4 全部完成后，立即执行 S04 全量回归**：

```bash
npx playwright test e2e/PM-scenarios/S04-local-mode-depth.spec.ts
```

**预期结果**：通过率应从 1/8 提升到至少 5/8。

如果仍低于 5/8，不要继续阶段 B，先排查原因。在 `pm-engineer-chat.md` 中报告具体哪些 test 仍然失败、失败日志、你的分析。

---

### 阶段 B：安全底线修复（3 项，预计 1.5h）

阶段 A 验证通过后再开始。

---

### Task B-1：WebSocket CORS 限制（15min）

**问题**：`chat.gateway.ts:49` 设置 `origin: '*'`，允许任意跨站 WebSocket 连接。

**修复要求**：
1. 将 `origin: '*'` 改为从环境变量读取允许的域名列表
2. 开发环境默认允许 `localhost:5173`
3. 生产环境必须显式配置

**验证**：
- 前端仍能正常连接 WebSocket
- 从一个不在列表中的域名发起连接应被拒绝

---

### Task B-2：Agent Token 改用加密随机（30min）

**问题**：`agent.gateway.ts:141` 生成的 Agent Token 可预测。

**修复要求**：
1. 使用 `crypto.randomBytes(32).toString('hex')` 生成 Token
2. Token 有效期设为 5 分钟（配对码场景）
3. 已使用的 Token 立即失效

**验证**：
- 生成 10 个 Token，确认无规律
- 过期 Token 无法用于配对

---

### Task B-3：Session/WebSocket 授权检查（45min）

**问题**：
- `session.controller.ts:46` — Session 操作缺所有者验证（IDOR）
- `chat.gateway.ts:168` — WebSocket 事件缺会话归属验证

**修复要求**：
1. Session CRUD 操作增加 `userId` 校验，用户只能操作自己的 Session
2. WebSocket `chat:send` 事件验证 session 归属当前用户
3. 不符合的请求返回 403

**验证**：
- 用户 A 创建 Session，用户 B 尝试访问/删除应被拒绝
- WebSocket 发消息到非自己的 Session 应被拒绝

---

### 阶段 B 验证关卡

**B-1 到 B-3 完成后**：

1. 运行 S04 回归确认没有引入新问题
2. 运行 M1-auth 模块确认认证流程正常
3. 在报告中列出修改的文件清单

---

## 提交规范

每个 Task 独立提交，commit message 格式：

```
[A-1] 修复 executor.ts API Key 传递给 deepseek 构造函数
[A-2] 添加空 stream 错误检测，防止静默失败
[A-3] P0-2 完整修复：本地模式历史切片与云端一致
[A-4] 移除 deploy-package 硬编码 API Key
[B-1] WebSocket CORS 从 origin:* 改为白名单
[B-2] Agent Token 改用 crypto.randomBytes
[B-3] Session/WebSocket 增加所有者授权验证
```

**不要把多个 Task 合并成一个提交。** 每个修复独立可回滚。

---

## 报告要求

每个 Task 完成后在 `pm-engineer-chat.md` 中简要报告：
- 修改了哪些文件
- 验证结果（通过/失败）
- 如有意外发现，立即说明

阶段 A 和阶段 B 各完成后，写一段总结。

---

## 时间要求

- 阶段 A（4 项）：今天完成
- 阶段 B（3 项）：阶段 A 验证通过后立即开始
- 全部完成后推送到 main 分支

**开始执行。**
