# LLM 多模型架构技术调研报告

> **报告人**：工程团队
> **日期**：2026-02-10
> **状态**：初版完成，待 PM 审阅

---

## 一、公司可用 API 资源盘点

### 1.1 完整资源清单

公司在内网 `10.18.55.233:30069` 已部署 **7 个模型服务**（OpenAI 兼容 API 格式）：

| # | 模型 | Endpoint | API Key | 类型 |
|---|------|----------|---------|------|
| 1 | **DeepSeek V3** | `/deepseek_v3/chi/v1/chat/completions` | `7bb05b8a-5cbb-41db-974f-b1df38598357` | 通用对话 |
| 2 | **DeepSeek R1** | `/deepseek_r1/chi/v1/chat/completions` | placeholder | 深度推理 |
| 3 | **DeepSeek R1 Distill Qwen 32B** | `/deepSeek-r1-distill-qwen-32b/chi/v1` | placeholder | 轻量推理 |
| 4 | **Qwen2.5-72B-Instruct** | `/qwen2.5-72b-instruct/chi/v1` | placeholder | 通用对话 |
| 5 | **Qwen2.5-VL-32B-Instruct** | `/qwen2.5-vl-32b-instruct/chi/v1` | placeholder | 多模态视觉 |
| 6 | **text-embedding-v1/v2** | `/embedding/chi/v1/embeddings` | `a818c61b-21cf-4ee1-962b-55fe2c773db2` | 文本向量化 |
| 7 | **text-rerank-v1/v2** | `/rerank/chi/v1/rerank` | `275c91fa-72b6-47a4-b367-213412eca8ef` | 检索重排序 |

另有 **DeepSeek 官方 API**（开发测试用，走外网）：
- Key: `sk-dedfe1c096b9493c85b5af11df5564af`
- Endpoint: `https://api.deepseek.com`

### 1.2 关键发现

1. **全部内网模型都在同一台机器上**（10.18.55.233:30069），说明公司有 GPU 集群或模型服务平台
2. **API 格式全部兼容 OpenAI**（`/v1/chat/completions` 或 `/v1`），意味着接入成本极低
3. **不仅有 Chat 模型，还有 Embedding 和 Rerank**——直接支撑 RAG/知识库功能
4. 部分 API Key 为 placeholder（`your-internal-api-key-here`），需要向公司 IT 部门申请真实 Key

---

## 二、模型能力对比矩阵

### 2.1 Chat 模型横向对比

| 特性 | DeepSeek V3 | DeepSeek R1 | R1-Distill-32B | Qwen2.5-72B | Qwen2.5-VL-32B |
|------|:-----------:|:-----------:|:--------------:|:-----------:|:---------------:|
| **参数量** | 671B (MoE, 37B活跃) | 671B (MoE) | 32B (Dense) | 72B (Dense) | 32B (Dense) |
| **上下文窗口** | 128K | 128K (输入64K) | 128K | 32K~128K | 32K~128K |
| **Function Calling** | **✅ 稳定** | **⚠️ 不稳定** | **❌ 不支持** | **✅ 原生支持** | **⚠️ 有限** |
| **中文能力** | ★★★★★ | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ |
| **推理能力** | ★★★★ | ★★★★★ | ★★★★ | ★★★☆ | ★★★☆ |
| **多模态(图片)** | ❌ | ❌ | ❌ | ❌ | **✅** |
| **速度** | 中 | 慢(CoT) | 快 | 中 | 中 |
| **并发承压** | 中 | 低 | 高 | 中 | 高 |

### 2.2 Function Calling 详细分析（**最关键的分水岭**）

LSC-AI 平台有 **46 个工具**依赖 Function Calling，这是选型的第一优先级：

