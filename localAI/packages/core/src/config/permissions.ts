/**
 * 权限控制系统
 * 管理工具和操作的权限
 */

/**
 * 权限级别
 */
export type PermissionLevel =
  | 'allow'       // 始终允许
  | 'ask'         // 每次询问
  | 'ask-once'    // 询问一次后记住
  | 'deny';       // 始终拒绝

/**
 * 工具权限规则
 */
export interface ToolPermissionRule {
  /** 工具名称（支持通配符，如 bash:* 或 *） */
  tool: string;
  /** 权限级别 */
  level: PermissionLevel;
  /** 额外条件（如特定参数匹配） */
  condition?: {
    /** 参数匹配规则 */
    argMatch?: Record<string, string | RegExp>;
    /** 排除的参数模式 */
    argExclude?: Record<string, string | RegExp>;
  };
}

/**
 * 路径权限规则
 */
export interface PathPermissionRule {
  /** 路径模式（支持通配符） */
  path: string;
  /** 允许的操作 */
  operations: Array<'read' | 'write' | 'execute'>;
  /** 权限级别 */
  level: PermissionLevel;
}

/**
 * 网络权限规则
 */
export interface NetworkPermissionRule {
  /** 域名或 URL 模式 */
  domain: string;
  /** 允许的操作 */
  operations: Array<'fetch' | 'search'>;
  /** 权限级别 */
  level: PermissionLevel;
}

/**
 * 权限配置
 */
export interface PermissionConfig {
  /** 是否启用权限控制 */
  enabled: boolean;
  /** 默认权限级别 */
  defaultLevel: PermissionLevel;
  /** 工具权限规则 */
  toolRules: ToolPermissionRule[];
  /** 路径权限规则 */
  pathRules: PathPermissionRule[];
  /** 网络权限规则 */
  networkRules: NetworkPermissionRule[];
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  /** 是否允许 */
  allowed: boolean;
  /** 是否需要确认 */
  needsConfirmation: boolean;
  /** 匹配的规则 */
  matchedRule?: ToolPermissionRule | PathPermissionRule | NetworkPermissionRule;
  /** 拒绝原因 */
  reason?: string;
}

/**
 * 默认配置
 */
export const defaultPermissionConfig: PermissionConfig = {
  enabled: true,
  defaultLevel: 'ask',
  toolRules: [
    // 只读工具默认允许
    { tool: 'read', level: 'allow' },
    { tool: 'glob', level: 'allow' },
    { tool: 'grep', level: 'allow' },
    { tool: 'listSkills', level: 'allow' },
    { tool: 'readPlan', level: 'allow' },
    { tool: 'listTasks', level: 'allow' },
    // Git 只读命令允许
    { tool: 'gitStatus', level: 'allow' },
    { tool: 'gitDiff', level: 'allow' },
    { tool: 'gitLog', level: 'allow' },
    { tool: 'gitBranch', level: 'allow' },
    // 写入工具需要确认
    { tool: 'write', level: 'ask' },
    { tool: 'edit', level: 'ask' },
    // bash 需要根据命令内容判断
    { tool: 'bash', level: 'ask' },
    // Git 写入命令需要确认
    { tool: 'gitAdd', level: 'ask' },
    { tool: 'gitCommit', level: 'ask' },
    // 危险操作
    { tool: 'remove', level: 'ask' },
    { tool: 'move', level: 'ask' },
  ],
  pathRules: [
    // 项目目录允许读写
    { path: './*', operations: ['read', 'write'], level: 'allow' },
    // 系统目录拒绝
    { path: '/etc/*', operations: ['write'], level: 'deny' },
    { path: '/usr/*', operations: ['write'], level: 'deny' },
    { path: '/bin/*', operations: ['write'], level: 'deny' },
    { path: '/sbin/*', operations: ['write'], level: 'deny' },
  ],
  networkRules: [
    // 默认允许常用域名
    { domain: '*.github.com', operations: ['fetch'], level: 'allow' },
    { domain: '*.npmjs.com', operations: ['fetch'], level: 'allow' },
    { domain: '*.stackoverflow.com', operations: ['fetch'], level: 'allow' },
  ],
};

/**
 * 权限管理器
 */
export class PermissionManager {
  private config: PermissionConfig;
  private rememberedPermissions: Map<string, PermissionLevel> = new Map();

  constructor(config?: Partial<PermissionConfig>) {
    this.config = {
      ...defaultPermissionConfig,
      ...config,
      toolRules: [...defaultPermissionConfig.toolRules, ...(config?.toolRules || [])],
      pathRules: [...defaultPermissionConfig.pathRules, ...(config?.pathRules || [])],
      networkRules: [...defaultPermissionConfig.networkRules, ...(config?.networkRules || [])],
    };
  }

