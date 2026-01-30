/**
 * SQL 数据库工具
 * 支持 MySQL 和 SQLite 数据库查询
 */

import type { Tool, ToolResult } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

// 动态导入数据库驱动以避免未安装时报错
let mysql: any = null;
let sqliteLib: any = null;

// 创建 require 函数用于从当前工作目录加载模块
function getRequire() {
  // 优先从当前工作目录加载
  const cwdRequire = createRequire(path.join(process.cwd(), 'package.json'));
  return cwdRequire;
}

async function getMysql() {
  if (!mysql) {
    try {
      const req = getRequire();
      mysql = req('mysql2/promise');
    } catch {
      // 回退到动态导入
      try {
        mysql = await import('mysql2/promise');
      } catch {
        throw new Error('mysql2 未安装，请运行: pnpm add mysql2');
      }
    }
  }
  return mysql;
}

async function getBetterSqlite3(): Promise<any> {
  if (sqliteLib) return sqliteLib;

  const req = getRequire();

  // 优先尝试 sql.js（纯 JS 实现，无需编译，更可靠）
  try {
    const sqlJsModule = req('sql.js');
    const initSqlJs = sqlJsModule.default || sqlJsModule;
    sqliteLib = { useSqlJs: true, initSqlJs };
    return sqliteLib;
  } catch {
    // 忽略，尝试下一个
  }

  // 尝试 better-sqlite3（原生模块，性能好但需要编译）
  try {
    const BetterSqlite3 = req('better-sqlite3');
    // 测试是否能正常工作（可能原生模块未编译）
    const testDb = new BetterSqlite3(':memory:');
    testDb.close();
    sqliteLib = BetterSqlite3;
    return sqliteLib;
  } catch {
    // better-sqlite3 可能未安装或未编译，忽略
  }

  // 回退到动态导入 sql.js
  try {
    // @ts-ignore - 动态导入，可能未安装
    const sqlJsModule = await import('sql.js');
    const initSqlJs = sqlJsModule.default || sqlJsModule;
    sqliteLib = { useSqlJs: true, initSqlJs };
    return sqliteLib;
  } catch {
    // 忽略
  }

  // 最后尝试动态导入 better-sqlite3
  try {
    // @ts-ignore - 动态导入，可能未安装
    const mod = await import('better-sqlite3');
    const BetterSqlite3 = mod.default || mod;
    // 测试是否能正常工作
    const testDb = new BetterSqlite3(':memory:');
    testDb.close();
    sqliteLib = BetterSqlite3;
    return sqliteLib;
  } catch {
    // 忽略
  }

  throw new Error('SQLite 支持需要安装 better-sqlite3 或 sql.js，请运行: pnpm add sql.js');
}

export interface DatabaseConfig {
  type: 'mysql' | 'sqlite';
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** SQLite 数据库文件路径 */
  filepath?: string;
}

/**
 * 数据库连接管理器
 */
export class DatabaseManager {
  private configs: Map<string, DatabaseConfig> = new Map();
  private defaultName: string | null = null;
  private sqlJsConnections: Map<string, any> = new Map();
  private sqlJsSQL: any = null;

  /**
   * 添加数据库配置
   */
  addDatabase(name: string, config: DatabaseConfig, setAsDefault = false): void {
    this.configs.set(name, config);
    if (setAsDefault || this.configs.size === 1) {
      this.defaultName = name;
    }
  }

  /**
   * 获取数据库配置
   */
  getConfig(name?: string): DatabaseConfig | undefined {
    const targetName = name || this.defaultName;
    if (!targetName) return undefined;
    return this.configs.get(targetName);
  }