| 模型 | Function Calling 状态 | 详细说明 |
|------|:-------------------:|---------|
| **DeepSeek V3** | ✅ 可用 | V3-0324 (2025.3) 版本后稳定。**需确认公司部署版本**——原始 V3 (2024.12) 不稳定 |
| **DeepSeek R1** | ⚠️ 不可靠 | 2025.5.28 版本才添加工具调用，官方承认"不稳定，可能循环调用或空响应"。vLLM 明确 "推理模型不支持工具调用" |
| **R1-Distill-32B** | ❌ 不支持 | 推理和工具调用不能同时启用。社区有第三方模板但非官方 |
| **Qwen2.5-72B** | ✅ 原生 | 训练时内置工具调用能力，开源模型 Agent 评测排名第 7。工具选择准确率 0.66 |
| **Qwen2.5-VL-32B** | ⚠️ 有限 | 官方提到支持但 prompt 模板未完善，社区正在修复 |

**结论：只有 DeepSeek V3 和 Qwen2.5-72B 可以用于 LSC-AI 的工具调用场景。**

### 2.3 各模型推荐用途

```
┌─────────────────────────────────────────────────────────────────┐
│                    LSC-AI 多模型路由策略                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户消息 ──→ 路由器判断 ──┬──→ 通用对话+工具调用                  │
│                           │    → DeepSeek V3 (主)                │
│                           │    → Qwen2.5-72B (备)                │
│                           │                                     │
│                           ├──→ 复杂推理/分析/数学                 │
│                           │    → DeepSeek R1 (禁用工具调用)       │
│                           │    → R1-Distill-32B (轻量)           │
│                           │                                     │
│                           ├──→ 图片/文档/图表理解                 │
│                           │    → Qwen2.5-VL-32B (唯一选择)       │
│                           │                                     │
│                           └──→ RAG 知识库检索                    │
│                                → embedding-v2 (向量化)           │
│                                → rerank-v2 (精排)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、现有代码架构分析

### 3.1 当前 LLM 调用链路

```
用户浏览器
  │ Socket.IO
  ▼
ChatGateway ──┬── 远程模式(无 deviceId) ──→ MastraAgentService
              │                             │
              │                             ├── platformAgent.stream()
              │                             │   model: deepseek('deepseek-chat')  ← 硬编码!
              │                             │   34 个 Server 端工具
              │                             │
              │                             └── AgentNetwork (code-expert/data-analyst/office-worker)
              │                                 每个 model: deepseek('deepseek-chat')  ← 硬编码!
              │
              └── 本地模式(有 deviceId) ──→ AgentService.dispatchTaskToAgent()
                                            │ Socket.IO
                                            ▼
                                          Client Agent: executor.ts
                                            model: createDeepSeek({apiKey, baseURL})(modelName)
                                            46 个本地工具
```

### 3.2 硬编码问题

**Server 端**（`mastra-agent.service.ts`）— 4 处完全相同的硬编码：

| Agent | 代码 | 行号 |
|-------|------|------|
| Platform Agent | `model: deepseek('deepseek-chat')` | :122 |
| Code Expert | `model: deepseek('deepseek-chat')` | :204 |
| Data Analyst | `model: deepseek('deepseek-chat')` | :266 |
| Office Worker | `model: deepseek('deepseek-chat')` | :312 |

`deepseek()` 短写法自动读取 `process.env.DEEPSEEK_API_KEY`，绕过 NestJS ConfigService。

**Client Agent 端**（`executor.ts:340-348`）— 已有 Provider 切换雏形：

```typescript
const provider = config.apiProvider || 'deepseek';  // 从持久配置读取
const model = provider === 'deepseek'
  ? createDeepSeek({ apiKey, baseURL })(modelName)   // :347
  : createOpenAI({ apiKey, baseURL })(modelName);     // :348
