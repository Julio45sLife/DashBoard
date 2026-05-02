import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';

declare module 'express' {
  interface Request {
    tenantId?: string;
    tenantSlug?: string;
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Resolution order:
    // 1. X-Tenant-ID header (API clients, mobile apps)
    // 2. Subdomain: acme.vilar-ds.fr → slug = "acme"
    // 3. JWT payload (injected by JwtStrategy)
    const tenantHeader = req.headers['x-tenant-id'] as string | undefined;

    if (tenantHeader) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantHeader },
        select: { id: true, slug: true, status: true },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant not found: ${tenantHeader}`);
      }

      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;
      return next();
    }

    const host = req.hostname;
    const parts = host.split('.');
    if (parts.length >= 3) {
      const slug = parts[0];
      if (slug && slug !== 'www' && slug !== 'api') {
        const tenant = await this.prisma.tenant.findUnique({
          where: { slug },
          select: { id: true, slug: true, status: true },
        });

        if (tenant) {
          req.tenantId = tenant.id;
          req.tenantSlug = tenant.slug;
          return next();
        }
      }
    }

    next();
  }
}
