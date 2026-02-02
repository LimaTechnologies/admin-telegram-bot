import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { AuthService, AuditService, User } from '@common';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const authRouter = router({
  // Login with email and password
  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const result = await AuthService.login(
      input.email,
      input.password,
      ctx.req.ip,
      ctx.req.userAgent
    );

    if (!result.success || !result.sessionToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: result.message || 'Invalid credentials',
      });
    }

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('session', result.sessionToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Log login
    if (result.user) {
      await AuditService.logLogin(result.user._id.toString(), {
        route: 'auth.login',
        success: true,
        duration: 0,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.userAgent,
      });
    }

    return {
      success: true,
      user: result.user,
    };
  }),

  // Change password (for logged in users)
  changePassword: protectedProcedure.input(changePasswordSchema).mutation(async ({ input, ctx }) => {
    const result = await AuthService.changePassword(
      ctx.session.userId,
      input.currentPassword,
      input.newPassword
    );

    if (!result.success) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: result.message || 'Failed to change password',
      });
    }

    return { success: true };
  }),

  // Get current session
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) {
      return null;
    }

    const user = await User.findById(ctx.session.userId).select('-__v -passwordHash');
    return user ? user.toObject() : null;
  }),

  // Logout
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (sessionToken) {
      await AuthService.logout(sessionToken);

      // Log logout
      await AuditService.logLogout(ctx.session.userId, {
        route: 'auth.logout',
        success: true,
        duration: 0,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.userAgent,
      });
    }

    // Clear cookie
    cookieStore.delete('session');

    return { success: true };
  }),

  // Logout all sessions
  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    await AuthService.logoutAllSessions(ctx.session.userId);

    // Clear current cookie
    const cookieStore = await cookies();
    cookieStore.delete('session');

    return { success: true };
  }),
});
