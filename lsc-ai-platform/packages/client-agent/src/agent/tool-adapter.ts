/**
 * Tool Adapter
 *
 * 将 @lsc-ai/core 工具格式转换为 Mastra 工具格式
 * @lsc-ai/core Tool: { definition: { name, description, parameters }, execute(args) }
 * Mastra Tool: createTool({ id, description, inputSchema (zod), execute })
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Tool as LscTool } from '@lsc-ai/core';

/**
 * 将 JSON Schema property 转换为 Zod schema
 */
function jsonSchemaPropertyToZod(prop: { type: string; description: string; enum?: string[] }): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (prop.type) {
    case 'string':
      schema = prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
      break;
    case 'number':
    case 'integer':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      schema = z.array(z.any());
      break;
    case 'object':
      schema = z.record(z.any());
      break;
    default:
      schema = z.any();
  }

  return schema.describe(prop.description);
}

/**
 * 将 @lsc-ai/core Tool 转换为 Mastra tool
 */
export function convertLscToolToMastra(lscTool: LscTool) {
  const def = lscTool.definition;
  const properties = def.parameters.properties;
  const required = new Set(def.parameters.required || []);

  // 构建 Zod schema
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(properties)) {
    let field = jsonSchemaPropertyToZod(prop);
    if (!required.has(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  const inputSchema = z.object(shape);

  return createTool({
    id: def.name,
    description: def.description,
    inputSchema,
    execute: async ({ context }) => {
      const result = await lscTool.execute(context as Record<string, unknown>);
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    },
  });
}

/**
 * 批量转换工具
 */
export function convertAllTools(lscTools: LscTool[]): Record<string, any> {
  const tools: Record<string, any> = {};
  for (const tool of lscTools) {
    try {
      tools[tool.definition.name] = convertLscToolToMastra(tool);
    } catch (error) {
      console.warn(`[ToolAdapter] 工具转换失败: ${tool.definition.name}`, error);
    }
  }
  return tools;
}
