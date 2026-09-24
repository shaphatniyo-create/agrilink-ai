import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, VerifyEmailDto, SetPasswordDto } from './dto/auth.dto';
import { Public } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('set-password')
  setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPassword(dto.token, dto.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }

  /**
   * Kicks off the Google OAuth2 redirect dance. Only reachable when
   * GoogleStrategy was registered (see auth.module.ts) -- i.e. when
   * GOOGLE_CLIENT_ID/SECRET are configured. If they are not, this route
   * still exists but Passport will throw ("Unknown authentication strategy
   * google") since no strategy named 'google' was registered; the frontend
   * should hide the "Continue with Google" button in that case (it can
   * check GET /auth/google/status, see below, or just rely on the backend
   * returning a clear error).
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google's consent screen; nothing to do here.
  }

  /**
   * Google redirects back here after the user consents. We finish the
   * find-or-create dance in AuthService, then hand control back to the
   * frontend via an HTTP redirect carrying either the issued tokens or a
   * "pending approval" flag as query params -- never as a page the browser
   * can be tricked into rendering with tokens embedded in HTML, and never
   * landing the user on any dashboard until the frontend has stored the
   * tokens and re-fetched /users/me to pick the right one (see
   * requirement: strict per-role dashboard redirect after auth).
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const result = await this.authService.loginOrRegisterWithGoogle(req.user);
    if (result.pending) {
      const reason = encodeURIComponent(result.reason || 'Your account is awaiting approval.');
      return res.redirect(`${frontendUrl}/auth/google/callback?pending=true&reason=${reason}`);
    }
    const { accessToken, refreshToken } = result as { accessToken: string; refreshToken: string; pending: boolean };
    return res.redirect(
      `${frontendUrl}/auth/google/callback?access=${accessToken}&refresh=${refreshToken}`,
    );
  }

  /** Lets the frontend know whether to show the "Continue with Google" button at all. */
  @Public()
  @Get('google/status')
  googleStatus() {
    return { enabled: Boolean(this.config.get<string>('GOOGLE_CLIENT_ID') && this.config.get<string>('GOOGLE_CLIENT_SECRET')) };
  }
}
