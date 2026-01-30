import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ChatService } from './chat.service.js';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: '发送消息' })
  async chat(
    @Body() body: { sessionId: string; message: string },
    @Request() req: any,
  ) {
    return this.chatService.chat(body.sessionId, body.message, req.user.id);
  }
}
