# LSC-AI 平台 — 总工程师综合审查报告

**审查人**: Claude Opus 4.6 (总工程师)
**日期**: 2026-02-06
**审查方式**: 4 个专业审查员并行深度代码审查
**审查范围**: Server 后端 / Web 前端 / Client Agent / 安全 / 数据库 / 集成链路

---

## 一、执行摘要

4 个审查员共发现 **67 个问题**：

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| **Critical** | 6 | 必须立即修复，阻断核心功能或存在严重安全风险 |
| **High** | 21 | 应尽快修复，影响功能可用性或存在安全漏洞 |
| **Medium** | 27 | 中期修复，影响质量和可维护性 |
| **Low** | 13 | 改善代码质量 |

**最重要的发现 — S04 "本地模式 AI 无响应" 根因确认：**

> `executor.ts:330-332` — `deepseek()` 构造函数从 `process.env.DEEPSEEK_API_KEY` 读取 API Key，但 Client Agent 的 Key 存在 Conf 配置文件中，**从未传递给 AI SDK 构造函数**。这导致 DeepSeek API 调用失败，返回空 stream，被当作"成功完成"处理，前端表现为"AI 无响应"。

---

## 二、Critical 问题清单（6 个）

| # | 来源 | 问题 | 文件位置 | 影响 |
|---|------|------|---------|------|
| C-1 | Agent链路 | **API Key 未传递给 AI SDK** | `executor.ts:330-332` | S04 全部失败的根因 |
| C-2 | 安全 | **API Key 硬编码在 deploy-package** | `deploy-package/.env:31` | API Key 泄露 |
| C-3 | 安全 | **WebSocket CORS 设为 `origin: '*'`** | `chat.gateway.ts:49` | 跨站 WebSocket 劫持 |
| C-4 | 安全 | **Agent Token 可预测** | `agent.gateway.ts:141` | 伪造 Agent 连接 |
| C-5 | 架构 | **P0-2 本地模式 `slice(0,-1)` 未修复** | `chat.gateway.ts:626` | 历史消息丢失 |
| C-6 | 架构 | **双重历史注入（resumeMessages + Memory）** | `mastra-agent.service.ts:517-543` | Token 浪费、AI 质量下降 |

---

## 三、High 问题清单（21 个）

### 安全类（6 个）
| # | 问题 | 文件位置 |
|---|------|---------|
| H-S1 | 登出未实现 Token 黑名单 | `auth.service.ts:108` |
| H-S2 | 无账户锁定/暴力破解防护 | `auth.service.ts:46` |
| H-S3 | WebSocket 事件缺授权验证（越权） | `chat.gateway.ts:168` |
| H-S4 | Session 操作缺所有者验证（IDOR） | `session.controller.ts:46` |
| H-S5 | SQL 工具无参数化查询 | `sql.ts:233` |
| H-S6 | API Key 通过 WebSocket 明文下发 | `agent.gateway.ts:272` |

### 架构类（8 个）
| # | 问题 | 文件位置 |
|---|------|---------|
| H-A1 | AgentGateway 任务派发无 ACK 确认 | `agent.gateway.ts:713` |
| H-A2 | 空 stream 被当作成功完成 | `executor.ts:471-480` |
| H-A3 | 无任务超时机制 | `agent.gateway.ts:64` |
| H-A4 | MastraAgentService 多实例/DI 问题 | `chat.module.ts:9` |
| H-A5 | 项目感知功能存在但未接入 | `mastra-agent.service.ts:452` |
| H-A6 | 所有 Agent 共享 Memory 无隔离 | `mastra-agent.service.ts:81` |
| H-A7 | Agent Token 验证形同虚设 | `agent.gateway.ts:315` |
| H-A8 | Upload 文件访问无所有权验证 | `upload.controller.ts:192` |

### 前端类（7 个）
| # | 问题 | 文件位置 |
|---|------|---------|
| H-F1 | socket.ts `listeners` 数组从未填充 | `socket.ts:54` |
| H-F2 | `connectSocket` 轮询无超时 | `socket.ts:80` |
| H-F3 | `stopGeneration` 未清理 workbench 监听 | `socket.ts:700` |
| H-F4 | 错误路径移除所有 workbench 监听 | `socket.ts:690` |
| H-F5 | 命令监听器从未从 socket 移除 | `socket.ts:765` |
| H-F6 | MessageList 每帧全量重渲染 | `MessageList.tsx:12` |
| H-F7 | MessageBubble Markdown 每帧重解析 | `MessageBubble.tsx:140` |

