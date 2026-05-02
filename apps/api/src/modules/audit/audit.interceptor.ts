import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditAction } from '@prisma/client';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { JwtPayload } from '../../common/decorators/user.decorator';

export const AUDIT_KEY = 'audit_action';
export const AUDIT_RESOURCE_KEY = 'audit_resource';

export interface AuditMeta {
  action: AuditAction;
  resource: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!auditMeta) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;

    return next.handle().pipe(
      tap((responseData) => {
        if (!user?.tenantId) return;

        const resourceId =
          (request.params['id'] as string | undefined) ??
          (responseData as { id?: string } | undefined)?.id;

        void this.auditService.log({
          tenantId: user.tenantId,
          userId: user.sub,
          action: auditMeta.action,
          resource: auditMeta.resource,
          resourceId,
          newValues: request.method !== 'GET' ? (request.body as Record<string, unknown>) : undefined,
          ipAddress: request.ip,
          userAgent: request.get('user-agent'),
        });
      }),
    );
  }
}
