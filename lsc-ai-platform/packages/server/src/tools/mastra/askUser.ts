/**
 * AskUser 工具 - 用户交互
 * 让 AI 能够向用户提问以获取澄清或选择
 */

import type { Tool, ToolResult } from './types.js';

export interface AskUserOption {
  /** 选项显示文本（1-5个词） */
  label: string;
  /** 选项值 */
  value: string;
  /** 选项描述（解释选择此选项的含义） */
  description?: string;
}

export interface AskUserQuestion {
  /** 要问用户的完整问题 */
  question: string;
  /** 简短标题（最多12字符），显示为标签/芯片，如 "认证方式"、"数据库" */
  header?: string;
  /** 可选项列表（2-4个选项） */
  options?: AskUserOption[];
  /** 是否允许多选（默认 false） */
  multiSelect?: boolean;
  /** 是否允许自由输入（默认 true） */
  allowFreeText?: boolean;
}

/**
 * 用户输入处理器接口
 * CLI 或其他界面需要实现此接口
 */
export interface UserInputHandler {
  /**
   * 向用户提问并获取回答
   */
  ask(question: AskUserQuestion): Promise<string>;
}

/**
 * 默认的用户输入处理器（返回空，需要被替换）
 */
const defaultHandler: UserInputHandler = {
  async ask(question: AskUserQuestion): Promise<string> {
    console.log(`[AskUser] ${question.question}`);
    if (question.options) {
      question.options.forEach((opt, i) => {
        console.log(`  ${i + 1}. ${opt.label}${opt.description ? ` - ${opt.description}` : ''}`);
      });
    }
    return '[用户输入处理器未设置]';
  },
};

export class AskUserTool implements Tool {
  private handler: UserInputHandler;

  constructor(handler?: UserInputHandler) {
    this.handler = handler || defaultHandler;
  }

  definition = {
    name: 'askUser',
    description: `向用户提问以获取信息或澄清需求。当需要用户做出选择或提供额外信息时使用。

使用场景：
- 需要用户做选择（多个可行方案）
- 需要澄清不明确的需求
- 需要确认重要决策

不要使用的场景：
- 可以自己判断的简单问题
- 用户已经给出明确指令
- 过度询问会打断用户工作流

规则：
- 提供 2-4 个选项
- 推荐选项放第一个并在 label 末尾加 "(推荐)"
- 每个选项应有简短描述`,
    parameters: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: '要问用户的完整问题，应清晰、具体，以问号结尾',
        },
        header: {
          type: 'string',
          description: '简短标题（最多12字符），显示为标签，如 "认证方式"、"数据库"',
        },
        options: {
          type: 'array',
          description: '可选项列表（2-4个选项），用户始终可以选择"其他"自由输入',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: '选项显示文本（1-5个词），推荐选项末尾加"(推荐)"' },
              value: { type: 'string', description: '选项值' },
              description: { type: 'string', description: '选项描述，解释选择此选项的含义或影响' },
            },
          },
        },
        multiSelect: {
          type: 'boolean',
          description: '是否允许多选（默认 false），多选时问题应相应措辞，如"你想启用哪些功能？"',
        },
        allowFreeText: {
          type: 'boolean',
          description: '是否允许用户自由输入（默认 true）',
        },
      },
      required: ['question'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const question = args.question as string;
    const header = args.header as string | undefined;
    const options = args.options as AskUserOption[] | undefined;
    const multiSelect = (args.multiSelect as boolean) ?? false;
    const allowFreeText = (args.allowFreeText as boolean) ?? true;

    try {
      const answer = await this.handler.ask({
        question,
        header,
        options,
        multiSelect,
        allowFreeText,
      });

      return {
        success: true,
        output: `用户回答: ${answer}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `获取用户输入失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 设置用户输入处理器
   */
  setHandler(handler: UserInputHandler): void {
    this.handler = handler;
  }
}

/**
 * 创建基于 readline 的用户输入处理器
 */
export function createReadlineHandler(
  rl: { question: (prompt: string, callback: (answer: string) => void) => void }
): UserInputHandler {
  return {
    async ask(q: AskUserQuestion): Promise<string> {
      return new Promise((resolve) => {
        let prompt = `\n[AI 提问] ${q.question}\n`;

        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, i) => {
            prompt += `  ${i + 1}. ${opt.label}`;
            if (opt.description) prompt += ` - ${opt.description}`;
            prompt += '\n';
          });
          prompt += '请输入选项编号或直接回答: ';
        } else {
          prompt += '请回答: ';
        }

        rl.question(prompt, (answer) => {
          const trimmed = answer.trim();

          // 如果有选项，尝试解析编号
          if (q.options && q.options.length > 0) {
            const num = parseInt(trimmed, 10);
            if (!isNaN(num) && num >= 1 && num <= q.options.length) {
              const selectedOption = q.options[num - 1];
              if (selectedOption) {
                resolve(selectedOption.value);
                return;
              }
            }
          }

          resolve(trimmed);
        });
      });
    },
  };
}
