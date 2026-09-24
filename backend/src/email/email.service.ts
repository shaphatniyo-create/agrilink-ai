import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Thin wrapper around SMTP delivery. Reads SMTP_HOST/PORT/USER/PASS/FROM from
 * the environment; when they are not set (e.g. no SMTP account configured
 * yet) it falls back to logging the email to the server console instead of
 * silently failing, so "no confirmation email arrives" always has a visible
 * cause (either SMTP isn't configured -- fix by setting those env vars with
 * a real provider like SendGrid/Mailgun/Gmail SMTP -- or the send itself
 * failed, in which case the error is logged too).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from: string;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from = this.config.get<string>('SMTP_FROM') || 'AgriLink AI <no-reply@agrilink.rw>';

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: parseInt(port, 10) === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP_HOST/PORT/USER/PASS are not set -- outgoing email will be logged to the ' +
          'console instead of actually sent. Configure them (see backend/.env.example) to ' +
          'deliver real confirmation/approval emails.',
      );
    }
  }

  async send(to: string, subject: string, html: string, text?: string) {
    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL - not sent, no SMTP configured] To: ${to} | Subject: ${subject}\n${text ?? html}`);
      return { delivered: false, reason: 'SMTP_NOT_CONFIGURED' };
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      return { delivered: true };
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
      return { delivered: false, reason: (err as Error).message };
    }
  }

  sendVerificationEmail(to: string, firstName: string, verifyUrl: string) {
    return this.send(
      to,
      'Confirm your AgriLink AI account',
      `<p>Hello ${firstName},</p><p>Welcome to AgriLink AI. Confirm your email address:</p>
       <p><a href="${verifyUrl}">${verifyUrl}</a></p>
       <p>After confirming, your account still needs approval from an AgriLink administrator before you can sign in.</p>`,
      `Hello ${firstName}, confirm your AgriLink AI account: ${verifyUrl}`,
    );
  }

  sendSetPasswordEmail(to: string, firstName: string, setUrl: string, role?: string) {
    return this.send(
      to,
      'Set your AgriLink AI password',
      `<p>Hello ${firstName},</p>
       <p>Your AgriLink AI ${role ? `${role} ` : ''}account has been approved. Set a password to sign in:</p>
       <p><a href="${setUrl}">${setUrl}</a></p>
       <p>This link expires in 24 hours.</p>`,
      `Hello ${firstName}, set your AgriLink AI password: ${setUrl}`,
    );
  }

  sendApprovalDecisionEmail(to: string, firstName: string, approved: boolean, role?: string) {
    return this.send(
      to,
      approved ? 'Your AgriLink AI account is approved' : 'Your AgriLink AI account request',
      approved
        ? `<p>Hello ${firstName},</p><p>Your AgriLink AI account has been approved${role ? ` as ${role}` : ''}. You can now sign in.</p>`
        : `<p>Hello ${firstName},</p><p>Your AgriLink AI account request was not approved. Contact support if you believe this is a mistake.</p>`,
    );
  }
}
