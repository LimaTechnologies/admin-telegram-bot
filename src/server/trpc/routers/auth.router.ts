import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { AuthService, AuditService, User } from '@common';

export const authRouter = router({
  // Send magic link
  sendMagicLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const result = await AuthService.sendMagicLink(input.email);
      return result;
    }),

  // Verify magic link and create session
  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const result = await AuthService.verifyMagicLink(
        input.token,
        ctx.req.ip,
        ctx.req.userAgent
      );

      if (!result.success || !result.sessionToken) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.message || 'Invalid or expired link',
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
          route: 'auth.verifyMagicLink',
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

  // Get current session
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) {
      return null;
    }

    const user = await User.findById(ctx.session.userId).select('-__v');
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
