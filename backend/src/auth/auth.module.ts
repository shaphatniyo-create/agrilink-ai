import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';

// GoogleStrategy is only registered when real OAuth credentials are present
// in the environment. Without this guard, Passport would throw at startup
// trying to construct a strategy with an undefined clientID/clientSecret.
// This lets the app boot cleanly with Google Sign-In simply disabled
// (AuthController#googleStatus reports this to the frontend) until the
// operator supplies GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (see .env.example).
const googleProviders = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [GoogleStrategy] : [];

@Module({
  imports: [PassportModule, JwtModule.register({}), AuditModule, EmailModule],
  providers: [AuthService, JwtStrategy, ...googleProviders],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