---

## 四、按子系统评分

| 子系统 | 评分 | 关键问题数(C+H) | 说明 |
|--------|------|-----------------|------|
| **Server 架构** | C+ | 8 | 模块化合理，但 Gateway DI 混乱，双重历史注入 |
| **安全** | D | 9 | 3个Critical+6个High，OWASP覆盖严重不足 |
| **前端** | B- | 7 | 组件设计合理，但 socket 管理和性能有显著问题 |
| **Client Agent 链路** | D | 4 | API Key 未传递是致命bug，链路缺少容错 |
| **数据库** | B | 1 | 基础设计合理，expand字段冗余 |

---

## 五、修复优先级排序

### 第一优先级 — 立即修复（预计 4h）

| 序号 | 任务 | 预计耗时 | 影响 |
|------|------|---------|------|
| 1 | **修复 executor.ts API Key 传递** | 15min | 解决 S04 全部失败 |
| 2 | **空 stream 错误检测** | 15min | 防止静默失败 |
| 3 | **修复 chat.gateway.ts:626 slice** | 30min | P0-2 完整修复 |
| 4 | **WebSocket CORS 限制** | 15min | 关闭跨站劫持 |
| 5 | **Agent Token 改用加密随机** | 30min | 防止 Agent 伪造 |
| 6 | **deploy-package 移除真实 Key** | 15min | 防止 Key 泄露 |
| 7 | **S04 二次全量回归** | 1h | 验证修复效果 |

### 第二优先级 — 本周内（预计 8h）

| 序号 | 任务 | 预计耗时 |
|------|------|---------|
| 8 | Session/Upload 所有者验证 | 1h |
| 9 | WebSocket 事件授权检查 | 1.5h |
| 10 | 任务超时 + ACK 机制 | 2h |
| 11 | Token 黑名单 + 登录锁定 | 2h |
| 12 | socket.ts 监听器管理重构 | 1.5h |

### 第三优先级 — 两周内（预计 12h）

| 序号 | 任务 | 预计耗时 |
|------|------|---------|
| 13 | MessageList/Bubble 性能优化 | 2h |
| 14 | 双重历史注入修复 | 2h |
| 15 | 项目感知功能接入 | 1h |
| 16 | Memory 统一方案 | 3h |
| 17 | SQL 工具只读限制 | 1h |
| 18 | SSRF 防护 + 路径沙箱 | 2h |
| 19 | 顶层 ErrorBoundary | 1h |

---

## 六、对 PM 报告的验证

PM 报告中的 5 层问题分析，我们逐一验证：

| PM 判断 | 审查结果 | 评价 |
|---------|---------|------|
| 第 1 层：chat.gateway.ts:626 P0-2 遗漏 | ✅ 确认，slice(0,-1) 与远程路径不一致 | 准确 |
| 第 2 层：任务派发无 ACK | ✅ 确认，fire-and-forget 模式 | 准确 |
| 第 3 层：工作目录上下文注入缺陷 | ⚠️ 部分正确，但真正原因是 API Key 未传递 | 方向正确但未到根因 |
| 第 4 层：双 Memory 隔离 | ✅ 确认，Agent 响应不回写 Server Memory | 准确 |
| 第 5 层：Agent 在线状态不可靠 | ✅ 确认，Token 验证形同虚设 | 准确 |

**PM 遗漏的最关键问题**：executor.ts 的 API Key 未传递给 deepseek() 构造函数。这是 S04 失败的**直接根因**，而非 PM 列出的 5 层问题。PM 的 5 层分析是链路中的其他薄弱环节，即使 API Key 修复后仍需解决。

---

## 七、结论

1. **本地模式修复可以很快**：修复 executor.ts API Key 传递（15分钟）+ 空 stream 检测（15分钟）即可解决 S04 核心问题
2. **安全问题比预想严重**：3 个 Critical 安全漏洞需要立即处理，特别是 WebSocket CORS 和 Agent Token
3. **前端核心问题在 socket.ts**：监听器管理完全失效，是多个 High 级别 bug 的根源
4. **架构设计合理但执行有缺陷**：双重历史注入、项目感知未接入、Memory 无隔离等说明 Mastra 迁移还有收尾工作

**核心策略与 PM 一致：不写新功能，先修通、测通已有的。**
