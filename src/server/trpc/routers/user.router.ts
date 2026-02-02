import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { User, AuthService } from '@common';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'operator', 'viewer']).default('viewer'),
});

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

export const userRouter = router({
  // List users (admin only)
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        role: z.enum(['admin', 'operator', 'viewer']).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, role, isActive } = input;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['$or'] = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }
      if (role) filter['role'] = role;
      if (isActive !== undefined) filter['isActive'] = isActive;

      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-__v -passwordHash'),
        User.countDocuments(filter),
      ]);

      return {
        data: users.map((u) => u.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single user
  getById: adminProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const user = await User.findById(input.id).select('-__v -passwordHash');
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }
    return user.toObject();
  }),

  // Create user (admin only) - generates random password
  create: adminProcedure
    .input(createUserSchema)
    .use(
      withAudit({
        action: 'user.create',
        entityType: 'user',
        getAfter: (_, result) =>
          (result as { user: unknown; temporaryPassword: string }).user,
      })
    )
    .mutation(async ({ input }) => {
      // Check if email already exists
      const existing = await User.findOne({ email: input.email.toLowerCase() });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already exists' });
      }

      // Create user with generated password
      const result = await AuthService.createUserWithPassword(input.email, input.name, input.role);

      if (!result) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
      }

      // Return user AND the temporary password (only time it's shown)
      return {
        user: result.user,
        temporaryPassword: result.temporaryPassword,
      };
    }),

  // Reset user password (admin only) - generates new random password
  resetPassword: adminProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'user.resetPassword',
        entityType: 'user',
        getEntityId: (input) => (input as { id: string }).id,
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Prevent resetting own password this way
      if (input.id === ctx.session.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use change password for your own account',
        });
      }

      const result = await AuthService.resetPassword(input.id);

      if (!result.success || !result.temporaryPassword) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.message || 'User not found',
        });
      }

      return {
        success: true,
        temporaryPassword: result.temporaryPassword,
      };
    }),

  // Update user (admin only)
  update: adminProcedure
    .input(updateUserSchema)
    .use(
      withAudit({
        action: 'user.update',
        entityType: 'user',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const user = await User.findById((input as { id: string }).id);
          return user;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const user = await User.findByIdAndUpdate(id, data, { new: true }).select(
        '-__v -passwordHash'
      );
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return user.toObject();
    }),

  // Delete user (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'user.delete',
        entityType: 'user',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const user = await User.findById((input as { id: string }).id);
          return user;
        },
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Prevent self-deletion
      if (input.id === ctx.session.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete your own account' });
      }

      const result = await User.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return { success: true };
    }),

  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await User.findById(ctx.session.userId).select('-__v -passwordHash');
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }
    return user.toObject();
  }),

  // Update current user profile
  updateMe: protectedProcedure
    .input(z.object({ name: z.string().min(2).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const user = await User.findByIdAndUpdate(
        ctx.session.userId,
        { name: input.name },
        { new: true }
      ).select('-__v -passwordHash');

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return user.toObject();
    }),
});
