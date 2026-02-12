import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

// SQL statement blocklist for read-only enforcement
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|EXEC|EXECUTE)\b/i;
const MAX_ROWS = 1000;
const QUERY_TIMEOUT_MS = 30000;

interface DbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

@Injectable()
export class ConnectorService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectorService.name);
  private pools: Map<string, any> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create a connection pool for a given credential ID
   */
  private async getPool(connectionId: string): Promise<{ pool: any; type: string }> {
    if (this.pools.has(connectionId)) {
      return this.pools.get(connectionId);
    }

    const credential = await this.prisma.credential.findUnique({
      where: { id: connectionId },
    });

    if (!credential) {
      throw new NotFoundException(`Connection not found: ${connectionId}`);
    }

    if (credential.type !== 'db_mysql' && credential.type !== 'db_postgresql') {
      throw new BadRequestException(`Unsupported connection type: ${credential.type}`);
    }

    const config: DbConfig = JSON.parse(credential.encryptedData);

    let pool: any;
    if (credential.type === 'db_mysql') {
      const mysql = await import('mysql2/promise');
      pool = mysql.default.createPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        waitForConnections: true,
        connectionLimit: 5,
        connectTimeout: QUERY_TIMEOUT_MS,
      });
    } else {
      const pg = await import('pg');
      pool = new pg.default.Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        max: 5,
        connectionTimeoutMillis: QUERY_TIMEOUT_MS,
        statement_timeout: QUERY_TIMEOUT_MS,
      });
    }

    const entry = { pool, type: credential.type };
    this.pools.set(connectionId, entry);
    this.logger.log(`Connection pool created for ${connectionId} (${credential.type})`);
    return entry;
  }

  /**
   * Execute a read-only SQL query against an external database
   */
  async query(connectionId: string, sql: string, params?: any[]) {
    // Enforce read-only
    if (WRITE_KEYWORDS.test(sql)) {
      throw new BadRequestException('Only read-only (SELECT) queries are allowed');
    }

    const { pool, type } = await this.getPool(connectionId);

    if (type === 'db_mysql') {
      const [rows, fields] = await pool.query(
        { sql, timeout: QUERY_TIMEOUT_MS },
        params || [],
      );
      const limited = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : rows;
      return {
        rows: limited,
        fields: (fields as any[])?.map((f: any) => f.name),
        rowCount: Array.isArray(rows) ? rows.length : 0,
      };
    } else {
      const result = await pool.query(sql, params || []);
      const limited = result.rows.slice(0, MAX_ROWS);
      return {
        rows: limited,
        fields: result.fields?.map((f: any) => f.name),
        rowCount: result.rowCount ?? result.rows.length,
      };
    }
  }

  /**
   * Test an external database connection
   */
  async testConnection(config: {
    type: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      if (config.type === 'db_mysql') {
        const mysql = await import('mysql2/promise');
        const conn = await mysql.default.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          connectTimeout: 10000,
        });
        await conn.query('SELECT 1');
        await conn.end();
      } else if (config.type === 'db_postgresql') {
        const pg = await import('pg');
        const client = new pg.default.Client({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          connectionTimeoutMillis: 10000,
        });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
      } else {
        return { success: false, error: `Unsupported type: ${config.type}` };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get table list from an external database
   */
  async getTableList(connectionId: string): Promise<string[]> {
    const { pool, type } = await this.getPool(connectionId);

    if (type === 'db_mysql') {
      const [rows] = await pool.query('SHOW TABLES');
      return (rows as any[]).map((row: any) => Object.values(row)[0] as string);
    } else {
      const result = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      );
      return result.rows.map((r: any) => r.table_name);
    }
  }

  /**
   * Get table schema (columns) from an external database
   */
  async getTableSchema(connectionId: string, tableName: string) {
    // Validate table name to prevent injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new BadRequestException('Invalid table name');
    }

    const { pool, type } = await this.getPool(connectionId);

    if (type === 'db_mysql') {
      const [rows] = await pool.query(`DESCRIBE \`${tableName}\``);
      return rows;
    } else {
      const result = await pool.query(
        'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
        [tableName],
      );
      return result.rows;
    }
  }

  /**
   * Find a credential by name (for AI tool lookup)
   */
  async findByName(name: string, userId?: string) {
    const where: any = { name };
    if (userId) {
      where.userId = userId;
    }
    return this.prisma.credential.findFirst({
      where: {
        ...where,
        type: { in: ['db_mysql', 'db_postgresql'] },
      },
    });
  }

  /**
   * Close a specific connection pool
   */
  private async closePool(connectionId: string) {
    const entry = this.pools.get(connectionId);
    if (!entry) return;

    try {
      if (entry.type === 'db_mysql') {
        await entry.pool.end();
      } else {
        await entry.pool.end();
      }
    } catch (error) {
      this.logger.warn(`Failed to close pool ${connectionId}: ${(error as Error).message}`);
    }
    this.pools.delete(connectionId);
  }

  /**
   * Remove a connection pool (called when connection is deleted)
   */
  async removePool(connectionId: string) {
    await this.closePool(connectionId);
  }

  /**
   * Cleanup all connection pools on module destroy
   */
  async onModuleDestroy() {
    this.logger.log(`Closing ${this.pools.size} connection pools...`);
    const promises = Array.from(this.pools.keys()).map((id) => this.closePool(id));
    await Promise.allSettled(promises);
    this.logger.log('All connection pools closed');
  }
}
