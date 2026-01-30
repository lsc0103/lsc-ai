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

export interface WebFetchArgs {
  url: string;
  selector?: string; // CSS 选择器，可选，用于提取特定内容
}

/**
 * 获取网页内容工具
 */
export class WebFetchTool implements Tool {
  definition: ToolDefinition = {
    name: 'webFetch',
    description: '获取网页内容并解析。可以获取完整网页的文本内容，或使用 CSS 选择器提取特定部分。',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL 地址（必须是完整 URL，包含 http:// 或 https://）',
        },
        selector: {
          type: 'string',
          description: 'CSS 选择器（可选），用于提取特定内容。例如：".content"、"#main"、"article"',
        },
      },
      required: ['url'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { url, selector } = args as unknown as WebFetchArgs;
    try {
      // 验证 URL 格式
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return {
          success: false,
          output: '',
          error: 'URL 必须以 http:// 或 https:// 开头',
        };
      }

      // 懒加载 axios 和 cheerio
      const axios = await getAxios();
      const cheerio = await getCheerio();

      // 获取网页内容
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 30000, // 30秒超时
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // 移除脚本和样式标签
      $('script').remove();
      $('style').remove();
      $('noscript').remove();

      let content: string;

      // 如果指定了选择器，只提取匹配的部分
      if (selector) {
        const elements = $(selector);
        if (elements.length === 0) {
          return {
            success: false,
            output: '',
            error: `未找到匹配选择器 "${selector}" 的元素`,
          };
        }
        content = elements.map((_: number, el: any) => $(el).text()).get().join('\n\n');
      } else {
        // 否则提取整个 body 的文本
        content = $('body').text();
      }

      // 清理多余空白
      content = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

      // 限制输出长度
      const maxLen = 10000;
      if (content.length > maxLen) {
        content = content.slice(0, maxLen) + `\n\n... (内容已截断，共 ${content.length} 字符)`;
      }

      return {
        success: true,
        output: `URL: ${url}\n状态: ${response.status} ${response.statusText}\n\n内容:\n${content}`,
      };
    } catch (error) {
      const err = error as any;
      if (err.response) {
        return {
          success: false,
          output: '',
          error: `HTTP ${err.response.status}: ${err.response.statusText}`,
        };
      } else if (err.code === 'ENOTFOUND') {
        return {
          success: false,
          output: '',
          error: '无法解析域名，请检查 URL 是否正确',
        };
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
        return {
          success: false,
          output: '',
          error: '请求超时，请稍后重试',
        };
      } else {
        return {
          success: false,
          output: '',
          error: `网络请求失败: ${err.message}`,
        };
      }
    }
  }
}
