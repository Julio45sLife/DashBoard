import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { InvoicingService } from './invoicing.service';
import { CreateInvoiceDto, RecordPaymentDto, UpdateInvoiceDto } from './dto/invoicing.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Invoicing')
@Controller('invoicing')
export class InvoicingController {
  constructor(private invoicingService: InvoicingService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices/quotes (paginated)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('status') status?: InvoiceStatus,
    @Query('type') type?: InvoiceType,
    @Query('search') search?: string,
    @Query('contactId') contactId?: string,
  ) {
    return this.invoicingService.findAll(user.tenantId, { page, limit, status, type, search, contactId });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Invoice statistics and KPIs' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.invoicingService.getStats(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice with line items and payments' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicingService.findOne(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Create invoice or quote' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateInvoiceDto) {
    return this.invoicingService.create(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Update DRAFT invoice' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicingService.update(user.tenantId, id, dto);
  }

  @Post(':id/send')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Mark invoice as SENT' })
  send(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicingService.markAsSent(user.tenantId, id);
  }

  @Post(':id/payments')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Record a payment on an invoice' })
  recordPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoicingService.recordPayment(user.tenantId, id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel invoice' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicingService.cancel(user.tenantId, id);
  }
}
