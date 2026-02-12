/**
 * EmbeddingFactory — 嵌入向量工厂
 *
 * 支持两种 provider：
 * - fastembed: 本地 all-MiniLM-L6-v2 模型（384维），无需外部服务
 * - api: 公司 Embedding API（兼容 OpenAI /v1/embeddings 格式，1536维）
 *
 * 同时集成 Rerank 能力（仅 api 模式可用）
 */

export type EmbeddingProvider = 'fastembed' | 'api';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiUrl?: string;
  apiKey?: string;
  rerankUrl?: string;
  rerankKey?: string;
}

export interface RerankResult {
  index: number;
  score: number;
}

export class EmbeddingFactory {
  private static _instance: EmbeddingFactory | null = null;

  private provider: EmbeddingProvider;
  private fastembedModule: any = null;
  private apiUrl?: string;
  private apiKey?: string;
  private rerankUrl?: string;
  private rerankKey?: string;
  private initialized = false;

  private constructor(config: EmbeddingConfig) {
    this.provider = config.provider;
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.rerankUrl = config.rerankUrl;
    this.rerankKey = config.rerankKey;
  }

  /**
   * 从环境变量创建（缓存单例）
   */
  static createFromEnv(): EmbeddingFactory {
    if (EmbeddingFactory._instance) {
      return EmbeddingFactory._instance;
    }

    const provider = (process.env.EMBEDDING_PROVIDER || 'fastembed') as EmbeddingProvider;
    const config: EmbeddingConfig = {
      provider,
      apiUrl: process.env.EMBEDDING_API_URL,
      apiKey: process.env.EMBEDDING_API_KEY,
      rerankUrl: process.env.RERANK_API_URL,
      rerankKey: process.env.RERANK_API_KEY,
    };

    EmbeddingFactory._instance = new EmbeddingFactory(config);
    return EmbeddingFactory._instance;
  }

  /**
   * 初始化（延迟加载 fastembed 或验证 API 配置）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.provider === 'fastembed') {
      const mod = await import('@mastra/fastembed');
      this.fastembedModule = mod.fastembed;
    } else if (this.provider === 'api') {
      if (!this.apiUrl) {
        throw new Error('EMBEDDING_API_URL is required when EMBEDDING_PROVIDER=api');
      }
      if (!this.apiKey) {
        throw new Error('EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=api');
      }
    }

    this.initialized = true;
  }

  /**
   * 嵌入文本
   */
  async embed(texts: string[]): Promise<number[][]> {
    await this.initialize();

    if (this.provider === 'fastembed') {
      const { embeddings } = await this.fastembedModule.doEmbed({ values: texts });
      return embeddings;
    }

    // api 模式: POST /v1/embeddings (OpenAI 兼容格式)
    const response = await fetch(this.apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: 'text-embedding-v2',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Embedding API error ${response.status}: ${errText}`);
    }

    const json = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    return json.data.map((d) => d.embedding);
  }

  /**
   * Rerank（仅 api 模式可用）
   *
   * 返回按相关性降序排列的结果；fastembed 模式返回 null
   */
  async rerank(
    query: string,
    documents: string[],
    topK: number = 5,
  ): Promise<RerankResult[] | null> {
    if (this.provider === 'fastembed') {
      return null;
    }

    if (!this.rerankUrl || !this.rerankKey) {
      return null;
    }

    await this.initialize();

    const response = await fetch(this.rerankUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.rerankKey}`,
      },
      body: JSON.stringify({
        query,
        documents,
        top_n: topK,
        model: 'text-rerank-v2',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Rerank API error ${response.status}: ${errText}`);
    }

    const json = await response.json() as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    return json.results.map((r) => ({
      index: r.index,
      score: r.relevance_score,
    }));
  }

  /**
   * 获取嵌入维度
   */
  getDimension(): number {
    if (this.provider === 'fastembed') {
      return 384; // all-MiniLM-L6-v2
    }
    return 1536; // text-embedding-v2
  }

  /**
   * 获取当前 provider
   */
  getProvider(): EmbeddingProvider {
    return this.provider;
  }

  /**
   * 是否支持 Rerank
   */
  supportsRerank(): boolean {
    return this.provider === 'api' && !!this.rerankUrl && !!this.rerankKey;
  }

  /**
   * 获取配置信息（用于启动日志，不泄露 key）
   */
  static getConfigInfo(): string {
    const provider = process.env.EMBEDDING_PROVIDER || 'fastembed';
    const apiUrl = process.env.EMBEDDING_API_URL || '(none)';
    const hasApiKey = !!process.env.EMBEDDING_API_KEY;
    const rerankUrl = process.env.RERANK_API_URL || '(none)';
    const hasRerankKey = !!process.env.RERANK_API_KEY;

    if (provider === 'fastembed') {
      return `Embedding: fastembed (all-MiniLM-L6-v2, dim=384)`;
    }

    return `Embedding: api (${apiUrl}, key=${hasApiKey ? 'set' : 'missing'}, dim=1536), Rerank: ${rerankUrl} (key=${hasRerankKey ? 'set' : 'missing'})`;
  }
}
