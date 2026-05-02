import {
  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe,
  Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeeStatus, EmployeeType, UserRole } from '@prisma/client';
import { HrService } from './hr.service';
import { CreateEmployeeDto, CreateLeaveDto, CreateTimesheetDto, UpdateEmployeeDto } from './dto/hr.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('HR')
@Controller('hr/employees')
export class HrController {
  constructor(private hrService: HrService) {}

  @Get()
  @ApiOperation({ summary: 'List employees (paginated)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('search') search?: string,
    @Query('type') type?: EmployeeType,
    @Query('status') status?: EmployeeStatus,
    @Query('department') department?: string,
  ) {
    return this.hrService.findAll(user.tenantId, { page, limit, search, type, status, department });
  }

  @Get('stats')
  @ApiOperation({ summary: 'HR statistics' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.hrService.getStats(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee detail with leaves and timesheets' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.hrService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create employee or subcontractor' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.hrService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update employee' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.hrService.update(user.tenantId, id, dto);
  }

  @Post(':id/leaves')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Submit leave request for employee' })
  addLeave(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeaveDto,
  ) {
    return this.hrService.addLeave(user.tenantId, id, user.sub, dto);
  }

  @Post(':id/leaves/:leaveId/approve')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve leave request' })
  approveLeave(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('leaveId', ParseUUIDPipe) leaveId: string,
  ) {
    return this.hrService.approveLeave(user.tenantId, id, leaveId, user.sub);
  }

  @Post(':id/timesheets')
  @ApiOperation({ summary: 'Submit timesheet entry' })
  addTimesheet(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTimesheetDto,
  ) {
    return this.hrService.addTimesheet(user.tenantId, id, dto);
  }
}