  /**
   * 列出所有数据库
   */
  listDatabases(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * 获取默认数据库名称
   */
  getDefaultName(): string | null {
    return this.defaultName;
  }

  /**
   * 获取或创建 sql.js 数据库连接
   */
  async getSqlJsConnection(name: string, config: DatabaseConfig, initSqlJs: any): Promise<any> {
    // 初始化 SQL.js
    if (!this.sqlJsSQL) {
      this.sqlJsSQL = await initSqlJs();
    }

    // 检查是否已有连接
    if (this.sqlJsConnections.has(name)) {
      return this.sqlJsConnections.get(name);
    }

    // 创建新连接
    let db: any;
    if (config.filepath && config.filepath !== ':memory:' && fs.existsSync(config.filepath)) {
      const buffer = fs.readFileSync(config.filepath);
      db = new this.sqlJsSQL.Database(buffer);
    } else {
      db = new this.sqlJsSQL.Database();
    }

    this.sqlJsConnections.set(name, db);
    return db;
  }

  /**
   * 保存 sql.js 数据库到文件
   */
  saveSqlJsToFile(name: string, config: DatabaseConfig): void {
    if (config.filepath && config.filepath !== ':memory:' && this.sqlJsConnections.has(name)) {
      const db = this.sqlJsConnections.get(name);
      const data = db.export();
      fs.writeFileSync(config.filepath, Buffer.from(data));
    }
  }

  /**
   * 关闭 sql.js 连接
   */
  closeSqlJsConnection(name: string): void {
    if (this.sqlJsConnections.has(name)) {
      const db = this.sqlJsConnections.get(name);
      db.close();
      this.sqlJsConnections.delete(name);
    }
  }
}

// 全局数据库管理器
export const databaseManager = new DatabaseManager();

/**
 * SQL 工具
 */
export class SqlTool implements Tool {
  private manager: DatabaseManager;

  constructor(manager?: DatabaseManager) {
    this.manager = manager || databaseManager;
  }

  definition = {
    name: 'sql',
    description: '执行 SQL 查询。支持 MySQL 和 SQLite。可以查询数据库表结构、数据等。使用前需要先配置数据库连接。',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'SQL 查询语句',
        },
        database: {
          type: 'string',
          description: '数据库名称（可选，使用默认数据库）',
        },
        limit: {
          type: 'number',
          description: '限制返回行数（默认 100）',
        },
      },
      required: ['query'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    const dbName = args.database as string | undefined;
    const limit = (args.limit as number) || 100;

    const config = this.manager.getConfig(dbName);
    if (!config) {
      const available = this.manager.listDatabases();
      if (available.length === 0) {
        return {
          success: false,
          output: '',
          error: '未配置数据库连接。请先使用 sqlConfig 工具配置数据库。',
        };
      }
      return {
        success: false,
        output: '',
        error: `未找到数据库 "${dbName}"。可用数据库: ${available.join(', ')}`,
      };
    }

    // 获取数据库名称
    const targetDbName = dbName || this.manager.getDefaultName() || 'default';

    // 根据数据库类型执行查询
    if (config.type === 'sqlite') {
      return this.executeSqlite(query, config, limit, targetDbName);
    } else {
      return this.executeMysql(query, config, limit);
    }
  }

