import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Prisma, TenantPlan, TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { addHours } from 'date-fns';
import { PrismaService } from '../../database/prisma.service';
import { EVENTS, UserRegisteredEvent } from '../../events/domain-events';
import { JwtPayload } from '../../common/decorators/user.decorator';
import { GoogleProfile } from './strategies/google.strategy';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly REFRESH_TOKEN_BYTES = 64;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: { id: string; email: string }; tokens: TokenPair }> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (existing) {
      throw new ConflictException(`Tenant slug "${dto.tenantSlug}" is already taken`);
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: dto.tenantSlug,
          name: dto.tenantName,
          plan: TenantPlan.FREE,
          status: TenantStatus.TRIAL,
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.TENANT_ADMIN,
          emailVerified: false,
        },
      });

      return { tenant, user };
    });

    this.eventEmitter.emit(EVENTS.USER_REGISTERED, {
      tenantId: result.tenant.id,
      userId: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
    } satisfies UserRegisteredEvent);

    const tokens = await this.issueTokens(result.user.id, result.tenant.id, result.user.email, result.user.role);

    return {
      user: { id: result.user.id, email: result.user.email },
      tokens,
    };
  }

  async login(dto: LoginDto, ip?: string): Promise<{ user: object; tokens: TokenPair }> {
    const whereClause: Prisma.UserWhereInput = { email: dto.email.toLowerCase() };
    if (dto.tenantSlug) {
      whereClause.tenant = { slug: dto.tenantSlug };
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: { tenant: { select: { id: true, slug: true, status: true, plan: true } } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account deactivated');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const tokens = await this.issueTokens(user.id, user.tenantId, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenant: { id: user.tenant.id, slug: user.tenant.slug, plan: user.tenant.plan },
      },
      tokens,
    };
  }

  async loginWithGoogle(profile: GoogleProfile, tenantSlug?: string): Promise<{ user: object; tokens: TokenPair }> {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      // Try to match by email within tenant
      const whereClause: Prisma.UserWhereInput = { email: profile.email.toLowerCase() };
      if (tenantSlug) whereClause.tenant = { slug: tenantSlug };
      user = await this.prisma.user.findFirst({ where: whereClause });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl, emailVerified: true },
        });
      } else {
        throw new NotFoundException('No account found. Please register first or contact your administrator.');
      }
    }

    if (!user.isActive) throw new UnauthorizedException('Account deactivated');

    const tokens = await this.issueTokens(user.id, user.tenantId, user.email, user.role);

    return {
      user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
      tokens,
    };
  }

  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, isActive: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens(user.id, user.tenantId, user.email, user.role);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (!user) return; // Silent — don't reveal user existence

    const token = randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), 2);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    });

    // TODO: send email via MailService (queue job)
    this.logger.log(`Password reset token for ${email}: ${token}`);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }

  private async issueTokens(
    userId: string,
    tenantId: string,
    email: string,
    role: UserRole,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, tenantId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
