import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { KnowledgeService } from './knowledge.service.js';

@ApiTags('知识库')
@Controller('api/knowledge-bases')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post()
  @ApiOperation({ summary: '创建知识库' })
  async create(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      description?: string;
      projectId?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    },
  ) {
    return this.knowledgeService.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: '知识库列表' })
  async findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.knowledgeService.findAll(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '知识库详情' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.knowledgeService.findById(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新知识库' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: {
      name?: string;
      description?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    },
  ) {
    return this.knowledgeService.update(id, req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.knowledgeService.delete(id, req.user.id);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: '上传文档到知识库' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadDocument(
    @Param('id') id: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }
    return this.knowledgeService.uploadDocument(id, req.user.id, file);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: '知识库文档列表' })
  async findDocuments(@Param('id') id: string, @Request() req: any) {
    return this.knowledgeService.findDocuments(id, req.user.id);
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: '删除文档' })
  async removeDocument(@Param('id') id: string, @Request() req: any) {
    return this.knowledgeService.deleteDocument(id, req.user.id);
  }
}
