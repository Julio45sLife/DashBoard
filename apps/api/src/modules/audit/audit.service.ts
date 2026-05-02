import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuditLogPayload {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(payload: AuditLogPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: payload.tenantId,
          userId: payload.userId,
          action: payload.action,
          resource: payload.resource,
          resourceId: payload.resourceId,
          oldValues: payload.oldValues as object | undefined,
          newValues: payload.newValues as object | undefined,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
        },
      });
    } catch (err) {
      // Audit logging must never break the main flow
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async findAll(tenantId: string, params: {
    page: number;
    limit: number;
    resource?: string;
    userId?: string;
    action?: AuditAction;
  }) {
    const { page, limit, resource, userId, action } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(resource && { resource }),
      ...(userId && { userId }),
      ...(action && { action }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
