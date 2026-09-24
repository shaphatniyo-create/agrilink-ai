import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

/**
 * Only registered (see auth.module.ts) when GOOGLE_CLIENT_ID/SECRET are
 * configured, so the app boots cleanly without Google Sign-In enabled.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${config.get<string>('BACKEND_URL')}/api/v1/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): void {
    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      // Lowercased so it matches whatever a password-registered account of
      // the same mailbox stored -- Google's own emails are already
      // lowercase in practice, but normalizing here too costs nothing and
      // means this is never the place a case mismatch sneaks back in.
      email: profile.emails?.[0]?.value?.toLowerCase().trim(),
      firstName: profile.name?.givenName || profile.displayName || 'Google',
      lastName: profile.name?.familyName || 'User',
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, payload);
  }
}
