import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

/** Emails are matched case-insensitively everywhere in this app (login,
 * duplicate checks, Google account linking) -- normalizing to lowercase
 * right here, at the one place every password-based email enters the
 * system, means every downstream `where: { email }` lookup just works
 * without each call site having to remember to normalize itself. */
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Roles a person may request for themselves at self-service sign-up. Every
 * admin-level and geo-leader role is deliberately excluded -- those are only
 * ever granted by a Super Admin (see backend/src/admin). */
export const SELF_SERVICE_ROLES: UserRole[] = [
  'FARMER',
  'COOPERATIVE',
  'BUYER',
  'SUPPLIER',
  'TRANSPORTER',
  'AGRICULTURAL_EXPERT',
  'MARKETING_PARTNER',
  'B2B_CLIENT',
];

export class RegisterDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsIn(SELF_SERVICE_ROLES)
  requestedRole: UserRole;

  @IsOptional()
  @IsString()
  requestedGeoAreaId?: string;

  @IsIn(['en', 'fr', 'rw'])
  @IsOptional()
  preferredLanguage?: string;
}

export class LoginDto {
  /** Phone number OR email address -- lowercased/trimmed the same way a
   * registered email is, so "John@Example.com" at sign-up still logs in
   * with "john@example.com" at sign-in. Harmless no-op for a phone number. */
  @IsString()
  @Transform(normalizeEmail)
  identifier: string;

  @IsString()
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class VerifyEmailDto {
  @IsString()
  token: string;
}

export class SetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}
