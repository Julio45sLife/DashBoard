import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantPlan, TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
  verify: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
  get: jest.fn().mockReturnValue('15m'),
};

const mockEmitter = { emit: jest.fn() };

const mockTenant = {
  id: 'tenant-1',
  slug: 'acme',
  name: 'ACME Corp',
  plan: TenantPlan.FREE,
  status: TenantStatus.TRIAL,
  trialEndsAt: new Date(),
};

const mockUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'admin@acme.com',
  passwordHash: '$2b$12$hashed',
  firstName: 'Jean',
  lastName: 'Dupont',
  role: UserRole.TENANT_ADMIN,
  isActive: true,
  emailVerified: false,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwt.signAsync.mockResolvedValue('mock-token');
    mockConfig.getOrThrow.mockReturnValue('test-secret');
    mockConfig.get.mockReturnValue('15m');
  });

  describe('register', () => {
    it('creates tenant and user on first registration', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn(mockPrisma),
      );
      mockPrisma.tenant.create.mockResolvedValue(mockTenant);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        tenantSlug: 'acme',
        tenantName: 'ACME Corp',
        email: 'admin@acme.com',
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Dupont',
      });

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { slug: 'acme' } });
      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.tokens.refreshToken).toBe('mock-token');
      expect(result.user.email).toBe('admin@acme.com');
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        expect.stringContaining('user'),
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });

    it('throws ConflictException when slug is taken', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(
        service.register({
          tenantSlug: 'acme',
          tenantName: 'Other',
          email: 'other@test.com',
          password: 'SecurePass123!',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens and user on valid credentials', async () => {
      const hash = await bcrypt.hash('SecurePass123!', 10);
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
        tenant: { id: mockTenant.id, slug: mockTenant.slug, status: mockTenant.status, plan: mockTenant.plan },
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login({ email: 'admin@acme.com', password: 'SecurePass123!' });

      expect(result.tokens.accessToken).toBe('mock-token');
      expect(result.user).toMatchObject({ email: 'admin@acme.com' });
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPass123!', 10);
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash, tenant: mockTenant });

      await expect(
        service.login({ email: 'admin@acme.com', password: 'WrongPass123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@acme.com', password: 'SomePass123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is deactivated', async () => {
      const hash = await bcrypt.hash('SecurePass123!', 10);
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash, isActive: false, tenant: mockTenant });

      await expect(
        service.login({ email: 'admin@acme.com', password: 'SecurePass123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('issues new tokens for valid refresh token', async () => {
      const payload = { sub: 'user-1', tenantId: 'tenant-1', email: 'admin@acme.com', role: UserRole.TENANT_ADMIN };
      mockJwt.verify.mockReturnValue(payload);
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('throws UnauthorizedException on invalid token', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user no longer active', async () => {
      const payload = { sub: 'user-1', tenantId: 'tenant-1', email: 'admin@acme.com', role: UserRole.TENANT_ADMIN };
      mockJwt.verify.mockReturnValue(payload);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.refreshTokens('orphan-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('silently succeeds even for unknown email (no user enumeration)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.forgotPassword('unknown@test.com')).resolves.toBeUndefined();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('stores reset token for known user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.forgotPassword('admin@acme.com');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordResetToken: expect.any(String) }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException for expired/invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const { BadRequestException } = await import('@nestjs/common');
      await expect(
        service.resetPassword({ token: 'bad-token', password: 'NewPass123!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password hash for valid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.resetPassword({ token: 'valid-token', password: 'NewPass123!' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: null,
            passwordResetExpiresAt: null,
          }),
        }),
      );
    });
  });
});
