/**
 * Workbench Schema 转换器
 *
 * 将旧版本的 Workbench Schema (version 1.0, blocks format)
 * 转换为新版本的 Schema (tabs format)
 */

import type { WorkbenchSchema } from './types';

/** 旧版本 Schema (version 1.0) */
interface OldWorkbenchSchema {
  version: '1.0';
  title?: string;
  description?: string;
  blocks: Array<{
    type: 'code' | 'table' | 'chart' | 'markdown' | 'json' | 'image' | 'file' | 'tabs';
    title?: string;
    [key: string]: any;
  }>;
  metadata?: Record<string, any>;
}

/**
 * 检查是否为旧版本 Schema
 */
export function isOldSchema(schema: any): schema is OldWorkbenchSchema {
  return (
    schema &&
    typeof schema === 'object' &&
    schema.version === '1.0' &&
    Array.isArray(schema.blocks)
  );
}

/**
 * 将旧版本 Schema 转换为新版本
 */
export function transformOldSchemaToNew(oldSchema: OldWorkbenchSchema): WorkbenchSchema {
  console.log('[SchemaTransformer] 开始转换旧版本 Schema:', oldSchema);

  // 将每个 block 转换为一个 tab
  const tabs = oldSchema.blocks
    .map((block, index) => {
      let componentSchema: any = null;

      switch (block.type) {
        case 'code':
          // 验证器要求: code, language
          if (block.code) {
            componentSchema = {
              type: 'CodeEditor',
              code: block.code,
              language: block.language || 'javascript',
              readOnly: true,
            };
          }
          break;

        case 'table':
          // 验证器要求: columns, data (注意是data不是dataSource)
          if (block.headers && block.rows) {
            componentSchema = {
              type: 'DataTable',
              title: block.title,
              columns: block.headers.map((h: string) => ({
                title: h,
                dataIndex: h,
                key: h,
              })),
              data: block.rows.map((row: any[], rowIndex: number) => {
                const obj: any = { key: rowIndex };
                block.headers.forEach((h: string, i: number) => {
                  obj[h] = row[i];
                });
                return obj;
              }),
            };
          }
          break;

        case 'chart':
          // 不同图表类型有不同的必填字段
          const chartTypeMap: Record<string, string> = {
            line: 'LineChart',
            bar: 'BarChart',
            pie: 'PieChart',
            scatter: 'ScatterChart',
          };

          const chartType = chartTypeMap[block.chartType] || 'BarChart';

          if (block.chartType === 'pie' && block.option?.series?.[0]?.data) {
            // PieChart 验证器要求: data
            componentSchema = {
              type: 'PieChart',
              data: block.option.series[0].data,
              title: block.title,
            };
          } else if (
            (chartType === 'BarChart' || chartType === 'LineChart') &&
            block.option?.xAxis &&
            block.option?.series
          ) {
            // BarChart/LineChart 验证器要求: xAxis, series
            componentSchema = {
              type: chartType,
              xAxis: block.option.xAxis,
              series: block.option.series,
              title: block.title,
            };
          } else if (block.option) {
            // 数据不完整，使用 MarkdownView 显示提示
            componentSchema = {
              type: 'MarkdownView',
              content: `**${block.title || '图表'}**\n\n图表数据格式不完整，无法显示。`,
            };
          }
          break;

        case 'markdown':
          // 验证器要求: content
          if (block.content) {
            componentSchema = {
              type: 'MarkdownView',
              content: block.content,
            };
          }
          break;

        case 'json':
          // JSON转为CodeEditor，验证器要求: code, language
          if (block.data) {
            componentSchema = {
              type: 'CodeEditor',
              code: JSON.stringify(block.data, null, 2),
              language: 'json',
              readOnly: true,
            };
          }
          break;

        case 'tabs':
          // 嵌套tabs，展平处理 - 直接创建多个tab
          return block.tabs.map((tab: any, tabIndex: number) => {
            // 递归处理tab内容
            let tabComponentSchema: any;
            const tabContent = tab.content;

            if (tabContent?.type === 'code') {
              tabComponentSchema = {
                type: 'CodeEditor',
                code: tabContent.code,
                language: tabContent.language || 'javascript',
                readOnly: true,
              };
            } else if (tabContent?.type === 'markdown') {
              tabComponentSchema = {
                type: 'MarkdownView',
                content: tabContent.content,
              };
            } else if (tabContent?.type === 'table' && tabContent.headers && tabContent.rows) {
              // 处理嵌套的table类型
              tabComponentSchema = {
                type: 'DataTable',
                title: tabContent.title,
                columns: tabContent.headers.map((h: string) => ({
                  title: h,
                  dataIndex: h,
                  key: h,
                })),
                data: tabContent.rows.map((row: any[], rowIndex: number) => {
                  const obj: any = { key: rowIndex };
                  tabContent.headers.forEach((h: string, i: number) => {
                    obj[h] = row[i];
                  });
                  return obj;
                }),
              };
            } else {
              // 默认作为Card处理
              tabComponentSchema = {
                type: 'Card',
                title: tab.label,
                children: [{ type: 'MarkdownView', content: JSON.stringify(tabContent, null, 2) }],
              };
            }

            return {
              key: `tab-${index}-${tabIndex}`,
              title: tab.label,
              components: [tabComponentSchema],
            };
          });

        default:
          // 未知类型，创建一个提示卡片
          componentSchema = {
            type: 'Card',
            title: '未知类型',
            children: [
              {
                type: 'Alert',
                alertType: 'warning',
                message: `不支持的block类型: ${block.type}`,
              },
            ],
          };
      }

      // 如果没有有效的组件，返回null（稍后过滤掉）
      if (!componentSchema) {
        console.warn(`[SchemaTransformer] Block ${index} (${block.type}) 数据不完整，跳过`);
        return null;
      }

      return {
        key: `tab-${index}`,
        title: block.title || block.type || `Tab ${index + 1}`,
        components: [componentSchema],
      };
    })
    .flat()
    .filter((tab: any) => tab !== null); // 过滤掉null值

  // 检查是否有有效的tabs
  if (tabs.length === 0) {
    console.error('[SchemaTransformer] 转换后没有有效的tabs');
    throw new Error('转换后没有有效的tabs');
  }

  const transformedSchema: WorkbenchSchema = {
    type: 'workbench',
    title: oldSchema.title || 'Workbench',
    tabs: tabs as any[],
    defaultActiveKey: tabs[0]?.key,
  };

  console.log('[SchemaTransformer] 转换完成:', transformedSchema);
  return transformedSchema;
}

/**
 * 自动检测并转换 Schema
 * 如果是旧版本则转换，如果是新版本则直接返回
 */
export function ensureNewSchema(schema: any): WorkbenchSchema {
  if (isOldSchema(schema)) {
    return transformOldSchemaToNew(schema);
  }
  return schema as WorkbenchSchema;
}
