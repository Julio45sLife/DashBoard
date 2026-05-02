import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, EmployeeType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EVENTS } from '../../events/domain-events';
import { CreateEmployeeDto, UpdateEmployeeDto, CreateLeaveDto, CreateTimesheetDto } from './dto/hr.dto';

@Injectable()
export class HrService {
  constructor(
    private prisma: PrismaService,
    private tenantsService: TenantsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, params: {
    page: number;
    limit: number;
    search?: string;
    type?: EmployeeType;
    status?: EmployeeStatus;
    department?: string;
  }) {
    const { page, limit, search, type, status, department } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(type && { type }),
      ...(status && { status }),
      ...(department && { department }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { position: { contains: search, mode: 'insensitive' as const } },
          { companyName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, type: true, status: true, position: true,
          department: true, grossSalary: true, hiredAt: true,
          companyName: true, avatarUrl: true, tags: true,
        },
        orderBy: [{ status: 'asc' }, { lastName: 'asc' }],
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        leaves: { orderBy: { startDate: 'desc' }, take: 20 },
        timesheets: { orderBy: { date: 'desc' }, take: 50 },
      },
    });

    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return employee;
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    const quota = await this.tenantsService.checkQuota(tenantId, 'employees_total');
    if (!quota.allowed) {
      throw new ForbiddenException(`Employee limit reached (${quota.current}/${quota.limit}). Upgrade your plan.`);
    }

    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        type: dto.type ?? EmployeeType.EMPLOYEE,
        status: EmployeeStatus.ACTIVE,
        position: dto.position,
        department: dto.department,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        grossSalary: dto.grossSalary,
        salaryPeriod: dto.salaryPeriod ?? 'monthly',
        hourlyRate: dto.hourlyRate,
        companyName: dto.companyName,
        siren: dto.siren,
        contractType: dto.contractType,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
        notes: dto.notes,
        tags: dto.tags ?? [],
      },
    });

    this.eventEmitter.emit(EVENTS.EMPLOYEE_CREATED, { tenantId, employeeId: employee.id });
    return employee;
  }

  async update(tenantId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.findOne(tenantId, employeeId);

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.grossSalary !== undefined) data.grossSalary = dto.grossSalary;
    if (dto.hourlyRate !== undefined) data.hourlyRate = dto.hourlyRate;
    if (dto.contractType !== undefined) data.contractType = dto.contractType;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.terminatedAt) {
      data.terminatedAt = new Date(dto.terminatedAt);
      data.status = EmployeeStatus.TERMINATED;
    }

    return this.prisma.employee.update({ where: { id: employeeId }, data });
  }

  async addLeave(tenantId: string, employeeId: string, userId: string, dto: CreateLeaveDto) {
    await this.findOne(tenantId, employeeId);

    return this.prisma.employeeLeave.create({
      data: {
        employeeId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        days: dto.days,
        approvedById: userId,
        notes: dto.notes,
      },
    });
  }

  async approveLeave(tenantId: string, employeeId: string, leaveId: string, userId: string) {
    await this.findOne(tenantId, employeeId);

    return this.prisma.employeeLeave.update({
      where: { id: leaveId },
      data: { approved: true, approvedById: userId },
    });
  }

  async addTimesheet(tenantId: string, employeeId: string, dto: CreateTimesheetDto) {
    await this.findOne(tenantId, employeeId);

    return this.prisma.employeeTimesheet.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: new Date(dto.date),
        },
      },
      update: { hoursWorked: dto.hoursWorked, description: dto.description, projectRef: dto.projectRef },
      create: {
        employeeId,
        date: new Date(dto.date),
        hoursWorked: dto.hoursWorked,
        description: dto.description,
        projectRef: dto.projectRef,
      },
    });
  }

  async getStats(tenantId: string) {
    const [total, byType, byStatus, byDepartment] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.employee.groupBy({ by: ['type'], where: { tenantId }, _count: true }),
      this.prisma.employee.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      this.prisma.employee.groupBy({ by: ['department'], where: { tenantId, department: { not: null } }, _count: true }),
    ]);

    return {
      total,
      byType: byType.map((e) => ({ type: e.type, count: e._count })),
      byStatus: byStatus.map((e) => ({ status: e.status, count: e._count })),
      byDepartment: byDepartment.map((e) => ({ department: e.department, count: e._count })),
    };
  }
}
