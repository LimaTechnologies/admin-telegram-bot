import crypto from 'crypto';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { MagicLink } from '../models/magic-link.model';
import { EmailService } from './email.service';
import { logger } from './logger';
import type { IUser, SessionContext } from '$types/index';

const SESSION_EXPIRY_DAYS = parseInt(process.env['SESSION_EXPIRY_DAYS'] || '7', 10);
const MAGIC_LINK_EXPIRY_MINUTES = parseInt(process.env['MAGIC_LINK_EXPIRY_MINUTES'] || '15', 10);

// Development bypass email - auto-authenticates without magic link
const DEV_BYPASS_EMAIL = 'joaovitor_rlima@hotmail.com';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

class AuthServiceClass {
  async sendMagicLink(email: string, baseUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user exists
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        // Return success even if user doesn't exist to prevent enumeration
        logger.warn('Magic link requested for non-existent user', { email });
        return { success: true, message: 'If an account exists, you will receive an email' };
      }

      // Delete any existing magic links for this email
      await MagicLink.deleteMany({ email });

      // Generate new token
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

      // Save magic link
      await MagicLink.create({
        email,
        tokenHash,
        expiresAt,
      });

      // Send email
      const sent = await EmailService.sendMagicLink(email, token, baseUrl);
      if (!sent) {
        logger.error('Failed to send magic link email', undefined, { email });
        return { success: false, message: 'Failed to send email' };
      }

      logger.info('Magic link sent', { email });
      return { success: true, message: 'If an account exists, you will receive an email' };
    } catch (error) {
      logger.error('Error sending magic link', error);
      return { success: false, message: 'An error occurred' };
    }
  }

  /**
   * Check if email is eligible for dev bypass (direct login without magic link)
   */
  isDevBypassEmail(email: string): boolean {
    return email.toLowerCase() === DEV_BYPASS_EMAIL.toLowerCase();
  }

  /**
   * Direct login for development - bypasses magic link for specific email
   * Creates admin user if not exists, then creates session
   */
  async devLogin(
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; sessionToken?: string; user?: IUser; message?: string }> {
    try {
      // Only allow for the specific dev email
      if (!this.isDevBypassEmail(email)) {
        return { success: false, message: 'Dev login not allowed for this email' };
      }

      // Find or create the admin user
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Create admin user if it doesn't exist
        user = await User.create({
          email: email.toLowerCase(),
          name: 'Admin',
          role: 'admin',
          isActive: true,
        });
        logger.info('Dev admin user created', { email });
      }

      if (!user.isActive) {
        return { success: false, message: 'User is inactive' };
      }

      // Create session directly
      const sessionToken = generateToken();
      const sessionTokenHash = hashToken(sessionToken);
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await Session.create({
        userId: user._id,
        tokenHash: sessionTokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      });

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      logger.info('Dev login successful', { userId: user._id.toString(), email: user.email });
      return { success: true, sessionToken, user: user.toObject() };
    } catch (error) {
      logger.error('Error in dev login', error);
      return { success: false, message: 'An error occurred' };
    }
  }

  async verifyMagicLink(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; sessionToken?: string; user?: IUser; message?: string }> {
    try {
      const tokenHash = hashToken(token);

      // Find magic link
      const magicLink = await MagicLink.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
        usedAt: null,
      });

      if (!magicLink) {
        logger.warn('Invalid or expired magic link used');
        return { success: false, message: 'Invalid or expired link' };
      }

      // Find user
      const user = await User.findOne({ email: magicLink.email, isActive: true });
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Mark magic link as used
      magicLink.usedAt = new Date();
      await magicLink.save();

      // Create session
      const sessionToken = generateToken();
      const sessionTokenHash = hashToken(sessionToken);
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await Session.create({
        userId: user._id,
        tokenHash: sessionTokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      });

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      logger.info('User logged in', { userId: user._id.toString(), email: user.email });
      return { success: true, sessionToken, user: user.toObject() };
    } catch (error) {
      logger.error('Error verifying magic link', error);
      return { success: false, message: 'An error occurred' };
    }
  }

  async validateSession(sessionToken: string): Promise<SessionContext | null> {
    try {
      const tokenHash = hashToken(sessionToken);

      const session = await Session.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() },
      }).populate<{ userId: IUser }>('userId');

      if (!session || !session.userId) {
        return null;
      }

      const user = session.userId as IUser;
      if (!user.isActive) {
        return null;
      }

      return {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        sessionId: session._id.toString(),
      };
    } catch (error) {
      logger.error('Error validating session', error);
      return null;
    }
  }

  async logout(sessionToken: string): Promise<boolean> {
    try {
      const tokenHash = hashToken(sessionToken);
      const result = await Session.deleteOne({ tokenHash });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Error logging out', error);
      return false;
    }
  }

  async logoutAllSessions(userId: string): Promise<boolean> {
    try {
      await Session.deleteMany({ userId });
      logger.info('All sessions logged out', { userId });
      return true;
    } catch (error) {
      logger.error('Error logging out all sessions', error);
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await Session.deleteMany({
        expiresAt: { $lt: new Date() },
      });
      logger.info('Cleaned up expired sessions', { count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up sessions', error);
      return 0;
    }
  }

  async cleanupExpiredMagicLinks(): Promise<number> {
    try {
      const result = await MagicLink.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { usedAt: { $ne: null } },
        ],
      });
      logger.info('Cleaned up expired magic links', { count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up magic links', error);
      return 0;
    }
  }
}

export const AuthService = new AuthServiceClass();