  /**
   * 执行 SQLite 查询
   */
  private async executeSqlite(query: string, config: DatabaseConfig, limit: number, dbName: string): Promise<ToolResult> {
    try {
      const sqliteLib = await getBetterSqlite3();

      // 自动添加 LIMIT（如果是 SELECT 且没有 LIMIT）
      let finalQuery = query.trim();
      if (
        finalQuery.toUpperCase().startsWith('SELECT') &&
        !finalQuery.toUpperCase().includes('LIMIT')
      ) {
        finalQuery = `${finalQuery} LIMIT ${limit}`;
      }

      // 检查是否使用 sql.js（纯 JS 实现）
      if (typeof sqliteLib === 'object' && 'useSqlJs' in sqliteLib) {
        // 使用连接缓存
        const db = await this.manager.getSqlJsConnection(dbName, config, sqliteLib.initSqlJs);

        const results = db.exec(finalQuery);

        if (results.length === 0) {
          // 对于 INSERT/UPDATE/DELETE，检查影响的行数
          const changes = db.getRowsModified();
          if (changes > 0) {
            // 保存更改到文件
            this.manager.saveSqlJsToFile(dbName, config);
            return {
              success: true,
              output: `执行成功\n影响行数: ${changes}`,
            };
          }
          return { success: true, output: '查询成功，无数据返回' };
        }

        const result = results[0];
        const rows = result.values;
        const fieldNames = result.columns;

        // 保存更改到文件（如果有写操作）
        this.manager.saveSqlJsToFile(dbName, config);

        return this.formatOutput(rows.map((row: any[]) => {
          const obj: Record<string, unknown> = {};
          fieldNames.forEach((name: string, i: number) => {
            obj[name] = row[i];
          });
          return obj;
        }), fieldNames);
      }

      // 使用 better-sqlite3
      const Database = sqliteLib;
      const db = new Database(config.filepath || ':memory:');

      try {
        const isSelect = finalQuery.toUpperCase().trim().startsWith('SELECT');

        if (isSelect) {
          const stmt = db.prepare(finalQuery);
          const rows = stmt.all();

          if (rows.length === 0) {
            return { success: true, output: '查询成功，无数据返回' };
          }

          const fieldNames = Object.keys(rows[0]);
          return this.formatOutput(rows, fieldNames);
        } else {
          const result = db.exec(finalQuery);
          const changes = db.prepare('SELECT changes()').get() as { 'changes()': number };
          return {
            success: true,
            output: `执行成功\n影响行数: ${changes['changes()'] || 0}`,
          };
        }
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `SQLite 执行失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 执行 MySQL 查询
   */
  private async executeMysql(query: string, config: DatabaseConfig, limit: number): Promise<ToolResult> {
    try {
      const mysqlLib = await getMysql();

      const connection = await mysqlLib.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
      });

      try {
        // 自动添加 LIMIT（如果是 SELECT 且没有 LIMIT）
        let finalQuery = query.trim();
        if (
          finalQuery.toUpperCase().startsWith('SELECT') &&
          !finalQuery.toUpperCase().includes('LIMIT')
        ) {
          finalQuery = `${finalQuery} LIMIT ${limit}`;
        }

        const [rows, fields] = await connection.execute(finalQuery);

        // 格式化输出
        if (Array.isArray(rows) && rows.length > 0) {
          const fieldNames = fields ? (fields as any[]).map(f => f.name) : Object.keys(rows[0] as object);
          return this.formatOutput(rows as Record<string, unknown>[], fieldNames);
        } else if (Array.isArray(rows)) {
          return { success: true, output: '查询成功，无数据返回' };
        } else {
          // INSERT, UPDATE, DELETE 等
          const result = rows as any;
          return {
            success: true,
            output: `执行成功\n影响行数: ${result.affectedRows || 0}\n插入ID: ${result.insertId || 'N/A'}`,
          };
        }
      } finally {
        await connection.end();
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `SQL 执行失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 格式化查询结果为表格输出
   */
  private formatOutput(rows: Record<string, unknown>[], fieldNames: string[]): ToolResult {
    let output = `查询成功，返回 ${rows.length} 行\n\n`;

    // 计算列宽
    const colWidths = fieldNames.map(name => {
      let maxWidth = name.length;
      for (const row of rows) {
        const val = String(row[name] ?? 'NULL');
        maxWidth = Math.max(maxWidth, val.length);
      }
      return Math.min(maxWidth, 50); // 最大宽度 50
    });

    // 表头
    output += fieldNames.map((name, i) => name.padEnd(colWidths[i])).join(' | ') + '\n';
    output += colWidths.map(w => '-'.repeat(w)).join('-+-') + '\n';

    // 数据行
    for (const row of rows) {
      output += fieldNames.map((name, i) => {
        const val = String(row[name] ?? 'NULL');
        return val.length > colWidths[i]
          ? val.slice(0, colWidths[i] - 3) + '...'
          : val.padEnd(colWidths[i]);
      }).join(' | ') + '\n';
    }

    return { success: true, output };
  }
}

/**
 * SQL 配置工具
 */
export class SqlConfigTool implements Tool {
  private manager: DatabaseManager;

  constructor(manager?: DatabaseManager) {
    this.manager = manager || databaseManager;
  }

  definition = {
    name: 'sqlConfig',
    description: '配置数据库连接。支持 MySQL 和 SQLite。添加或列出数据库连接配置。',
    parameters: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'list', 'test'],
          description: '操作类型：add（添加配置）、list（列出配置）、test（测试连接）',
        },
        name: {
          type: 'string',
          description: '数据库配置名称（add/test 时需要）',
        },
        type: {
          type: 'string',
          enum: ['mysql', 'sqlite'],
          description: '数据库类型：mysql 或 sqlite（默认 mysql）',
        },
        host: {
          type: 'string',
          description: 'MySQL 数据库主机（默认 localhost），SQLite 不需要',
        },
        port: {
          type: 'number',
          description: 'MySQL 数据库端口（默认 3306），SQLite 不需要',
        },
        user: {
          type: 'string',
          description: 'MySQL 用户名，SQLite 不需要',
        },
        password: {
          type: 'string',
          description: 'MySQL 密码，SQLite 不需要',
        },
        database: {
          type: 'string',
          description: 'MySQL 默认数据库名（可选）',
        },
        filepath: {
          type: 'string',
          description: 'SQLite 数据库文件路径（如 ./data.db），使用 :memory: 表示内存数据库',
        },
      },
      required: ['action'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const action = args.action as string;
    const dbType = (args.type as 'mysql' | 'sqlite') || 'mysql';

    switch (action) {
      case 'add': {
        const name = args.name as string;
        if (!name) {
          return { success: false, output: '', error: 'add 操作需要 name 参数' };
        }

        // SQLite 配置
        if (dbType === 'sqlite') {
          const filepath = args.filepath as string;
          if (!filepath) {
            return { success: false, output: '', error: 'SQLite 数据库需要 filepath 参数（如 ./data.db 或 :memory:）' };
          }

          const config: DatabaseConfig = {
            type: 'sqlite',
            filepath: filepath,
          };

          this.manager.addDatabase(name, config);
          return {
            success: true,
            output: `已添加 SQLite 数据库配置: ${name}\n文件路径: ${filepath}`,
          };
        }

        // MySQL 配置
        if (!args.user) {
          return { success: false, output: '', error: 'MySQL 数据库需要 user 参数' };
        }
        if (!args.password) {
          return { success: false, output: '', error: 'MySQL 数据库需要 password 参数' };
        }

        const config: DatabaseConfig = {
          type: 'mysql',
          host: (args.host as string) || 'localhost',
          port: (args.port as number) || 3306,
          user: args.user as string,
          password: args.password as string,
          database: args.database as string | undefined,
        };

        this.manager.addDatabase(name, config);
        return {
          success: true,
          output: `已添加 MySQL 数据库配置: ${name}\n主机: ${config.host}:${config.port}\n用户: ${config.user}\n数据库: ${config.database || '(未指定)'}`,
        };
      }

      case 'list': {
        const databases = this.manager.listDatabases();
        if (databases.length === 0) {
          return { success: true, output: '未配置任何数据库' };
        }
        const defaultName = this.manager.getDefaultName();
        const list = databases.map(name => {
          const config = this.manager.getConfig(name)!;
          const isDefault = name === defaultName ? ' (默认)' : '';
          if (config.type === 'sqlite') {
            return `- ${name}${isDefault} [SQLite]: ${config.filepath}`;
          }
          return `- ${name}${isDefault} [MySQL]: ${config.host}:${config.port} (${config.user})`;
        }).join('\n');
        return { success: true, output: `已配置的数据库:\n${list}` };
      }

      case 'test': {
        const name = args.name as string;
        const config = this.manager.getConfig(name);
        if (!config) {
          return { success: false, output: '', error: `未找到数据库配置: ${name || '(默认)'}` };
        }

        // SQLite 测试
        if (config.type === 'sqlite') {
          try {
            const sqliteLib = await getBetterSqlite3();

            if (typeof sqliteLib === 'object' && 'useSqlJs' in sqliteLib) {
              const SQL = await sqliteLib.initSqlJs();
              let db: any;

              if (config.filepath && config.filepath !== ':memory:' && fs.existsSync(config.filepath)) {
                const buffer = fs.readFileSync(config.filepath);
                db = new SQL.Database(buffer);
              } else {
                db = new SQL.Database();
              }

              try {
                const result = db.exec('SELECT sqlite_version() as version');
                const version = result[0]?.values[0]?.[0] || 'unknown';
                return {
                  success: true,
                  output: `SQLite 连接成功!\nSQLite 版本: ${version}\n文件路径: ${config.filepath}`,
                };
              } finally {
                db.close();
              }
            }

            const Database = sqliteLib;
            const db = new (Database as any)(config.filepath || ':memory:');

            try {
              const row = db.prepare('SELECT sqlite_version() as version').get() as { version: string };
              return {
                success: true,
                output: `SQLite 连接成功!\nSQLite 版本: ${row.version}\n文件路径: ${config.filepath}`,
              };
            } finally {
              db.close();
            }
          } catch (error) {
            return {
              success: false,
              output: '',
              error: `SQLite 连接失败: ${(error as Error).message}`,
            };
          }
        }

        // MySQL 测试
        try {
          const mysqlLib = await getMysql();
          const connection = await mysqlLib.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            connectTimeout: 5000,
          });

          const [rows] = await connection.execute('SELECT VERSION() as version');
          const version = (rows as any[])[0]?.version || 'unknown';
          await connection.end();

          return {
            success: true,
            output: `MySQL 连接成功!\n服务器版本: ${version}\n主机: ${config.host}:${config.port}`,
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `MySQL 连接失败: ${(error as Error).message}`,
          };
        }
      }

      default:
        return { success: false, output: '', error: `未知操作: ${action}` };
    }
  }
}
