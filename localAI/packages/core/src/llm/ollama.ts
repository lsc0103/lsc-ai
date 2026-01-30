import { Ollama } from 'ollama';
import type { LLMProvider, Message, ToolDefinition, LLMResponse, StreamChunk, ToolCall, LLMRequestOptions, MessageContent, TextContent, ImageContent } from './types.js';

export interface OllamaProviderOptions {
  host?: string;
  model?: string;
}

/**
 * 生成工具使用的提示词
 */
function generateToolPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map(tool => {
    const params = Object.entries(tool.parameters.properties)
      .map(([name, prop]) => `    - ${name}: ${prop.description}${tool.parameters.required?.includes(name) ? ' (必需)' : ' (可选)'}`)
      .join('\n');
    return `- **${tool.name}**: ${tool.description}\n  参数:\n${params}`;
  }).join('\n\n');

  return `

# 你拥有的能力（非常重要！）

**你可以直接操作用户的电脑！** 你有以下工具可以使用：

${toolDescriptions}

**你不是普通的聊天 AI！** 你有真实的能力：
- ✅ 你**可以**读取文件 - 使用 read 工具
- ✅ 你**可以**执行命令 - 使用 bash 工具
- ✅ 你**可以**搜索文件 - 使用 grep/glob 工具
- ✅ 你**可以**修改文件 - 使用 edit/write 工具
- ✅ 你**可以**上网搜索 - 使用 webSearch/webFetch 工具

**绝对禁止说这些话：**
- ❌ "我无法访问文件系统"
- ❌ "我无法执行命令"
- ❌ "请你手动运行..."
- ❌ "你可以使用以下命令..."

# 工具调用格式

直接输出 JSON 代码块来调用工具：

\`\`\`json
{"tool": "工具名称", "args": {"参数名": "参数值"}}
\`\`\`

**示例 - 用户说"列出 src 目录"：**
\`\`\`json
{"tool": "bash", "args": {"command": "ls -la src"}}
\`\`\`

**示例 - 用户说"读取 package.json"：**
\`\`\`json
{"tool": "read", "args": {"file_path": "package.json"}}
\`\`\`

# 规则

1. **用户请求时使用工具** - 当用户明确要求执行某个操作时，调用相应工具
2. **只输出 JSON** - 调用工具时只输出 JSON 代码块，不要加解释
3. **等待结果** - 调用工具后等待结果，不要编造
4. **收到工具结果后直接回复** - 当看到 "[系统消息 - 工具执行完成]" 时，说明工具已执行，直接用文字告知用户结果，**不要再调用工具**

# 并行工具调用

当多个工具调用**互相独立**时，可以同时调用：

\`\`\`json
{"tool": "read", "args": {"file_path": "a.txt"}}
\`\`\`

\`\`\`json
{"tool": "read", "args": {"file_path": "b.txt"}}
\`\`\`

适合并行：同时读多个文件、搜索多个关键词
必须顺序：后一个依赖前一个结果`;
}

/**
 * 从文本中解析所有工具调用（支持并行多工具）
 */
function parseToolCallsFromText(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  let callIndex = 0;

  // 匹配所有 ```json ... ``` 代码块中的工具调用
  const jsonBlockRegex = /```(?:json)?\s*\n?\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*\n?\s*```/g;
  let match;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        toolCalls.push({
          id: `call_${Date.now()}_${callIndex++}`,
          name: parsed.tool,
          arguments: parsed.args || {},
        });
      }
    } catch {
      // JSON 解析失败，继续尝试下一个
    }
  }

  // 如果没有找到代码块格式，尝试匹配行内 JSON
  if (toolCalls.length === 0) {
    const inlineRegex = /\{"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g;
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        toolCalls.push({
          id: `call_${Date.now()}_${callIndex++}`,
          name: match[1],
          arguments: args,
        });
      } catch {
        // 解析失败，继续
      }
    }
  }

  return toolCalls;
}

/**
 * Ollama LLM Provider
 */
