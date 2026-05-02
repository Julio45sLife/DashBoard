import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Main dashboard KPIs and charts data' })
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getOverview(user.tenantId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Recent activity feed' })
  getActivity(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.dashboardService.getActivityFeed(user.tenantId, limit);
  }
}
