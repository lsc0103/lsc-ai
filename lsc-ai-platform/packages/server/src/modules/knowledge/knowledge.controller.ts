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
import * as path from 'path';

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx', '.xlsx'];
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

@ApiTags('知识库')
@Controller('knowledge-bases')
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
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const extOk = ALLOWED_EXTENSIONS.includes(ext);
        const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
        if (extOk && mimeOk) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              '不支持的文件格式，仅支持 txt/md/pdf/docx/xlsx',
            ),
            false,
          );
        }
      },
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
  async findDocuments(
    @Param('id') id: string,
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.knowledgeService.findDocuments(id, req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: '删除文档' })
  async removeDocument(@Param('id') id: string, @Request() req: any) {
    return this.knowledgeService.deleteDocument(id, req.user.id);
  }
}
