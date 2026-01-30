/**
 * Skill 工具
 * 允许调用已注册的技能
 */

import type { Tool, ToolResult } from './types.js';
import type { ToolDefinition } from '../../llm/types.js';
import { skillManager } from '../../skill/skillManager.js';

/**
 * Skill 执行工具
 */
export class SkillTool implements Tool {
  definition: ToolDefinition = {
    name: 'skill',
    description: `执行一个已注册的技能。技能是预定义的任务模板，专门针对特定场景优化。

可用技能:
- commit: 创建 Git 提交
- review-pr: 审查 Pull Request
- explain: 解释代码功能
- fix-bug: 分析并修复 Bug
- refactor: 重构代码
- test: 生成或运行测试
- doc: 生成或更新文档
- deps: 分析项目依赖

用法: 指定技能名称和可选参数`,
    parameters: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: '技能名称（如 commit, review-pr, explain 等）',
        },
        args: {
          type: 'string',
          description: '传递给技能的参数（可选）',
        },
      },
      required: ['name'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const skillName = args.name as string;
    const skillArgs = args.args as string | undefined;

    if (!skillName) {
      return {
        success: false,
        output: '',
        error: '请指定技能名称',
      };
    }

    // 检查技能是否存在
    const skill = skillManager.get(skillName);
    if (!skill) {
      const available = skillManager.list().map((s: any) => s.name).join(', ');
      return {
        success: false,
        output: '',
        error: `技能 "${skillName}" 不存在。可用技能: ${available || '(无)'}`,
      };
    }

    // 检查是否需要参数
    if (skill.requiresArgs && !skillArgs) {
      return {
        success: false,
        output: '',
        error: `技能 "${skillName}" 需要参数`,
      };
    }

    try {
      // 执行技能
      const result = await skillManager.execute(skillName, {
        rawArgs: skillArgs,
      });

      if (result.success) {
        return {
          success: true,
          output: `技能 "${skillName}" 执行完成 (${result.toolCallCount} 次工具调用, ${result.duration}ms)\n\n${result.output}`,
        };
      } else {
        return {
          success: false,
          output: result.output,
          error: result.error || '技能执行失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `技能执行错误: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 列出可用技能工具
 */
export class ListSkillsTool implements Tool {
  definition: ToolDefinition = {
    name: 'listSkills',
    description: '列出所有可用的技能',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const skills = skillManager.list();

    if (skills.length === 0) {
      return {
        success: true,
        output: '没有可用的技能',
      };
    }

    const lines: string[] = ['可用技能:'];
    for (const skill of skills) {
      lines.push(`\n**${skill.name}** - ${skill.description}`);
      if (skill.requiresArgs) {
        lines.push(`  需要参数`);
      }
    }

    return {
      success: true,
      output: lines.join('\n'),
    };
  }
}
