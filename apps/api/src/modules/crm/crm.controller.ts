import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactStatus } from '@prisma/client';
import { CrmService } from './crm.service';
import { CreateContactDto, CreateInteractionDto, UpdateContactDto } from './dto/crm.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';

@ApiTags('CRM')
@Controller('crm/contacts')
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts (paginated, searchable)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: ContactStatus,
  ) {
    return this.crmService.findAll(user.tenantId, { page, limit, search, status });
  }

  @Get('stats')
  @ApiOperation({ summary: 'CRM statistics' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.crmService.getStats(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact details + interactions + invoices' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create contact' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateContactDto) {
    return this.crmService.create(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.crmService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contact' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.remove(user.tenantId, id);
  }

  @Post(':id/interactions')
  @ApiOperation({ summary: 'Add interaction to contact history' })
  addInteraction(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInteractionDto,
  ) {
    return this.crmService.addInteraction(user.tenantId, id, user.sub, dto);
  }
}
