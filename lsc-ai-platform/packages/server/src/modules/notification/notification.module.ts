import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { EmailService } from './email.service.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

@Module({
  imports: [
    PrismaModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST', 'localhost'),
          port: config.get<number>('SMTP_PORT', 1025),
          secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
          auth: config.get<string>('SMTP_USER')
            ? {
                user: config.get<string>('SMTP_USER'),
                pass: config.get<string>('SMTP_PASS'),
              }
            : undefined,
        },
        defaults: {
          from: config.get<string>('MAIL_FROM', 'LSC-AI平台 <noreply@lsc-ai.com>'),
        },
        template: {
          dir: join(__dirname, '../../templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationController],
  providers: [EmailService, NotificationService],
  exports: [EmailService, NotificationService],
})
export class NotificationModule {}
