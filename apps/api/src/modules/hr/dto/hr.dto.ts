import {
  IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional,
  IsString, MaxLength, Min, IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmployeeStatus, EmployeeType } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty() @IsString() @MaxLength(100) firstName: string;
  @ApiProperty() @IsString() @MaxLength(100) lastName: string;
  @ApiProperty() @IsString() email: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ enum: EmployeeType, required: false }) @IsOptional() @IsEnum(EmployeeType) type?: EmployeeType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() position?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() department?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() hiredAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) grossSalary?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() salaryPeriod?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) hourlyRate?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() companyName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() siren?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() contractType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() contractEndDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() tags?: string[];
}

export class UpdateEmployeeDto extends CreateEmployeeDto {
  @ApiProperty({ enum: EmployeeStatus, required: false }) @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() terminatedAt?: string;
}

export class CreateLeaveDto {
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty() @IsNumber() @Min(0.5) days: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class CreateTimesheetDto {
  @ApiProperty() @IsDateString() date: string;
  @ApiProperty() @IsNumber() @Min(0.5) hoursWorked: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() projectRef?: string;
}