```

**配对下发**（`agent.service.ts:126-131`）— LLM 配置硬编码 'deepseek'：

```typescript
const llmConfig: LLMConfig = {
  apiProvider: 'deepseek',                          // 硬编码
  apiBaseUrl: configService.get('DEEPSEEK_API_BASE'),
  apiKey: configService.get('DEEPSEEK_API_KEY'),
  model: configService.get('DEEPSEEK_MODEL') || 'deepseek-chat',
};
```

### 3.3 已安装的 @ai-sdk Provider

| 包 | 版本 | 位置 |
|----|------|------|
| `@ai-sdk/deepseek` | 2.0.12 | Server + Client Agent |
| `@ai-sdk/openai` | 1.3.24 | 仅 Client Agent |
| `@ai-sdk/provider` | 1.1.3~3.0.5 | 基础接口 |

**注意**：Server 端**没有** `@ai-sdk/openai`，需要新增安装。`@ai-sdk/openai` 的 `createOpenAI({ baseURL })` 可对接任何 OpenAI 兼容 API（包括公司内网模型）。

---

## 四、Provider 抽象层设计方案

### 4.1 配置 Schema

新增环境变量（`.env`）：

```bash
# -------- LLM 多模型配置 --------

# 默认模型（通用对话 + 工具调用）
LLM_DEFAULT_PROVIDER=openai-compatible
LLM_DEFAULT_BASE_URL=http://10.18.55.233:30069/deepseek_v3/chi/v1
LLM_DEFAULT_API_KEY=7bb05b8a-5cbb-41db-974f-b1df38598357
LLM_DEFAULT_MODEL=deepseek-chat

# 推理模型（复杂分析，禁用工具调用）
LLM_REASONING_PROVIDER=openai-compatible
LLM_REASONING_BASE_URL=http://10.18.55.233:30069/deepseek_r1/chi/v1
LLM_REASONING_API_KEY=your-internal-api-key-here
LLM_REASONING_MODEL=deepseek-r1

# 视觉模型（图片理解）
LLM_VISION_PROVIDER=openai-compatible
LLM_VISION_BASE_URL=http://10.18.55.233:30069/qwen2.5-vl-32b-instruct/chi/v1
LLM_VISION_API_KEY=your-internal-api-key-here
LLM_VISION_MODEL=qwen2.5-vl-32b-instruct

# 备用模型（主模型不可用时降级）
LLM_FALLBACK_PROVIDER=openai-compatible
LLM_FALLBACK_BASE_URL=http://10.18.55.233:30069/qwen2.5-72b-instruct/chi/v1
LLM_FALLBACK_API_KEY=your-internal-api-key-here
LLM_FALLBACK_MODEL=qwen2.5-72b-instruct

# 开发环境覆盖（走 DeepSeek 官方 API）
# LLM_DEFAULT_PROVIDER=deepseek
# LLM_DEFAULT_API_KEY=sk-dedfe1c096b9493c85b5af11df5564af
# LLM_DEFAULT_MODEL=deepseek-chat
```

### 4.2 ModelFactory 核心代码（伪代码）

```typescript
// src/services/model-factory.ts (新建)
import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModelV1 } from '@ai-sdk/provider';

interface ModelConfig {
  provider: 'deepseek' | 'openai-compatible' | 'openai';
  baseUrl?: string;
  apiKey: string;
  model: string;
}

// 按角色获取模型配置
type ModelRole = 'default' | 'reasoning' | 'vision' | 'fallback';

function getModelConfig(role: ModelRole): ModelConfig {
  const prefix = `LLM_${role.toUpperCase()}`;
  return {
    provider: process.env[`${prefix}_PROVIDER`] || 'deepseek',
    baseUrl: process.env[`${prefix}_BASE_URL`],
    apiKey: process.env[`${prefix}_API_KEY`] || process.env.DEEPSEEK_API_KEY,
    model: process.env[`${prefix}_MODEL`] || 'deepseek-chat',
  };
}

function createModel(config: ModelConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'deepseek':
      return createDeepSeek({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })(config.model);

    case 'openai-compatible':
    case 'openai':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        compatibility: 'compatible',    // 关键：兼容非标准 API
      })(config.model);

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

