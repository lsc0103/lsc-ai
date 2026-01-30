import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { UploadService, FileInfo } from './upload.service.js';

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 允许的文件类型
const ALLOWED_MIMES = [
  // 图片
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // 文档
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // 代码/文本
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'text/markdown',
  'text/x-markdown',           // 某些系统的 .md 文件
  'application/x-markdown',    // 某些浏览器的 .md 文件
  // 压缩包
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

@ApiTags('文件上传')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: '上传单个文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        sessionId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        // 首先检查 MIME 类型
        if (ALLOWED_MIMES.includes(file.mimetype)) {
          callback(null, true);
          return;
        }

        // 如果 MIME 类型不匹配，使用文件扩展名作为后备检测
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        const allowedExtensions = [
          'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
          'txt', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
          'json', 'xml', 'md', 'markdown',
          'zip', 'rar', '7z',
        ];

        if (ext && allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(new BadRequestException(`不支持的文件类型: ${file.mimetype} (${ext})`), false);
        }
      },
    }),
  )
  async uploadFile(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ success: boolean; data: FileInfo }> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const result = await this.uploadService.uploadFile({
      userId: req.user.id,
      sessionId,
      file,
    });

    return { success: true, data: result };
  }

  @Post('batch')
  @ApiOperation({ summary: '批量上传文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        sessionId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        // 首先检查 MIME 类型
        if (ALLOWED_MIMES.includes(file.mimetype)) {
          callback(null, true);
          return;
        }

        // 如果 MIME 类型不匹配，使用文件扩展名作为后备检测
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        const allowedExtensions = [
          'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
          'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
          'txt', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
          'json', 'xml', 'md', 'markdown',
          'zip', 'rar', '7z',
        ];

        if (ext && allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(new BadRequestException(`不支持的文件类型: ${file.mimetype} (${ext})`), false);
        }
      },
    }),
  )
  async uploadFiles(
    @Request() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('sessionId') sessionId?: string,
  ): Promise<{ success: boolean; data: FileInfo[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const results = await this.uploadService.uploadFiles(
      req.user.id,
      sessionId,
      files,
    );

    return { success: true, data: results };
  }

  @Get()
  @ApiOperation({ summary: '获取用户文件列表' })
  async getUserFiles(
    @Request() req: any,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ success: boolean; data: FileInfo[] }> {
    const files = await this.uploadService.getUserFiles(req.user.id, sessionId);
    return { success: true, data: files };
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文件信息' })
  async getFile(@Param('id') id: string): Promise<{ success: boolean; data: FileInfo | null }> {
    const file = await this.uploadService.getFileById(id);
    return { success: true, data: file };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除文件' })
  async deleteFile(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const deleted = await this.uploadService.deleteFile(id, req.user.id);
    if (!deleted) {
      throw new BadRequestException('文件不存在或无权删除');
    }
    return { success: true };
  }
}
