/**
 * 会话历史搜索工具
 * 允许用户搜索之前的对话内容
 */

import type { Tool, ToolResult } from './types.js';
import { listSessions, loadSession, type Session, type SessionMeta } from '../../config/session.js';

/**
 * 搜索参数
 */
export interface SearchHistoryParams {
  /** 搜索关键词 */
  query: string;
  /** 是否使用正则表达式 */
  isRegex?: boolean;
  /** 是否大小写敏感 */
  caseSensitive?: boolean;
  /** 搜索角色：user(用户消息)、ai(AI回复)、all(全部) */
  role?: 'user' | 'ai' | 'all';
  /** 时间范围过滤 */
  timeRange?: {
    /** 开始时间戳（毫秒） */
    start?: number;
    /** 结束时间戳（毫秒） */
    end?: number;
  };
  /** 指定会话ID列表 */
  sessionIds?: string[];
  /** 最大返回结果数 */
  limit?: number;
  /** 分页偏移 */
  offset?: number;
  /** 是否显示上下文 */
  showContext?: boolean;
  /** 上下文行数 */
  contextLines?: number;
}

/**
 * 搜索结果中的匹配项
 */
export interface SearchMatch {
  /** 消息索引 */
  messageIndex: number;
  /** 消息角色 */
  role: 'user' | 'ai';
  /** 消息内容 */
  content: string;
  /** 匹配的文本 */
  matchedText: string;
  /** 匹配开始位置 */
  matchStart: number;
  /** 匹配结束位置 */
  matchEnd: number;
  /** 前文上下文（可选） */
  contextBefore?: string;
  /** 后文上下文（可选） */
  contextAfter?: string;
  /** 匹配得分 */
  score: number;
}

/**
 * 会话搜索结果
 */
export interface SessionSearchResult {
  /** 会话元数据 */
  session: SessionMeta;
  /** 匹配项列表 */
  matches: SearchMatch[];
  /** 总匹配数 */
  totalMatches: number;
}

/**
 * 搜索工具类
 */
