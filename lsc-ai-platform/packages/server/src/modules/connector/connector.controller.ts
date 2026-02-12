import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConnectorService } from './connector.service.js';

@ApiTags('Connectors')
@Controller('connectors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class ConnectorController {
  constructor(
    private readonly connectorService: ConnectorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a database connection' })
  async create(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      type: 'db_mysql' | 'db_postgresql';
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    },
  ) {
    if (!body.name || !body.type || !body.host || !body.port || !body.database || !body.username) {
      throw new BadRequestException('Missing required fields');
    }

    if (body.type !== 'db_mysql' && body.type !== 'db_postgresql') {
      throw new BadRequestException('Type must be db_mysql or db_postgresql');
    }

    const credential = await this.prisma.credential.create({
      data: {
        userId: req.user.id,
        name: body.name,
        type: body.type,
        encryptedData: JSON.stringify({
          host: body.host,
          port: body.port,
          database: body.database,
          username: body.username,
          password: body.password,
        }),
      },
    });

    return {
      id: credential.id,
      name: credential.name,
      type: credential.type,
      createdAt: credential.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List database connections' })
  async list(@Req() req: any) {
    const credentials = await this.prisma.credential.findMany({
      where: {
        userId: req.user.id,
        type: { in: ['db_mysql', 'db_postgresql'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return without password
    return credentials.map((c) => {
      let config: any = {};
      try {
        config = JSON.parse(c.encryptedData);
      } catch { /* ignore */ }
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        createdAt: c.createdAt,
      };
    });
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a database connection' })
  async test(@Param('id') id: string) {
    const credential = await this.prisma.credential.findUnique({ where: { id } });
    if (!credential) {
      throw new NotFoundException('Connection not found');
    }

    const config = JSON.parse(credential.encryptedData);
    return this.connectorService.testConnection({
      type: credential.type,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
    });
  }

  @Post(':id/query')
  @ApiOperation({ summary: 'Execute a read-only SQL query' })
  async query(
    @Param('id') id: string,
    @Body() body: { sql: string; params?: any[] },
  ) {
    if (!body.sql) {
      throw new BadRequestException('SQL query is required');
    }
    return this.connectorService.query(id, body.sql, body.params);
  }

  @Get(':id/tables')
  @ApiOperation({ summary: 'Get table list from external database' })
  async getTables(@Param('id') id: string) {
    return this.connectorService.getTableList(id);
  }

  @Get(':id/tables/:tableName')
  @ApiOperation({ summary: 'Get table schema from external database' })
  async getTableSchema(
    @Param('id') id: string,
    @Param('tableName') tableName: string,
  ) {
    return this.connectorService.getTableSchema(id, tableName);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a database connection' })
  async remove(@Param('id') id: string) {
    const credential = await this.prisma.credential.findUnique({ where: { id } });
    if (!credential) {
      throw new NotFoundException('Connection not found');
    }

    // Close the pool if it exists
    await this.connectorService.removePool(id);

    await this.prisma.credential.delete({ where: { id } });
    return { success: true };
  }
}
