import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { GoogleProfilePayload } from './strategies/google.strategy';

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private email: EmailService,
  ) {}

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '30d',
      },
    );
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash } });
    return { accessToken, refreshToken };
  }

  /** Shared token-issuance helper backing both email verification and admin password-set links. */
  private async issueEmailToken(userId: string, purpose: 'VERIFY_EMAIL' | 'PASSWORD_RESET'): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        purpose,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    return raw;
  }

  private async issueVerificationEmail(userId: string, email: string, firstName: string) {
    const raw = await this.issueEmailToken(userId, 'VERIFY_EMAIL');
    const verifyUrl = `${this.config.get<string>('FRONTEND_URL')}/verify-email?token=${raw}`;
    const result = await this.email.sendVerificationEmail(email, firstName, verifyUrl);
    if (!result.delivered) {
      // Not fatal -- the account still exists and can be approved manually --
      // but surfaced so an admin can see delivery is misconfigured/failing.
      await this.audit.log(userId, 'VERIFICATION_EMAIL_NOT_DELIVERED', 'User', userId, { reason: result.reason });
    }
    return result;
  }

  /**
   * Used by AdminService once a Super Admin/Helper Admin account (or an
   * admin-approved registration with no password yet) is activated -- the
   * appointee never has a password chosen for them; they set their own via
   * this emailed link, which doubles as proof they control the mailbox.
   */
  async issuePasswordSetEmail(userId: string, email: string, firstName: string, role?: string) {
    const raw = await this.issueEmailToken(userId, 'PASSWORD_RESET');
    const setUrl = `${this.config.get<string>('FRONTEND_URL')}/set-password?token=${raw}`;
    const result = await this.email.sendSetPasswordEmail(email, firstName, setUrl, role);
    if (!result.delivered) {
      await this.audit.log(userId, 'SET_PASSWORD_EMAIL_NOT_DELIVERED', 'User', userId, { reason: result.reason });
    }
    return result;
  }

  /** Completes the set-your-password flow for admin-created accounts (and doubles as a generic password reset). */
  async setPassword(rawToken: string, newPassword: string) {
    const token = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash: hashToken(rawToken), purpose: 'PASSWORD_RESET', usedAt: null, expiresAt: { gte: new Date() } },
    });
    if (!token) throw new BadRequestException('This link is invalid or has expired. Ask an administrator to resend it.');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash, emailVerifiedAt: { set: new Date() } },
      }),
    ]);
    await this.audit.log(token.userId, 'PASSWORD_SET', 'User', token.userId);
    return { success: true };
  }

  /**
   * Self-service registration. The account is created PENDING and stays that
   * way -- unusable for login -- until a Super Admin or Helper Admin approves
   * the accompanying USER_REGISTRATION ApprovalRequest (see AdminService).
   * This is the "no one can use it without approval" rule, enforced here at
   * creation time and again at every login attempt.
   */
  async register(dto: RegisterDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Provide a phone number and/or an email address.');
    }
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [...(dto.phone ? [{ phone: dto.phone }] : []), ...(dto.email ? [{ email: dto.email }] : [])],
      },
    });
    if (existing) throw new ConflictException('Phone or email already registered.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredLanguage: dto.preferredLanguage ?? 'en',
        status: 'PENDING',
      },
    });

    await this.prisma.approvalRequest.create({
      data: {
        type: 'USER_REGISTRATION',
        targetUserId: user.id,
        proposedRole: dto.requestedRole,
        proposedGeoAreaId: dto.requestedGeoAreaId,
        requestedById: user.id, // self-requested
      },
    });

    if (dto.email) await this.issueVerificationEmail(user.id, dto.email, user.firstName);
    await this.audit.log(user.id, 'USER_REGISTERED', 'User', user.id, { requestedRole: dto.requestedRole });

    return {
      id: user.id,
      status: user.status,
      message:
        'Account created. ' +
        (dto.email ? 'Check your email to confirm your address, and ' : '') +
        'an AgriLink administrator must approve your account before you can sign in.',
    };
  }

  async verifyEmail(rawToken: string) {
    const token = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash: hashToken(rawToken), purpose: 'VERIFY_EMAIL', usedAt: null, expiresAt: { gte: new Date() } },
    });
    if (!token) throw new BadRequestException('This verification link is invalid or has expired.');
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    return { success: true };
  }

  private loginBlockedMessage(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'Your account is awaiting approval from an AgriLink administrator.';
      case 'REJECTED':
        return 'Your account request was not approved. Contact AgriLink support.';
      case 'SUSPENDED':
        return 'Your account has been suspended. Contact AgriLink support.';
      case 'DEACTIVATED':
        return 'Your account has been deactivated. Contact AgriLink support.';
      default:
        return 'Your account is not active.';
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.identifier }, { email: dto.identifier }] },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials.');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials.');
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(this.loginBlockedMessage(user.status));
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(user.id, 'LOGIN', 'User', user.id);
    const tokens = await this.issueTokens(user.id);
    return { ...tokens, userId: user.id };
  }

  /**
   * Google Sign-In: finds-or-creates a User from the verified Google profile.
   * A brand-new Google sign-up is created PENDING with its own
   * USER_REGISTRATION approval request -- exactly the same gate as password
   * registration, so "no one can use it without Super Admin approval" holds
   * regardless of how they signed up. Google already verifies the email, so
   * emailVerifiedAt is stamped immediately (no confirmation email needed).
   */
  async loginOrRegisterWithGoogle(profile: GoogleProfilePayload) {
    // Normalized again here (GoogleStrategy already lowercases it) so this
    // method is correct even if it's ever called with an un-normalized
    // payload -- the email <-> account matching this whole function does
    // must not depend on remembering to normalize upstream.
    const email = profile.email ? profile.email.toLowerCase().trim() : profile.email;
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user && email) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId: profile.googleId, emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date() },
        });
      }
    }

    let isNew = false;
    if (!user) {
      isNew = true;
      user = await this.prisma.user.create({
        data: {
          email,
          googleId: profile.googleId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          status: 'PENDING',
          emailVerifiedAt: new Date(),
        },
      });
      await this.prisma.approvalRequest.create({
        data: {
          type: 'USER_REGISTRATION',
          targetUserId: user.id,
          requestedById: user.id,
          // proposedRole intentionally left null -- Google sign-up doesn't
          // capture a role, so the approving admin assigns one.
        },
      });
      await this.audit.log(user.id, 'USER_REGISTERED_VIA_GOOGLE', 'User', user.id);
    }

    if (user.status !== 'ACTIVE') {
      return { pending: true, reason: this.loginBlockedMessage(user.status), isNew };
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(user.id, 'LOGIN_VIA_GOOGLE', 'User', user.id);
    const tokens = await this.issueTokens(user.id);
    return { pending: false, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.refreshTokenHash) throw new UnauthorizedException('Session expired.');
    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Session expired.');
    return this.issueTokens(user.id);
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { success: true };
  }
}
