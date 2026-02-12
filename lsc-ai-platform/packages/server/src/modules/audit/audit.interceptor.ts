import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service.js';

const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function extractResource(url: string): { resourceType?: string; resourceId?: string } {
  // Remove query string
  const path = url.split('?')[0] ?? url;
  // Match /api/<resource>/<id> or /api/<resource>
  const match = path.match(/\/api\/([a-z-]+)(?:\/([a-z0-9-]+))?/i);
  if (!match?.[1]) return {};
  const resourceType = match[1].replace(/s$/, ''); // sessions -> session
  const resourceId = match[2] || undefined;
  return { resourceType, resourceId };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Only intercept HTTP context with audited methods
    if (!request || !AUDITED_METHODS.has(request.method)) {
      return next.handle();
    }

    const user = request.user as { id?: string; username?: string } | undefined;
    const ip = request.headers?.['x-forwarded-for'] || request.ip || '';
    const userAgent = request.headers?.['user-agent'] || '';
    const action = `${request.method} ${request.url?.split('?')[0] || request.url}`;
    const { resourceType, resourceId } = extractResource(request.url || '');
    const details = request.body && Object.keys(request.body).length > 0
      ? request.body
      : undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget: do not block response
          this.auditService.log({
            userId: user?.id,
            username: user?.username,
            action,
            resourceType,
            resourceId,
            details,
            ipAddress: typeof ip === 'string' ? ip : (ip as string[])?.[0],
            userAgent,
            success: true,
          });
        },
        error: (err: Error) => {
          this.auditService.log({
            userId: user?.id,
            username: user?.username,
            action,
            resourceType,
            resourceId,
            details,
            ipAddress: typeof ip === 'string' ? ip : (ip as string[])?.[0],
            userAgent,
            success: false,
            errorMessage: err.message || String(err),
          });
        },
      }),
    );
  }
}
