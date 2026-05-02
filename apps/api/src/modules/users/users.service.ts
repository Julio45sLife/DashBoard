import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private tenantsService: TenantsService,
  ) {}

  async findAll(tenantId: string, params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, avatarUrl: true, phone: true,
        emailVerified: true, lastLoginAt: true, createdAt: true,
        permissions: true,
      },
    });

    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto, createdByRole: UserRole) {
    if (!this.canManageRole(createdByRole, dto.role ?? UserRole.READONLY)) {
      throw new ForbiddenException(`Cannot create user with role ${dto.role}`);
    }

    const quota = await this.tenantsService.checkQuota(tenantId, 'users_total');
    if (!quota.allowed) {
      throw new ForbiddenException(`User limit reached (${quota.current}/${quota.limit}). Upgrade your plan.`);
    }

    const exists = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email.toLowerCase() } } });
    if (exists) throw new ConflictException(`User with email ${dto.email} already exists`);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? UserRole.EMPLOYEE,
        phone: dto.phone,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true,
      },
    });
  }

  async update(tenantId: string, userId: string, dto: UpdateUserDto, requestorRole: UserRole) {
    const user = await this.findOne(tenantId, userId);

    if (dto.role && !this.canManageRole(requestorRole, dto.role)) {
      throw new ForbiddenException(`Cannot assign role ${dto.role}`);
    }

    const data: Record<string, unknown> = {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.role && { role: dto.role }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
  }

  async remove(tenantId: string, userId: string, requestorId: string) {
    if (userId === requestorId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.findOne(tenantId, userId);

    // Soft delete: deactivate instead of hard delete (preserves audit trail)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, email: `deleted_${Date.now()}_${user.email}` },
    });
  }

  private canManageRole(requestorRole: UserRole, targetRole: UserRole): boolean {
    const roleOrder = [UserRole.READONLY, UserRole.EMPLOYEE, UserRole.ACCOUNTANT, UserRole.MANAGER, UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN];
    return roleOrder.indexOf(requestorRole) > roleOrder.indexOf(targetRole);
  }
}