// 导出给各 Agent 使用
export function getDefaultModel(): LanguageModelV1 {
  return createModel(getModelConfig('default'));
}
export function getReasoningModel(): LanguageModelV1 {
  return createModel(getModelConfig('reasoning'));
}
export function getVisionModel(): LanguageModelV1 {
  return createModel(getModelConfig('vision'));
}
export function getFallbackModel(): LanguageModelV1 {
  return createModel(getModelConfig('fallback'));
}
```

### 4.3 改造点清单

| # | 文件 | 改动内容 | 估算行数 |
|---|------|---------|---------|
| 1 | **新建** `src/services/model-factory.ts` | Provider 工厂函数 | ~60行 |
| 2 | `mastra-agent.service.ts` :122,:204,:266,:312 | 4 处 `deepseek('deepseek-chat')` → `getDefaultModel()` | ~10行 |
| 3 | `modules/agent/agent.service.ts` :126-131 | 配对下发配置改为读取新环境变量 | ~10行 |
| 4 | `.env` / `.env.example` | 新增 LLM_* 环境变量 | ~20行 |
| 5 | `package.json` (server) | 新增 `@ai-sdk/openai` 依赖 | 1行 |
| 6 | `executor.ts` :340-348 (client-agent) | 扩展 provider 分支支持 openai-compatible | ~15行 |
| **总计** | | | **~116行** |

### 4.4 工时评估

| 改造项 | 工时 | 说明 |
|--------|------|------|
| Phase 1: Provider 抽象层 | **4h** | 新建 model-factory.ts + 修改 4 个 Agent + 环境变量 |
| Phase 2: 公司内网模型接入 | **2h** | 配置内网 endpoint + 验证连通性 |
| Phase 3: Client Agent 适配 | **2h** | executor.ts 扩展 + 配对下发配置更新 |
| Phase 4: 集成测试 | **3h** | 远程/本地/Network 三种模式 × 多模型 |
| **总计** | **~11h** | **约 1.5~2 个工作日** |

---

## 五、多模型混合路由方案

### 5.1 路由策略

```
用户消息 → 路由判断层
  │
  ├── 场景 A: 检测到图片附件
  │   → Qwen2.5-VL-32B（视觉模型）
  │   → 解决 P2 "DeepSeek 不支持图片" 问题
  │
  ├── 场景 B: 用户明确要求深度分析/推理/数学
  │   → DeepSeek R1（推理模型，禁用工具调用）
  │   → 返回文本分析结果
  │
  ├── 场景 C: 普通对话 + 工具调用（默认）
  │   → DeepSeek V3（主力模型）
  │   → 46 个工具正常使用
  │
  └── 场景 D: V3 不可用 / 限流 / 超时
      → Qwen2.5-72B（备用模型，原生工具调用）
      → 自动降级，用户无感知
```

### 5.2 降级链

```
DeepSeek V3 (公司内网)
  │ 失败/超时/限流
  ▼
Qwen2.5-72B (公司内网，原生 Function Calling)
  │ 失败
  ▼
DeepSeek V3 (官方 API，走外网，开发环境 fallback)
  │ 失败
  ▼
返回错误提示："AI 服务暂时不可用，请稍后重试"
```

### 5.3 限流管理方案

```typescript
// LLM 级别限流（非 HTTP 层）
interface RateLimiter {
  maxConcurrent: number;    // 最大并发数
  maxRPM: number;           // 每分钟最大请求数
  queueSize: number;        // 等待队列大小
  timeoutMs: number;        // 单次请求超时
}

