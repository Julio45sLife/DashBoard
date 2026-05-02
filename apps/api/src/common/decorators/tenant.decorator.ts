import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId as string;
  },
);
