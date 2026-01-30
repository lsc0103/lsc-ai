# 当前任务上下文

> **用途**：记录当前正在进行的任务详情，确保对话压缩后不丢失任务上下文。
> **更新时机**：每次任务切换、任务完成、发现阻塞时立即更新。

---

## 当前任务

**阶段**：Phase 5 — 测试验证 + P0 问题修复
**状态**：未开始

### 待办事项

- [ ] P0-1: 修复 Instructions 与工具不匹配
  - 文件：`packages/server/src/services/mastra-agent.service.ts` → `getPlatformInstructions()`
  - 删除不存在的工具引用：`git_log`, `git_add`, `git_commit`, `git_branch`
  - 添加漏提及的工具：`editWord`, `editExcel`, `sqlConfig`, `modificationHistory`

- [ ] P0-2: 修复 TodoStore 单例问题
  - 文件：`packages/server/src/tools/advanced-tools.ts:140-141`
  - 将 `createTodoStore()` 提升为模块级单例

- [ ] P0-3: 重构工具包装层
  - 文件：`core-tools.ts`, `office-tools.ts`, `advanced-tools.ts`
  - 消除每次调用的 dynamic import + 类实例化
  - 改为模块顶层缓存实例或直接写业务逻辑

- [ ] 34 个 Server 工具逐一验证
- [ ] Memory 持久化验证
- [ ] Workflow + 定时任务运行时验证

### 上次会话结束时的状态

- 2026-01-30：建立了持久记忆系统
- 所有 P0 问题尚未开始修复
- 服务尚未启动运行

### 下次继续

从 P0-1（Instructions 修复）开始，这是最简单且影响最直接的修复。

---

## 最近完成的任务

### 2026-01-30
- ✅ 建立 Claude Code 三层持久记忆系统
- ✅ 全面阅读项目文档和代码结构
