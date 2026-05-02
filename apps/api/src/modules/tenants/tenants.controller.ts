import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TenantsService } from './tenants.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tenant')
@Controller('tenant')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get current tenant settings' })
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getSettings(user.tenantId);
  }

  @Get('plan')
  @ApiOperation({ summary: 'Get current plan and limits' })
  async getPlan(@CurrentUser() user: JwtPayload) {
    const [settings, limits] = await Promise.all([
      this.tenantsService.getSettings(user.tenantId),
      this.tenantsService.getPlanLimits(user.tenantId),
    ]);
    return { plan: settings?.plan, limits };
  }

  @Patch('settings')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Update tenant settings (admin only)' })
  updateSettings(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.tenantsService.updateSettings(user.tenantId, body as Parameters<TenantsService['updateSettings']>[1]);
  }
}
