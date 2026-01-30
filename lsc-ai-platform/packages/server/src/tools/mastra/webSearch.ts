import type { Tool, ToolResult } from './types.js';
import type { ToolDefinition } from '../../llm/types.js';

// 懒加载 axios 和 cheerio 以加速启动
let axiosModule: typeof import('axios') | null = null;
let cheerioModule: any = null;

async function getAxios() {
  if (!axiosModule) {
    axiosModule = await import('axios');
  }
  return axiosModule.default;
}

async function getCheerio() {
  if (!cheerioModule) {
    cheerioModule = await import('cheerio');
  }
  return cheerioModule;
}

export interface WebSearchArgs {
  query: string;
  maxResults?: number;
  engine?: 'duckduckgo' | 'google' | 'bing';
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 网络搜索工具
 */
export class WebSearchTool implements Tool {
  private googleApiKey?: string;
  private googleSearchEngineId?: string;

  constructor(config?: { googleApiKey?: string; googleSearchEngineId?: string }) {
    this.googleApiKey = config?.googleApiKey;
    this.googleSearchEngineId = config?.googleSearchEngineId;
  }

  definition: ToolDefinition = {
    name: 'webSearch',
    description: `在互联网上搜索信息。支持 DuckDuckGo（默认，免费）、Google、Bing 搜索引擎。

【搜索技巧】构建高质量查询：
- 使用具体关键词，避免模糊描述
- 技术问题加上语言/框架名：如 "React useEffect cleanup function"
- 错误信息搜索时包含关键错误码：如 "ENOENT npm install error"
- 需要最新信息时加上年份：如 "Node.js best practices 2024"`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词。【技巧】使用具体关键词+技术栈+错误码，如 "TypeScript generic constraint extends error"',
        },
        maxResults: {
          type: 'number',
          description: '返回结果数量（默认 5，最多 10）',
        },
        engine: {
          type: 'string',
          description: '搜索引擎：duckduckgo（默认）、google、bing',
        },
      },
      required: ['query'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { query: rawQuery, maxResults: rawMaxResults, engine: rawEngine } = args as unknown as WebSearchArgs;
    const query = (rawQuery || '').trim();
    const maxResults = Math.min(rawMaxResults || 5, 10);
    const engine = rawEngine || 'duckduckgo';

    if (!query) {
      return {
        success: false,
        output: '',
        error: '搜索关键词不能为空',
      };
    }

    try {
      let results: SearchResult[];

      switch (engine) {
        case 'google':
          results = await this.searchGoogle(query, maxResults);
          break;
        case 'bing':
          results = await this.searchBing(query, maxResults);
          break;
        case 'duckduckgo':
        default:
          results = await this.searchDuckDuckGo(query, maxResults);
          break;
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `搜索 "${query}" 未找到结果`,
        };
      }

      // 格式化输出
      const output = [
        `搜索 "${query}" 找到 ${results.length} 个结果:\n`,
        ...results.map((r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   摘要: ${r.snippet}\n`
        ),
      ].join('\n');

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `搜索失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * DuckDuckGo 搜索（免费，无需 API 密钥）
   */
  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const axios = await getAxios();
      const cheerio = await getCheerio();
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.result').each((_i: number, elem: any) => {
        if (results.length >= maxResults) return false;

        const titleElem = $(elem).find('.result__a');
        const snippetElem = $(elem).find('.result__snippet');
        const urlElem = $(elem).find('.result__url');

        const title = titleElem.text().trim();
        const snippet = snippetElem.text().trim();
        let url = urlElem.attr('href') || '';

        // DuckDuckGo 的链接可能是重定向链接，需要提取真实 URL
        if (url.startsWith('//duckduckgo.com/l/?')) {
          const match = url.match(/uddg=([^&]+)/);
          if (match && match[1]) {
            url = decodeURIComponent(match[1]);
          }
        }

        if (title && url) {
          results.push({
            title,
            url: url.startsWith('http') ? url : `https:${url}`,
            snippet: snippet || '无摘要',
          });
        }
      });

      return results;
    } catch (error) {
      throw new Error(`DuckDuckGo 搜索失败: ${(error as Error).message}`);
    }
  }

  /**
   * Google 自定义搜索（需要 API 密钥）
   */
  private async searchGoogle(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      throw new Error('Google 搜索需要配置 API 密钥和搜索引擎 ID');
    }

    try {
      const axios = await getAxios();
      const url = 'https://www.googleapis.com/customsearch/v1';
      const response = await axios.get(url, {
        params: {
          key: this.googleApiKey,
          cx: this.googleSearchEngineId,
          q: query,
          num: maxResults,
        },
        timeout: 15000,
      });

      const items = response.data.items || [];
      return items.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet || '无摘要',
      }));
    } catch (error) {
      throw new Error(`Google 搜索失败: ${(error as Error).message}`);
    }
  }

  /**
   * Bing 搜索（通过 HTML 解析，免费）
   */
  private async searchBing(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const axios = await getAxios();
      const cheerio = await getCheerio();
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.b_algo').each((_i: number, elem: any) => {
        if (results.length >= maxResults) return false;

        const titleElem = $(elem).find('h2 a');
        const snippetElem = $(elem).find('.b_caption p');

        const title = titleElem.text().trim();
        const url = titleElem.attr('href') || '';
        const snippet = snippetElem.text().trim();

        if (title && url) {
          results.push({
            title,
            url,
            snippet: snippet || '无摘要',
          });
        }
      });

      return results;
    } catch (error) {
      throw new Error(`Bing 搜索失败: ${(error as Error).message}`);
    }
  }
}
