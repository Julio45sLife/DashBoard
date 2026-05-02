import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../decorators/user.decorator';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  TENANT_ADMIN: 80,
  MANAGER: 60,
  ACCOUNTANT: 50,
  EMPLOYEE: 30,
  READONLY: 10,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) throw new ForbiddenException('Authentication required');

    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const hasRole = requiredRoles.some((role) => userLevel >= ROLE_HIERARCHY[role]);

    if (!hasRole) {
      throw new ForbiddenException(`Insufficient role. Required: ${requiredRoles.join(' or ')}`);
    }

    return true;
  }
}
