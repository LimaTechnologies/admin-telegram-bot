import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Session } from '../models/session.model';
import { logger } from './logger';
import type { IUser, IUserPublic, SessionContext } from '$types/index';

const SESSION_EXPIRY_DAYS = parseInt(process.env['SESSION_EXPIRY_DAYS'] || '7', 10);
const BCRYPT_SALT_ROUNDS = 12;
const PASSWORD_LENGTH = 16;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure random password with mixed characters
 */
function generateSecurePassword(length: number = PASSWORD_LENGTH): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I, O for readability
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Excluding i, l, o for readability
  const numbers = '23456789'; // Excluding 0, 1 for readability
  const symbols = '!@#$%&*';

  const allChars = uppercase + lowercase + numbers + symbols;

  // Ensure at least one of each type
  let password = '';
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += symbols[crypto.randomInt(symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password
  const shuffled = password
    .split('')
    .sort(() => crypto.randomInt(3) - 1)
    .join('');
  return shuffled;
}

/**
 * Strip password hash from user object for public consumption
 */
function toPublicUser(user: IUser): IUserPublic {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser as IUserPublic;
}

class AuthServiceClass {
  /**
   * Create a new user with a generated password
   * Returns both the user and the temporary password (shown only once)
   */
  async createUserWithPassword(
    email: string,
    name: string,
    role: 'admin' | 'operator' | 'viewer'
  ): Promise<{ user: IUserPublic; temporaryPassword: string } | null> {
    try {
      const temporaryPassword = generateSecurePassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

      const user = await User.create({
        email: email.toLowerCase(),
        name,
        role,
        passwordHash,
        isActive: true,
      });

      logger.info('User created with password', { userId: user._id.toString(), email });

      return {
        user: toPublicUser(user.toObject()),
        temporaryPassword,
      };
    } catch (error) {
      logger.error('Error creating user with password', error);
      return null;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; sessionToken?: string; user?: IUserPublic; message?: string }> {
    try {
      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase(), isActive: true });

      if (!user) {
        // Use generic message to prevent user enumeration
        logger.warn('Login attempt for non-existent or inactive user', { email });
        return { success: false, message: 'Invalid email or password' };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        logger.warn('Failed login attempt - invalid password', { email });
        return { success: false, message: 'Invalid email or password' };
      }

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
      return { success: true, sessionToken, user: toPublicUser(user.toObject()) };
    } catch (error) {
      logger.error('Error during login', error);
      return { success: false, message: 'An error occurred' };
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!isPasswordValid) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Hash and save new password
      user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      await user.save();

      logger.info('Password changed', { userId });
      return { success: true };
    } catch (error) {
      logger.error('Error changing password', error);
      return { success: false, message: 'An error occurred' };
    }
  }

  /**
   * Reset user password (admin action) - returns new temporary password
   */
  async resetPassword(
    userId: string
  ): Promise<{ success: boolean; temporaryPassword?: string; message?: string }> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const temporaryPassword = generateSecurePassword();
      user.passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);
      await user.save();

      // Invalidate all existing sessions for this user
      await Session.deleteMany({ userId });

      logger.info('Password reset by admin', { userId });
      return { success: true, temporaryPassword };
    } catch (error) {
      logger.error('Error resetting password', error);
      return { success: false, message: 'An error occurred' };
    }
  }

  /**
   * Hash a password (used by user router when creating users)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  /**
   * Generate a secure random password
   */
  generatePassword(): string {
    return generateSecurePassword();
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
}

export const AuthService = new AuthServiceClass();