export class OllamaProvider implements LLMProvider {
  private client: Ollama;
  private model: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.client = new Ollama({ host: options.host || 'http://localhost:11434' });
    this.model = options.model || 'qwen2.5:7b-instruct';
  }

  /**
   * 获取当前模型名称
   */
  getModel(): string {
    return this.model;
  }

  /**
   * 切换模型
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    const response = await this.client.list();
    return response.models.map((m: { name: string }) => m.name);
  }

  /**
   * 从 data URL 中提取 base64 数据
   */
  private extractBase64FromDataUrl(dataUrl: string): string {
    // 匹配 data:image/xxx;base64, 前缀
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (match) {
      return match[1];
    }
    // 如果不是 data URL，直接返回（可能已经是纯 base64）
    return dataUrl;
  }

  /**
   * 从多模态内容中提取文本和图片
   */
  private extractContentAndImages(content: MessageContent): { text: string; images: string[] } {
    if (typeof content === 'string') {
      return { text: content, images: [] };
    }

    const texts: string[] = [];
    const images: string[] = [];

    for (const part of content) {
      if (part.type === 'text') {
        texts.push(part.text);
      } else if (part.type === 'image_url') {
        // Ollama 需要纯 base64 数据，不带 data URL 前缀
        const base64 = this.extractBase64FromDataUrl(part.image_url.url);
        images.push(base64);
      }
    }

    return { text: texts.join('\n'), images };
  }

  /**
   * 将内部消息格式转换为 Ollama 格式
   * 注意：合并连续的工具结果消息，避免产生连续的 user 消息
   */
  private formatMessages(messages: Message[], tools?: ToolDefinition[]) {
    const formatted: Array<{ role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }> = [];

    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];

      // 合并连续的工具结果消息为一条 user 消息
      if (msg.role === 'tool') {
        const toolResults: string[] = [];
        const allImages: string[] = [];

        // 收集所有连续的工具结果
        while (i < messages.length && messages[i].role === 'tool') {
          const { text, images } = this.extractContentAndImages(messages[i].content);
          toolResults.push(`• ${text}`);
          allImages.push(...images);
          i++;
        }

        // 合并成一条简洁的消息
        const combinedContent = `[操作完成]
${toolResults.join('\n')}

请简要告知用户操作结果。`;

        const baseMessage = {
          role: 'user' as const,
          content: combinedContent,
        };
        if (allImages.length > 0) {
          formatted.push({ ...baseMessage, images: allImages });
        } else {
          formatted.push(baseMessage);
        }
        continue;
      }

      const { text, images } = this.extractContentAndImages(msg.content);
      const baseMessage = {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: text,
      };
      if (images.length > 0) {
        formatted.push({ ...baseMessage, images });
      } else {
        formatted.push(baseMessage);
      }
      i++;
    }

    // 在系统消息中添加工具说明
    if (tools && tools.length > 0 && formatted.length > 0 && formatted[0].role === 'system') {
      formatted[0] = {
        ...formatted[0],
        content: formatted[0].content + generateToolPrompt(tools),
      };
    }

    return formatted;
  }

  /**
   * 非流式对话
   */
  async chat(messages: Message[], tools?: ToolDefinition[], options?: LLMRequestOptions): Promise<LLMResponse> {
    // 检查是否已中断
    if (options?.signal?.aborted) {
      throw new DOMException('请求已中断', 'AbortError');
    }

    const response = await this.client.chat({
      model: this.model,
      messages: this.formatMessages(messages, tools),
      stream: false,
    });

    const content = response.message.content;
    const toolCalls = tools ? parseToolCallsFromText(content) : [];

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      done: true,
    };
  }

  /**
   * 流式对话
   */
  async *chatStream(messages: Message[], tools?: ToolDefinition[], options?: LLMRequestOptions): AsyncIterable<StreamChunk> {
    // 检查是否已中断
    if (options?.signal?.aborted) {
      throw new DOMException('请求已中断', 'AbortError');
    }

    const response = await this.client.chat({
      model: this.model,
      messages: this.formatMessages(messages, tools),
      stream: true,
    });

    let fullContent = '';

    for await (const chunk of response) {
      // 检查中断信号
      if (options?.signal?.aborted) {
        throw new DOMException('请求已中断', 'AbortError');
      }

      if (chunk.message.content) {
        fullContent += chunk.message.content;
        yield { type: 'text', content: chunk.message.content };
      }

      if (chunk.done) {
        // 在流结束时解析工具调用（支持多个）
        if (tools) {
          const toolCalls = parseToolCallsFromText(fullContent);
          for (const toolCall of toolCalls) {
            yield { type: 'tool_call', toolCall };
          }
        }
        yield { type: 'done' };
      }
    }
  }
}