// 按模型配置不同限流策略
const rateLimits: Record<ModelRole, RateLimiter> = {
  default:   { maxConcurrent: 50,  maxRPM: 200, queueSize: 100, timeoutMs: 60_000 },
  reasoning: { maxConcurrent: 10,  maxRPM: 30,  queueSize: 20,  timeoutMs: 300_000 },
  vision:    { maxConcurrent: 20,  maxRPM: 60,  queueSize: 30,  timeoutMs: 120_000 },
  fallback:  { maxConcurrent: 30,  maxRPM: 100, queueSize: 50,  timeoutMs: 90_000 },
};
```

### 5.4 Token 用量监控

- 利用 AI SDK 已有的 `onTokenUsage` 回调（chat.gateway.ts 已实现 `chat:token_usage` 事件推送）
- 新增 Token 用量表（Prisma migration）：记录每次 AI 调用的 model、input_tokens、output_tokens
- Dashboard（可选）：按模型/用户/时段统计 Token 消耗

---

## 六、PoC 验证计划

### 6.1 推荐 PoC 顺序

| 阶段 | 目标 | 模型 | 验证场景 | 预计耗时 |
|------|------|------|---------|---------|
| **PoC-1** | 内网 V3 替换官方 API | DeepSeek V3 (内网) | 全量功能回归 | 0.5天 |
| **PoC-2** | Qwen2.5-72B 工具调用 | Qwen2.5-72B | 46 个工具能否正常调用 | 1天 |
| **PoC-3** | VL-32B 图片理解 | Qwen2.5-VL-32B | 上传图片→AI 识别内容 | 0.5天 |
| **PoC-4** | R1 推理模式 | DeepSeek R1 | 复杂分析任务（禁用工具） | 0.5天 |
| **PoC-5** | 降级链验证 | V3→Qwen2.5-72B | 模拟 V3 超时→自动切换 | 0.5天 |

### 6.2 PoC-1 详细方案（最优先）

**目标**：验证公司内网 DeepSeek V3 能否直接替换官方 API。

**步骤**：
1. 修改 `.env`：
   ```
   DEEPSEEK_API_KEY=7bb05b8a-5cbb-41db-974f-b1df38598357
   DEEPSEEK_BASE_URL=http://10.18.55.233:30069/deepseek_v3/chi/v1
   ```
2. 重启 Server
3. 运行 Stage 4 回归测试（13 项），验证功能完整性
4. 测量响应延迟和限流情况

**预期结果**：如果公司 V3 是 0324 或更新版本，应当全量通过。

**风险点**：
- 公司内网可能需要特殊的认证头格式
- 内网 API 响应格式可能与官方略有差异
- 需要从开发机访问 `10.18.55.233:30069`（需确认网络可达性）

---

## 七、硬件资源需求评估

### 7.1 当前状态

公司已在 `10.18.55.233` 部署了全部模型，**不需要额外购买 GPU 服务器**。

### 7.2 容量评估（需确认）

需要向 IT 部门确认以下信息：

| 问题 | 影响 |
|------|------|
| 10.18.55.233 的 GPU 型号和数量？ | 决定并发承载能力 |
| 各模型 API 的并发限制是多少？ | 决定限流配置 |
| 是否有 SLA 保障（可用性/响应时间）？ | 决定是否需要降级链 |
| API Key placeholder 何时可以申请到真实 Key？ | 决定 PoC 启动时间 |
| 是否支持 streaming（SSE）？ | LSC-AI 依赖流式输出 |
| 部署版本号（V3 是哪个版本）？ | 决定 Function Calling 稳定性 |

### 7.3 如需额外部署的硬件档位（仅供参考，当前不需要）

| 档位 | GPU 配置 | 可运行模型 | 并发能力 | 月成本估算 |
|------|---------|-----------|---------|-----------|
| 最小可用 | 2× A100 80GB | Qwen2.5-72B (INT4量化) | ~10并发 | ~¥3万/月 |
| 推荐 | 4× A100 80GB | DeepSeek V3 (MoE) + Qwen2.5-72B | ~30并发 | ~¥6万/月 |
| 高并发 | 8× A100 80GB + 4× A100 80GB | 全部模型 + 400+并发 | ~100并发 | ~¥15万/月 |

**注：以上仅为自建部署的参考。公司既然已有 10.18.55.233 的部署，优先使用现有资源。**

---

## 八、实施路线图

```
Week 1 (Phase 1): Provider 抽象层
├── Day 1: 创建 model-factory.ts + 修改 4 个 Agent 硬编码
├── Day 2: 环境变量设计 + Client Agent 适配 + 集成测试
└── 交付物: 代码提交 + 配置文档

