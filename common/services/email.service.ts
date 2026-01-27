import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from './logger';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailServiceClass {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env['SMTP_HOST'] || 'smtp.gmail.com';
    const port = parseInt(process.env['SMTP_PORT'] || '587', 10);
    const secure = process.env['SMTP_SECURE'] === 'true';
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASSWORD'];

    if (!user || !pass) {
      throw new Error('SMTP credentials not configured');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const from = process.env['EMAIL_FROM'] || process.env['SMTP_USER'];
      const transporter = this.getTransporter();

      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logger.info('Email sent successfully', { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      logger.error('Failed to send email', error, { to: options.to });
      return false;
    }
  }

  async sendMagicLink(email: string, token: string): Promise<boolean> {
    const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
    const magicLink = `${appUrl}/verify?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Login to Admin Dashboard</h1>
            <p>Click the button below to sign in to your account. This link will expire in 15 minutes.</p>
            <p style="margin: 30px 0;">
              <a href="${magicLink}" class="button">Sign In</a>
            </p>
            <p>Or copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #666;">${magicLink}</p>
            <div class="footer">
              <p>If you didn't request this email, you can safely ignore it.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Login to Admin Dashboard

      Click the link below to sign in to your account. This link will expire in 15 minutes.

      ${magicLink}

      If you didn't request this email, you can safely ignore it.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Sign in to Admin Dashboard',
      html,
      text,
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', error);
      return false;
    }
  }
}

export const EmailService = new EmailServiceClass();
