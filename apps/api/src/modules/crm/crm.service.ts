import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContactStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EVENTS } from '../../events/domain-events';
import { CreateContactDto, CreateInteractionDto, UpdateContactDto } from './dto/crm.dto';

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private tenantsService: TenantsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, params: {
    page: number;
    limit: number;
    search?: string;
    status?: ContactStatus;
  }) {
    const { page, limit, search, status } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          isCompany: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          city: true,
          totalRevenue: true,
          totalInvoices: true,
          lastInteraction: true,
          tags: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 20,
        },
        invoices: {
          select: { id: true, number: true, status: true, totalCents: true, issuedAt: true },
          orderBy: { issuedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!contact) throw new NotFoundException(`Contact ${contactId} not found`);
    return contact;
  }

  async create(tenantId: string, userId: string, dto: CreateContactDto) {
    const quota = await this.tenantsService.checkQuota(tenantId, 'contacts_total');
    if (!quota.allowed) {
      throw new ForbiddenException(`Contact limit reached (${quota.current}/${quota.limit}). Upgrade your plan.`);
    }

    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        createdById: userId,
        isCompany: dto.isCompany ?? false,
        companyName: dto.companyName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        mobile: dto.mobile,
        website: dto.website,
        status: dto.status ?? ContactStatus.LEAD,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode,
        country: dto.country ?? 'FR',
        siren: dto.siren,
        vatNumber: dto.vatNumber,
        notes: dto.notes,
        tags: dto.tags ?? [],
        source: dto.source,
      },
    });

    this.eventEmitter.emit(EVENTS.CONTACT_CREATED, { tenantId, contactId: contact.id });

    return contact;
  }

  async update(tenantId: string, contactId: string, dto: UpdateContactDto) {
    await this.findOne(tenantId, contactId);

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(dto.isCompany !== undefined && { isCompany: dto.isCompany }),
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.mobile !== undefined && { mobile: dto.mobile }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });
  }

  async remove(tenantId: string, contactId: string) {
    await this.findOne(tenantId, contactId);
    await this.prisma.contact.delete({ where: { id: contactId } });
  }

  async addInteraction(tenantId: string, contactId: string, userId: string, dto: CreateInteractionDto) {
    await this.findOne(tenantId, contactId);

    const interaction = await this.prisma.interaction.create({
      data: {
        contactId,
        type: dto.type,
        subject: dto.subject,
        content: dto.content,
        occurredAt: dto.occurredAt ?? new Date(),
        createdById: userId,
      },
    });

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { lastInteraction: interaction.occurredAt },
    });

    return interaction;
  }

  async getStats(tenantId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.contact.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    };
  }
}
