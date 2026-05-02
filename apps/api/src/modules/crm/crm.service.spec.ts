import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { ContactStatus, InteractionType } from '@prisma/client';
import { CrmService } from './crm.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CONTACT_ID = 'contact-1';

const mockContact = {
  id: CONTACT_ID,
  tenantId: TENANT_ID,
  isCompany: false,
  firstName: 'Marie',
  lastName: 'Martin',
  companyName: null,
  email: 'marie@example.com',
  phone: null,
  mobile: null,
  website: null,
  status: ContactStatus.LEAD,
  address: null,
  city: 'Paris',
  postalCode: '75001',
  country: 'FR',
  siren: null,
  vatNumber: null,
  notes: null,
  tags: [],
  source: null,
  totalRevenue: 0,
  totalInvoices: 0,
  lastInteraction: null,
  createdAt: new Date(),
  createdById: USER_ID,
};

const mockPrisma = {
  contact: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  },
  interaction: {
    create: jest.fn(),
  },
};

const mockTenantsService = {
  checkQuota: jest.fn().mockResolvedValue({ allowed: true, current: 0, limit: 100 }),
};

const mockEmitter = { emit: jest.fn() };

describe('CrmService', () => {
  let service: CrmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<CrmService>(CrmService);
    jest.clearAllMocks();
    mockTenantsService.checkQuota.mockResolvedValue({ allowed: true, current: 0, limit: 100 });
  });

  describe('findAll', () => {
    it('returns paginated contacts', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID }, skip: 0, take: 20 }),
      );
    });

    it('filters by search term', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, limit: 20, search: 'Marie' });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('filters by status', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, limit: 20, status: ContactStatus.CUSTOMER });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ContactStatus.CUSTOMER }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns contact with interactions and invoices', async () => {
      const contactWithRelations = { ...mockContact, interactions: [], invoices: [] };
      mockPrisma.contact.findFirst.mockResolvedValue(contactWithRelations);

      const result = await service.findOne(TENANT_ID, CONTACT_ID);

      expect(result).toEqual(contactWithRelations);
      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CONTACT_ID, tenantId: TENANT_ID } }),
      );
    });

    it('throws NotFoundException for unknown contact', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates contact when quota is available', async () => {
      mockPrisma.contact.create.mockResolvedValue(mockContact);

      const result = await service.create(TENANT_ID, USER_ID, {
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie@example.com',
      });

      expect(result).toEqual(mockContact);
      expect(mockPrisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT_ID, createdById: USER_ID }),
        }),
      );
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('contact'),
        expect.objectContaining({ tenantId: TENANT_ID }),
      );
    });

    it('throws ForbiddenException when contact quota is exceeded', async () => {
      mockTenantsService.checkQuota.mockResolvedValue({ allowed: false, current: 100, limit: 100 });

      await expect(
        service.create(TENANT_ID, USER_ID, { firstName: 'Test', lastName: 'User' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    });

    it('lowercases email on creation', async () => {
      mockPrisma.contact.create.mockResolvedValue(mockContact);

      await service.create(TENANT_ID, USER_ID, { email: 'Marie@EXAMPLE.com' });

      expect(mockPrisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'marie@example.com' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates existing contact', async () => {
      const updated = { ...mockContact, status: ContactStatus.CUSTOMER };
      mockPrisma.contact.findFirst.mockResolvedValue({ ...mockContact, interactions: [], invoices: [] });
      mockPrisma.contact.update.mockResolvedValue(updated);

      const result = await service.update(TENANT_ID, CONTACT_ID, { status: ContactStatus.CUSTOMER });

      expect(mockPrisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTACT_ID },
          data: expect.objectContaining({ status: ContactStatus.CUSTOMER }),
        }),
      );
      expect(result.status).toBe(ContactStatus.CUSTOMER);
    });

    it('throws NotFoundException for non-existent contact', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'bad-id', { status: ContactStatus.CUSTOMER }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addInteraction', () => {
    it('creates interaction and updates lastInteraction on contact', async () => {
      const now = new Date();
      const interaction = { id: 'inter-1', contactId: CONTACT_ID, type: InteractionType.EMAIL, content: 'Test', occurredAt: now, createdById: USER_ID };

      mockPrisma.contact.findFirst.mockResolvedValue({ ...mockContact, interactions: [], invoices: [] });
      mockPrisma.interaction.create.mockResolvedValue(interaction);
      mockPrisma.contact.update.mockResolvedValue(mockContact);

      const result = await service.addInteraction(TENANT_ID, CONTACT_ID, USER_ID, {
        type: InteractionType.EMAIL,
        content: 'Test email content',
      });

      expect(result).toEqual(interaction);
      expect(mockPrisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONTACT_ID },
          data: { lastInteraction: now },
        }),
      );
    });
  });

  describe('getStats', () => {
    it('returns total count and breakdown by status', async () => {
      mockPrisma.contact.count.mockResolvedValue(42);
      mockPrisma.contact.groupBy.mockResolvedValue([
        { status: ContactStatus.CUSTOMER, _count: 30 },
        { status: ContactStatus.LEAD, _count: 12 },
      ]);

      const result = await service.getStats(TENANT_ID);

      expect(result.total).toBe(42);
      expect(result.byStatus).toHaveLength(2);
      expect(result.byStatus[0]).toEqual({ status: ContactStatus.CUSTOMER, count: 30 });
    });
  });
});
