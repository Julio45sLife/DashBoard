import {
  IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsArray,
  MaxLength, IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContactStatus, InteractionType } from '@prisma/client';

export class CreateContactDto {
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isCompany?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() mobile?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUrl() website?: string;
  @ApiProperty({ enum: ContactStatus, required: false }) @IsOptional() @IsEnum(ContactStatus) status?: ContactStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() postalCode?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() country?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() siren?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vatNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() source?: string;
}

export class UpdateContactDto extends CreateContactDto {}

export class CreateInteractionDto {
  @ApiProperty({ enum: InteractionType }) @IsEnum(InteractionType) type: InteractionType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() subject?: string;
  @ApiProperty() @IsString() content: string;
  @ApiProperty({ required: false }) @IsOptional() occurredAt?: Date;
}
