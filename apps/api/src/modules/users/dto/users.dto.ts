import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiProperty() @IsString() @MaxLength(50) firstName: string;
  @ApiProperty() @IsString() @MaxLength(50) lastName: string;
  @ApiProperty({ enum: UserRole, required: false }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(50) firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(50) lastName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ enum: UserRole, required: false }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(8) password?: string;
}
