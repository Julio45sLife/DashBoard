import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, UserRole } from '@prisma/client';
import { AuditService } from './audit.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get audit log (admin only)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
  ) {
    return this.auditService.findAll(user.tenantId, { page, limit, resource, userId, action });
  }
}
