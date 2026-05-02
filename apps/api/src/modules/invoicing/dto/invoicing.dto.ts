import {
  IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID,
  MaxLength, Min, ValidateNested, IsArray, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceType, PaymentMethod } from '@prisma/client';

export class LineItemDto {
  @ApiProperty() @IsString() @MaxLength(500) description: string;
  @ApiProperty() @IsNumber() @Min(0.01) quantity: number;
  @ApiProperty() @IsInt() @Min(0) unitPriceCents: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) discountPct?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceType, required: false }) @IsOptional() @IsEnum(InvoiceType) type?: InvoiceType;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() contactId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() footer?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @ApiProperty({ type: [LineItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) lineItems: LineItemDto[];
}

export class UpdateInvoiceDto {
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() contactId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() footer?: string;
  @ApiProperty({ required: false, type: [LineItemDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto) lineItems?: LineItemDto[];
}

export class RecordPaymentDto {
  @ApiProperty() @IsInt() @Min(1) amountCents: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty({ required: false }) @IsOptional() @IsString() reference?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}