  /**
   * 检查工具权限
   */
  checkToolPermission(
    toolName: string,
    args: Record<string, unknown>
  ): PermissionCheckResult {
    if (!this.config.enabled) {
      return { allowed: true, needsConfirmation: false };
    }

    // 检查是否有记住的权限
    const rememberedKey = this.getRememberedKey('tool', toolName, args);
    const remembered = this.rememberedPermissions.get(rememberedKey);
    if (remembered) {
      return {
        allowed: remembered === 'allow',
        needsConfirmation: false,
      };
    }

    // 查找匹配的规则（从后向前，后面的规则优先级更高）
    const matchedRule = this.findToolRule(toolName, args);

    if (matchedRule) {
      const level = matchedRule.level;
      if (level === 'allow') {
        return { allowed: true, needsConfirmation: false, matchedRule };
      }
      if (level === 'deny') {
        return {
          allowed: false,
          needsConfirmation: false,
          matchedRule,
          reason: `工具 ${toolName} 被权限规则禁止`,
        };
      }
      // ask 或 ask-once
      return { allowed: false, needsConfirmation: true, matchedRule };
    }

    // 使用默认级别
    const defaultLevel = this.config.defaultLevel;
    if (defaultLevel === 'allow') {
      return { allowed: true, needsConfirmation: false };
    }
    if (defaultLevel === 'deny') {
      return {
        allowed: false,
        needsConfirmation: false,
        reason: '默认权限为拒绝',
      };
    }
    return { allowed: false, needsConfirmation: true };
  }

  /**
   * 查找匹配的工具规则
   */
  private findToolRule(
    toolName: string,
    args: Record<string, unknown>
  ): ToolPermissionRule | undefined {
    // 从后向前查找，后面的规则优先级更高
    for (let i = this.config.toolRules.length - 1; i >= 0; i--) {
      const rule = this.config.toolRules[i];
      if (this.matchToolPattern(rule.tool, toolName)) {
        // 检查条件
        if (rule.condition) {
          if (!this.matchCondition(rule.condition, args)) {
            continue;
          }
        }
        return rule;
      }
    }
    return undefined;
  }

  /**
   * 匹配工具名称模式
   */
  private matchToolPattern(pattern: string, toolName: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return toolName.startsWith(prefix);
    }
    return pattern === toolName;
  }

  /**
   * 检查条件匹配
   */
  private matchCondition(
    condition: ToolPermissionRule['condition'],
    args: Record<string, unknown>
  ): boolean {
    if (!condition) return true;

    // 检查参数匹配
    if (condition.argMatch) {
      for (const [key, pattern] of Object.entries(condition.argMatch)) {
        const value = String(args[key] || '');
        if (pattern instanceof RegExp) {
          if (!pattern.test(value)) return false;
        } else {
          if (!value.includes(pattern)) return false;
        }
      }
    }

    // 检查参数排除
    if (condition.argExclude) {
      for (const [key, pattern] of Object.entries(condition.argExclude)) {
        const value = String(args[key] || '');
        if (pattern instanceof RegExp) {
          if (pattern.test(value)) return false;
        } else {
          if (value.includes(pattern)) return false;
        }
      }
    }

    return true;
  }

  /**
   * 记住权限决定
   */
  rememberPermission(
    type: 'tool' | 'path' | 'network',
    name: string,
    args: Record<string, unknown>,
    level: PermissionLevel
  ): void {
    const key = this.getRememberedKey(type, name, args);
    this.rememberedPermissions.set(key, level);
  }

  /**
   * 获取记住的权限键
   */
  private getRememberedKey(
    type: 'tool' | 'path' | 'network',
    name: string,
    args: Record<string, unknown>
  ): string {
    return `${type}:${name}`;
  }

  /**
   * 清除记住的权限
   */
  clearRemembered(): void {
    this.rememberedPermissions.clear();
  }

  /**
   * 添加工具规则
   */
  addToolRule(rule: ToolPermissionRule): void {
    this.config.toolRules.push(rule);
  }

  /**
   * 移除工具规则
   */
  removeToolRule(tool: string): void {
    this.config.toolRules = this.config.toolRules.filter(r => r.tool !== tool);
  }

  /**
   * 获取配置
   */
  getConfig(): PermissionConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PermissionConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * 启用/禁用权限控制
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// 全局权限管理器实例
export const permissionManager = new PermissionManager();