Week 1-2 (Phase 2): 公司内网模型接入
├── Day 3: 申请真实 API Key + 网络连通性测试
├── Day 4: PoC-1 (内网 V3 替换) + PoC-2 (Qwen2.5-72B 工具调用)
└── 交付物: PoC 测试报告

Week 2 (Phase 3): 多模型路由
├── Day 5: 实现路由判断层 + 降级链
├── Day 6: PoC-3 (VL 视觉) + PoC-4 (R1 推理) + PoC-5 (降级链)
└── 交付物: 路由策略代码 + 全量测试通过

Week 3 (Phase 4): 监控 + 优化
├── Token 用量统计表 + 限流管理
├── 可选: 管理界面（模型配置、用量 Dashboard）
└── 交付物: 监控系统 + 运维文档
```

---

## 九、关键风险和建议

### 9.1 必须提前确认的事项

| # | 事项 | 负责人 | 阻塞程度 |
|---|------|--------|---------|
| 1 | 10.18.55.233 从开发机是否网络可达 | IT | **阻塞 PoC** |
| 2 | 4 个 placeholder API Key 的真实 Key | IT | **阻塞 PoC** |
| 3 | 公司 DeepSeek V3 的部署版本号 | IT | 影响稳定性评估 |
| 4 | 各 API 的并发限制和 SLA | IT | 影响限流设计 |
| 5 | 是否支持 SSE streaming | IT | **影响核心功能** |

### 9.2 技术风险

1. **Function Calling 兼容性**：公司内网模型的 Function Calling 格式可能与 OpenAI 标准有差异。需要在 PoC 中逐个验证 46 个工具。

2. **R1 不能用于工具调用**：这是最大的限制。如果用户需要"深度分析+执行操作"的组合场景，需要先用 R1 分析再用 V3 执行，两步路由增加复杂度。

3. **Memory 一致性**：如果不同请求被路由到不同模型，Memory（LibSQL + fastembed）的语义搜索结果可能不一致（不同模型对同一 embedding 的理解不同）。建议所有模型共用同一 embedding 模型。

### 9.3 建议优先级

1. **最高优先级**：PoC-1 — 内网 V3 替换官方 API（几乎零改动，只改 .env）
2. **高优先级**：Provider 抽象层（1.5 天工时，一次性解决架构债务）
3. **中优先级**：Qwen2.5-72B 作为备用通道 + 降级链
4. **低优先级**：VL-32B 图片理解 + R1 推理路由（增值功能）

---

## 十、总结

**公司的 LLM 基础设施比预期好得多**——5 个 Chat 模型 + 2 个辅助模型已在内网部署，全部兼容 OpenAI API 格式。

**核心结论**：

1. **改造量很小**（~116 行代码，~11h 工时），因为 Mastra SDK + AI SDK 天然支持 Provider 切换
2. **Function Calling 是选型的第一约束**——只有 DeepSeek V3 和 Qwen2.5-72B 可靠支持，R1 系列不行
3. **Qwen2.5-VL-32B 直接解决 P2 图片问题**——这是当前唯一的多模态模型
4. **Embedding + Rerank 为 RAG 奠定基础**——LSC-AI 的知识库功能可以直接用
5. **不需要额外硬件**——公司现有部署足够，关键是申请 API Key 和确认网络连通性

**下一步行动**：
1. 向 IT 确认网络连通性 + 申请 API Key
2. 执行 PoC-1（只改 .env，验证内网 V3 能否替换官方 API）
3. 实施 Provider 抽象层改造