export class SearchHistoryTool implements Tool {
  definition = {
    name: 'searchHistory',
    description: '搜索会话历史记录。支持关键词搜索、正则表达式、角色过滤、时间范围过滤等功能。',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词或正则表达式',
        },
        isRegex: {
          type: 'boolean',
          description: '是否使用正则表达式（默认 false）',
        },
        caseSensitive: {
          type: 'boolean',
          description: '是否大小写敏感（默认 false）',
        },
        role: {
          type: 'string',
          enum: ['user', 'ai', 'all'],
          description: '搜索角色：user(用户消息)、ai(AI回复)、all(全部，默认)',
        },
        timeRange: {
          type: 'object',
          description: '时间范围过滤，格式：{"start": 时间戳, "end": 时间戳}',
          properties: {
            start: { type: 'number', description: '开始时间戳（毫秒）' },
            end: { type: 'number', description: '结束时间戳（毫秒）' },
          },
        },
        sessionIds: {
          type: 'array',
          description: '指定会话ID列表',
          items: { type: 'string' },
        },
        limit: {
          type: 'number',
          description: '最大返回结果数（默认 20）',
        },
        offset: {
          type: 'number',
          description: '分页偏移（默认 0）',
        },
        showContext: {
          type: 'boolean',
          description: '是否显示上下文（默认 true）',
        },
        contextLines: {
          type: 'number',
          description: '上下文行数（默认 2）',
        },
      },
      required: ['query'],
    },
  };

  /**
   * 执行搜索
   */
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const params = this.parseParams(args);
      const results = await this.searchSessions(params);
      
      if (results.length === 0) {
        return {
          success: true,
          output: `没有找到包含 "${params.query}" 的会话内容`,
        };
      }

      const output = this.formatResults(results, params);
      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        output: `搜索失败: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 解析搜索参数
   */
  private parseParams(args: Record<string, unknown>): SearchHistoryParams {
    const params: SearchHistoryParams = {
      query: args.query as string,
      isRegex: args.isRegex as boolean || false,
      caseSensitive: args.caseSensitive as boolean || false,
      role: (args.role as 'user' | 'ai' | 'all') || 'all',
      limit: args.limit as number || 20,
      offset: args.offset as number || 0,
      showContext: args.showContext !== undefined ? args.showContext as boolean : true,
      contextLines: args.contextLines as number || 2,
    };

    // 解析时间范围
    if (args.timeRange && typeof args.timeRange === 'object') {
      const timeRange = args.timeRange as Record<string, unknown>;
      params.timeRange = {};
      if (timeRange.start) params.timeRange.start = timeRange.start as number;
      if (timeRange.end) params.timeRange.end = timeRange.end as number;
    }

    // 解析会话ID列表
    if (args.sessionIds && Array.isArray(args.sessionIds)) {
      params.sessionIds = args.sessionIds as string[];
    }

    return params;
  }

  /**
   * 搜索所有会话
   */
  private async searchSessions(params: SearchHistoryParams): Promise<SessionSearchResult[]> {
    // 获取所有会话元数据
    const allSessions = await listSessions();
    
    // 应用过滤条件
    const filteredSessions = this.filterSessions(allSessions, params);
    
    const results: SessionSearchResult[] = [];
    const startTime = Date.now();
    
    // 搜索每个会话（限制最大搜索数量，避免性能问题）
    const maxSessionsToSearch = 100; // 最多搜索100个会话
    const sessionsToSearch = filteredSessions.slice(0, maxSessionsToSearch);
    
    for (const sessionMeta of sessionsToSearch) {
      try {
        const session = await loadSession(sessionMeta.id);
        if (!session) continue;
        const matches = this.searchInSession(session, params);
        
        if (matches.length > 0) {
          results.push({
            session: sessionMeta,
            matches: matches.slice(0, 10), // 每个会话最多显示10个匹配
            totalMatches: matches.length,
          });
        }
      } catch (error) {
        // 跳过无法加载的会话
        console.warn(`无法加载会话 ${sessionMeta.id}:`, error);
      }
      
      // 达到限制时停止
      if (params.limit && results.length >= params.limit) {
        break;
      }
      
      // 超时检查（最多搜索10秒）
      if (Date.now() - startTime > 10000) {
        console.warn('搜索超时，已搜索', results.length, '个会话');
        break;
      }
    }
    
    // 按匹配数量排序
    results.sort((a, b) => b.totalMatches - a.totalMatches);
    
    return results;
  }

  /**
   * 过滤会话列表
   */
  private filterSessions(sessions: SessionMeta[], params: SearchHistoryParams): SessionMeta[] {
    let filtered = sessions;
    
    // 按时间范围过滤
    if (params.timeRange) {
      filtered = filtered.filter(session => {
        const sessionTime = session.updatedAt.getTime();
        if (params.timeRange?.start && sessionTime < params.timeRange.start) return false;
        if (params.timeRange?.end && sessionTime > params.timeRange.end) return false;
        return true;
      });
    }
    
    // 按会话ID过滤
    if (params.sessionIds && params.sessionIds.length > 0) {
      filtered = filtered.filter(session => params.sessionIds!.includes(session.id));
    }
    
    // 按分页过滤
    if (params.offset) {
      filtered = filtered.slice(params.offset);
    }
    
    return filtered;
  }

  /**
   * 在单个会话中搜索
   */
  private searchInSession(session: Session, params: SearchHistoryParams): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const regex = this.createSearchRegex(params);
    
    for (let i = 0; i < session.messages.length; i++) {
      const message = session.messages[i];
      if (!message) continue;

      // 按角色过滤
      if (params.role !== 'all') {
        const messageRole = message.role === 'user' ? 'user' : 'ai';
        if (messageRole !== params.role) continue;
      }

      const rawContent = message.content || '';
      // Handle both string and array content types
      const content = typeof rawContent === 'string'
        ? rawContent
        : rawContent.map((c: any) => 'text' in c ? c.text : '').join('\n');
      const match = regex.exec(content);

      if (match) {
        const contextBefore = this.getContextBefore(session.messages, i, params.contextLines || 2);
        const contextAfter = this.getContextAfter(session.messages, i, params.contextLines || 2);

        matches.push({
          messageIndex: i,
          role: message.role === 'user' ? 'user' : 'ai',
          content,
          matchedText: match[0],
          matchStart: match.index,
          matchEnd: match.index + match[0].length,
          contextBefore: params.showContext ? contextBefore : undefined,
          contextAfter: params.showContext ? contextAfter : undefined,
          score: this.calculateMatchScore(match[0], params.query),
        });
        
        // 重置正则状态
        regex.lastIndex = 0;
      }
    }
    
    return matches;
  }

  /**
   * 获取前文上下文
   */
  private getContextBefore(messages: any[], currentIndex: number, lines: number): string {
    const context: string[] = [];
    for (let i = Math.max(0, currentIndex - lines); i < currentIndex; i++) {
      const msg = messages[i];
      const prefix = msg.role === 'user' ? '👤 ' : '🤖 ';
      context.push(`${prefix}${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    }
    return context.join('\n');
  }

  /**
   * 获取后文上下文
   */
  private getContextAfter(messages: any[], currentIndex: number, lines: number): string {
    const context: string[] = [];
    for (let i = currentIndex + 1; i <= Math.min(messages.length - 1, currentIndex + lines); i++) {
      const msg = messages[i];
      const prefix = msg.role === 'user' ? '👤 ' : '🤖 ';
      context.push(`${prefix}${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    }
    return context.join('\n');
  }

  /**
   * 创建搜索正则表达式
   */
  private createSearchRegex(params: SearchHistoryParams): RegExp {
    const flags = params.caseSensitive ? 'g' : 'gi';
    
    if (params.isRegex) {
      try {
        return new RegExp(params.query, flags);
      } catch (error) {
        // 正则表达式无效，回退到普通搜索
        const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, flags);
      }
    } else {
      // 普通关键词搜索，转义特殊字符
      const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, flags);
    }
  }

  /**
   * 计算匹配得分
   */
  private calculateMatchScore(matchedText: string, query: string): number {
    // 简单得分算法：匹配长度占比
    const matchLength = matchedText.length;
    const queryLength = query.length;
    return matchLength / Math.max(queryLength, 1);
  }

  /**
   * 格式化搜索结果
   */
  private formatResults(results: SessionSearchResult[], params: SearchHistoryParams): string {
    const totalSessions = results.length;
    const totalMatches = results.reduce((sum, r) => sum + r.totalMatches, 0);
    
    let output = `## 🔍 会话历史搜索结果\n\n`;
    output += `**搜索关键词**: "${params.query}"\n`;
    output += `**搜索模式**: ${params.isRegex ? '正则表达式' : '关键词'} | `;
    output += `**大小写**: ${params.caseSensitive ? '敏感' : '不敏感'} | `;
    output += `**角色过滤**: ${params.role === 'all' ? '全部' : params.role === 'user' ? '仅用户' : '仅AI'}\n\n`;
    output += `📊 **找到 ${totalMatches} 处匹配，分布在 ${totalSessions} 个会话中**\n\n`;
    
    if (totalSessions === 0) {
      output += `> 没有找到包含 "${params.query}" 的会话内容\n`;
      output += `> 建议：尝试不同的关键词、关闭大小写敏感、或使用正则表达式搜索\n`;
      return output;
    }
    
    // 显示搜索统计
    const userMatches = results.reduce((sum, r) => 
      sum + r.matches.filter(m => m.role === 'user').length, 0);
    const aiMatches = results.reduce((sum, r) => 
      sum + r.matches.filter(m => m.role === 'ai').length, 0);
    
    output += `📈 **匹配统计**: 用户消息 ${userMatches} 处 | AI回复 ${aiMatches} 处\n\n`;
    
    // 显示每个会话的结果
    for (const result of results) {
      const session = result.session;
      const timeStr = new Date(session.updatedAt).toLocaleString('zh-CN');
      const dateStr = new Date(session.updatedAt).toLocaleDateString('zh-CN');
      
      output += `---\n\n`;
      output += `### 📁 ${session.title}\n`;
      output += `**会话ID**: \`${session.id}\` | **时间**: ${dateStr} ${timeStr.split(' ')[1]}\n`;
      output += `**消息数**: ${session.messageCount} | **工作目录**: \`${session.cwd}\`\n`;
      if (session.model) output += `**使用模型**: ${session.model}\n`;
      output += `**匹配数量**: ${result.totalMatches} 处（显示前 ${result.matches.length} 处）\n\n`;
      
      // 显示匹配详情
      for (const match of result.matches) {
        const roleLabel = match.role === 'user' ? '👤 用户' : '🤖 AI';
        const messageNum = match.messageIndex + 1;
        const matchScore = Math.round(match.score * 100);
        
        output += `#### ${roleLabel} - 第${messageNum}条消息（相关度: ${matchScore}%）\n`;
        
        // 显示上下文（如果有）
        if (match.contextBefore) {
          output += `**前文**:\n`;
          output += `> ${match.contextBefore.replace(/\n/g, '\n> ')}\n\n`;
        }
        
        // 显示匹配内容（高亮匹配部分）
        const content = match.content;
        const beforeMatch = content.substring(0, match.matchStart);
        const matchedPart = content.substring(match.matchStart, match.matchEnd);
        const afterMatch = content.substring(match.matchEnd);
        
        // 截断过长的内容
        const maxLength = 300;
        let displayContent = '';
        if (beforeMatch.length > maxLength / 2) {
          displayContent = `...${beforeMatch.substring(beforeMatch.length - maxLength / 2)}`;
        } else {
          displayContent = beforeMatch;
        }
        
        displayContent += `**${matchedPart}**`;
        
        if (afterMatch.length > maxLength / 2) {
          displayContent += `${afterMatch.substring(0, maxLength / 2)}...`;
        } else {
          displayContent += afterMatch;
        }
        
        output += `**匹配内容**:\n`;
        output += `> ${displayContent}\n\n`;
        
        // 显示后文上下文（如果有）
        if (match.contextAfter) {
          output += `**后文**:\n`;
          output += `> ${match.contextAfter.replace(/\n/g, '\n> ')}\n\n`;
        }
      }
    }
    
    // 添加使用提示
    output += `---\n\n`;
    output += `### 💡 使用提示\n`;
    output += `1. 使用正则表达式进行高级搜索，例如：\`login|auth\` 或 \`error.*failed\`\n`;
    output += `2. 使用 \`role: "user"\` 参数只搜索用户消息\n`;
    output += `3. 使用 \`timeRange\` 参数按时间范围搜索\n`;
    output += `4. 使用 \`sessionIds\` 参数在特定会话中搜索\n`;
    output += `5. 使用 \`limit\` 和 \`offset\` 参数进行分页\n`;
    
    return output;
  }
}