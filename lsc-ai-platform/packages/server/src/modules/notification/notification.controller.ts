import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { NotificationService } from './notification.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('prefs')
  @ApiOperation({ summary: '获取通知偏好' })
  async getPrefs(@Request() req: any) {
    const prefs = await this.notificationService.getNotifyPrefs(req.user.id);
    return prefs;
  }

  @Patch('prefs')
  @ApiOperation({ summary: '更新通知偏好' })
  async updatePrefs(
    @Request() req: any,
    @Body()
    body: {
      email?: string;
      taskComplete?: boolean;
      taskFailed?: boolean;
      alertTriggered?: boolean;
      reportGenerated?: boolean;
      systemEvent?: boolean;
      weeklyDigest?: boolean;
    },
  ) {
    const prefs = await this.notificationService.updateNotifyPrefs(req.user.id, body);
    return prefs;
  }
}
