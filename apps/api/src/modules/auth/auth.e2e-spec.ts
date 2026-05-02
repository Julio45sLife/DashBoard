/**
 * Auth E2E — tests the full HTTP layer with a mocked PrismaService.
 * No real DB required; all persistence is intercepted via jest mocks.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPlan, TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthModule } from './auth.module';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';

// ── Shared fixtures ───────────────────────────────────────────────────────────
const TENANT_ID = 'e2e-tenant-1';
const USER_ID = 'e2e-user-1';

const makeTenant = () => ({
  id: TENANT_ID,
  slug: 'e2e-corp',
  name: 'E2E Corp',
  plan: TenantPlan.FREE,
  status: TenantStatus.TRIAL,
  trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  nextInvoiceSeq: 1,
  nextQuoteSeq: 1,
  defaultCurrency: 'EUR',
  defaultTaxRate: 20,
  invoicePrefix: 'FAC',
  quotePrefix: 'DEV',
  timezone: 'Europe/Paris',
  country: 'FR',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeUser = (passwordHash: string) => ({
  id: USER_ID,
  tenantId: TENANT_ID,
  email: 'admin@e2e-corp.com',
  passwordHash,
  firstName: 'Alice',
  lastName: 'Test',
  role: UserRole.TENANT_ADMIN,
  isActive: true,
  emailVerified: false,
  googleId: null,
  avatarUrl: null,
  passwordResetToken: null,
  passwordResetExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ── Mock Prisma ───────────────────────────────────────────────────────────────
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

// ── App factory ───────────────────────────────────────────────────────────────
async function buildApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AuthModule],
    providers: [
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: (key: string) => {
            const cfg: Record<string, string> = {
              'jwt.accessSecret': 'e2e-access-secret',
              'jwt.refreshSecret': 'e2e-refresh-secret',
            };
            return cfg[key] ?? 'default';
          },
          get: (key: string, def: unknown) => {
            const cfg: Record<string, unknown> = {
              'jwt.accessExpiresIn': '15m',
              'jwt.refreshExpiresIn': '7d',
              'google.clientId': '',
              'google.clientSecret': '',
              'google.callbackUrl': '',
            };
            return cfg[key] ?? def;
          },
        },
      },
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/v1/auth/register ─────────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    const payload = {
      tenantSlug: 'e2e-corp',
      tenantName: 'E2E Corp',
      email: 'admin@e2e-corp.com',
      password: 'SecurePass123!',
      firstName: 'Alice',
      lastName: 'Test',
    };

    it('201 — creates tenant and returns access+refresh tokens', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
        fn(mockPrisma),
      );
      mockPrisma.tenant.create.mockResolvedValue(makeTenant());
      mockPrisma.user.create.mockResolvedValue(makeUser('$hashed'));

      const { status, body } = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload);

      expect(status).toBe(201);
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
      expect(body.data.user.email).toBe('admin@e2e-corp.com');
    });

    it('409 — returns conflict when slug is already taken', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant());

      const { status, body } = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload);

      expect(status).toBe(409);
      expect(body.error).toBeDefined();
    });

    it('400 — rejects invalid email format', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...payload, email: 'not-an-email' });

      expect(status).toBe(400);
    });

    it('400 — rejects weak password (no special char)', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...payload, password: 'weakpassword123' });

      expect(status).toBe(400);
    });
  });

  // ── POST /api/v1/auth/login ────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('200 — returns tokens with correct credentials', async () => {
      const hash = await bcrypt.hash('SecurePass123!', 10);
      mockPrisma.user.findFirst.mockResolvedValue(makeUser(hash));

      const { status, body } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@e2e-corp.com', password: 'SecurePass123!' });

      expect(status).toBe(200);
      expect(body.data.tokens.accessToken).toBeDefined();
    });

    it('401 — returns error with wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPass123!', 10);
      mockPrisma.user.findFirst.mockResolvedValue(makeUser(hash));

      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@e2e-corp.com', password: 'WrongPass123!' });

      expect(status).toBe(401);
    });

    it('401 — returns error for non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@e2e-corp.com', password: 'SecurePass123!' });

      expect(status).toBe(401);
    });

    it('400 — rejects missing fields', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@e2e-corp.com' });

      expect(status).toBe(400);
    });
  });

  // ── POST /api/v1/auth/refresh ──────────────────────────────────────────────
  describe('POST /api/v1/auth/refresh', () => {
    it('200 — returns new tokens for valid refresh token', async () => {
      // Issue a real refresh token so verify() works
      const jwtService = new JwtService();
      const payload = { sub: USER_ID, tenantId: TENANT_ID, email: 'admin@e2e-corp.com', role: UserRole.TENANT_ADMIN };
      const refreshToken = await jwtService.signAsync(payload, { secret: 'e2e-refresh-secret', expiresIn: '7d' });

      mockPrisma.user.findFirst.mockResolvedValue(makeUser('$hashed'));

      const { status, body } = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(status).toBe(200);
      expect(body.data.accessToken).toBeDefined();
    });

    it('401 — rejects tampered refresh token', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'eyJhbGciOiJIUzI1NiJ9.tampered.signature' });

      expect(status).toBe(401);
    });
  });

  // ── POST /api/v1/auth/forgot-password ─────────────────────────────────────
  describe('POST /api/v1/auth/forgot-password', () => {
    it('200 — always succeeds regardless of email existence (anti-enumeration)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const { status } = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unknown@test.com' });

      expect(status).toBe(200);
    });
  });
});
