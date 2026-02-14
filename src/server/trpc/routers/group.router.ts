import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { TelegramGroup, botTasksQueue } from '@common';
import type { BotTaskJob } from '$types/telegram-group';

const groupSettingsSchema = z.object({
  maxAdsPerDay: z.number().min(1).max(100).optional(),
  cooldownMinutes: z.number().min(1).max(1440).optional(),
  allowedAdTypes: z.enum(['onlyfans', 'casino', 'both']).optional(),
  isActive: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
});

const createGroupSchema = z.object({
  telegramId: z.string(),
  name: z.string().min(1),
  username: z.string().optional(),
  type: z.enum(['public', 'private', 'supergroup', 'channel']).default('supergroup'),
});

const updateGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  settings: groupSettingsSchema.optional(),
});

export const groupRouter = router({
  // List groups
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
        type: z.enum(['public', 'private', 'supergroup', 'channel']).optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, isActive, type } = input;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['$or'] = [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ];
      }
      if (isActive !== undefined) filter['settings.isActive'] = isActive;
      if (type) filter['type'] = type;

      const [groups, total] = await Promise.all([
        TelegramGroup.find(filter)
          .sort({ 'stats.memberCount': -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-__v'),
        TelegramGroup.countDocuments(filter),
      ]);

      return {
        data: groups.map((g) => g.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single group
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const group = await TelegramGroup.findById(input.id).select('-__v');
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }
      return group.toObject();
    }),

  // Get all active groups (for selection)
  getActive: protectedProcedure.query(async () => {
    const groups = await TelegramGroup.find({ 'settings.isActive': true })
      .sort({ name: 1 })
      .select('_id name username type stats.memberCount');
    return groups.map((g) => g.toObject());
  }),

  // Create group (operator+)
  create: operatorProcedure
    .input(createGroupSchema)
    .use(
      withAudit({
        action: 'group.create',
        entityType: 'group',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      // Check if telegramId already exists
      const existing = await TelegramGroup.findOne({ telegramId: input.telegramId });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Group already exists' });
      }

      const group = await TelegramGroup.create(input);
      return group.toObject();
    }),

  // Update group (operator+)
  update: operatorProcedure
    .input(updateGroupSchema)
    .use(
      withAudit({
        action: 'group.update',
        entityType: 'group',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const group = await TelegramGroup.findById((input as { id: string }).id);
          return group;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, settings, ...data } = input;

      const updateData: Record<string, unknown> = { ...data };
      if (settings) {
        Object.entries(settings).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[`settings.${key}`] = value;
          }
        });
      }

      const group = await TelegramGroup.findByIdAndUpdate(id, updateData, { new: true }).select('-__v');
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      return group.toObject();
    }),

  // Delete group (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'group.delete',
        entityType: 'group',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const group = await TelegramGroup.findById((input as { id: string }).id);
          return group;
        },
      })
    )
    .mutation(async ({ input }) => {
      const result = await TelegramGroup.findByIdAndDelete(input.id);
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }
      return { success: true };
    }),

  // Get group stats
  getStats: protectedProcedure.query(async () => {
    const [totalGroups, activeGroups, totalMembers, autoDiscovered] = await Promise.all([
      TelegramGroup.countDocuments(),
      TelegramGroup.countDocuments({ 'settings.isActive': true }),
      TelegramGroup.aggregate([
        { $group: { _id: null, total: { $sum: '$stats.memberCount' } } },
      ]),
      TelegramGroup.countDocuments({ isAutoDiscovered: true }),
    ]);

    return {
      totalGroups,
      activeGroups,
      totalMembers: totalMembers[0]?.total || 0,
      autoDiscovered,
    };
  }),

  // Discover groups from bot (sync all known groups)
  discoverFromBot: operatorProcedure
    .use(
      withAudit({
        action: 'group.discover',
        entityType: 'group',
      })
    )
    .mutation(async () => {
      const job = await botTasksQueue.add(
        'sync-groups',
        { type: 'sync-groups', data: {} } as BotTaskJob,
        { priority: 1 }
      );

      return {
        jobId: job.id,
        message: 'Group discovery started. Check queue monitor for progress.',
      };
    }),

  // Sync a single group (also adds if not exists)
  syncGroup: operatorProcedure
    .input(z.object({ telegramId: z.string() }))
    .use(
      withAudit({
        action: 'group.sync',
        entityType: 'group',
        getEntityId: (input) => (input as { telegramId: string }).telegramId,
      })
    )
    .mutation(async ({ input }) => {
      const job = await botTasksQueue.add(
        'sync-single-group',
        {
          type: 'sync-single-group',
          data: { telegramId: input.telegramId },
        } as BotTaskJob,
        { priority: 1 }
      );

      return {
        jobId: job.id,
        message: `Syncing group ${input.telegramId}. This will add the group if it doesn't exist.`,
      };
    }),

  // Add group by Telegram ID (manually discover a group)
  addByTelegramId: operatorProcedure
    .input(z.object({ telegramId: z.string().min(1) }))
    .use(
      withAudit({
        action: 'group.create',
        entityType: 'group',
        getEntityId: (input) => (input as { telegramId: string }).telegramId,
      })
    )
    .mutation(async ({ input }) => {
      // Check if already exists
      const existing = await TelegramGroup.findOne({ telegramId: input.telegramId });
      if (existing) {
        // Just sync it
        const job = await botTasksQueue.add(
          'sync-single-group',
          {
            type: 'sync-single-group',
            data: { telegramId: input.telegramId },
          } as BotTaskJob,
          { priority: 1 }
        );
        return {
          jobId: job.id,
          message: `Group already exists, syncing ${input.telegramId}`,
          isNew: false,
        };
      }

      // Add to queue for sync (will create if bot has access)
      const job = await botTasksQueue.add(
        'sync-single-group',
        {
          type: 'sync-single-group',
          data: { telegramId: input.telegramId },
        } as BotTaskJob,
        { priority: 1 }
      );

      return {
        jobId: job.id,
        message: `Adding group ${input.telegramId}. Make sure the bot is admin in this group.`,
        isNew: true,
      };
    }),

  // Sync all groups
  syncAll: operatorProcedure
    .use(
      withAudit({
        action: 'group.syncAll',
        entityType: 'group',
      })
    )
    .mutation(async () => {
      const job = await botTasksQueue.add(
        'sync-groups',
        { type: 'sync-groups', data: {} } as BotTaskJob,
        { priority: 1 }
      );

      return {
        jobId: job.id,
        message: 'Syncing all groups. Check queue monitor for progress.',
      };
    }),

  // Send test message to group
  testMessage: operatorProcedure
    .input(
      z.object({
        groupId: z.string(),
        text: z.string().min(1).max(4096),
      })
    )
    .use(
      withAudit({
        action: 'group.testMessage',
        entityType: 'group',
        getEntityId: (input) => (input as { groupId: string }).groupId,
      })
    )
    .mutation(async ({ input }) => {
      // Get the group to find the telegramId
      const group = await TelegramGroup.findById(input.groupId);
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      const job = await botTasksQueue.add(
        'send-message',
        {
          type: 'send-message',
          data: {
            chatId: group.telegramId,
            text: input.text,
            parseMode: 'HTML',
            bypassRateLimit: true, // Test messages bypass rate limits
          },
        } as BotTaskJob,
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: `Test message queued for ${group.name}`,
      };
    }),

  // Delete message from group
  deleteMessage: operatorProcedure
    .input(
      z.object({
        groupId: z.string(),
        messageId: z.number(),
      })
    )
    .use(
      withAudit({
        action: 'group.deleteMessage',
        entityType: 'group',
        getEntityId: (input) => (input as { groupId: string }).groupId,
      })
    )
    .mutation(async ({ input }) => {
      const group = await TelegramGroup.findById(input.groupId);
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      const job = await botTasksQueue.add(
        'delete-message',
        {
          type: 'delete-message',
          data: {
            chatId: group.telegramId,
            messageId: input.messageId,
          },
        } as BotTaskJob,
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: `Delete request queued for message ${input.messageId}`,
      };
    }),

  // Get bot permissions for a group
  getBotPermissions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const group = await TelegramGroup.findById(input.id).select('botPermissions lastSyncAt');
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      return {
        permissions: group.botPermissions || null,
        lastSyncAt: group.lastSyncAt,
      };
    }),

  // Refresh group stats (member count, etc.)
  refreshStats: operatorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const group = await TelegramGroup.findById(input.id);
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      const job = await botTasksQueue.add(
        'get-chat-info',
        {
          type: 'get-chat-info',
          data: { chatId: group.telegramId },
        } as BotTaskJob,
        { priority: 1 }
      );

      return {
        jobId: job.id,
        message: `Refreshing stats for ${group.name}`,
      };
    }),

  // Bulk delete messages from group
  bulkDeleteMessages: operatorProcedure
    .input(
      z.object({
        groupId: z.string(),
        messageIds: z.array(z.number()).min(1).max(1000),
      })
    )
    .use(
      withAudit({
        action: 'group.bulkDeleteMessages',
        entityType: 'group',
        getEntityId: (input) => (input as { groupId: string }).groupId,
      })
    )
    .mutation(async ({ input }) => {
      const group = await TelegramGroup.findById(input.groupId);
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      // Check if bot has delete permission
      if (!group.botPermissions?.canDeleteMessages) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Bot does not have permission to delete messages in this group',
        });
      }

      const job = await botTasksQueue.add(
        'delete-messages-bulk',
        {
          type: 'delete-messages-bulk',
          data: {
            chatId: group.telegramId,
            messageIds: input.messageIds,
            groupDbId: input.groupId,
          },
        } as BotTaskJob,
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: `Bulk delete queued: ${input.messageIds.length} messages`,
        messageCount: input.messageIds.length,
      };
    }),

  // Clear all messages from group (admin operation)
  clearAllMessages: operatorProcedure
    .input(
      z.object({
        groupId: z.string(),
        fromMessageId: z.number().optional(),
        toMessageId: z.number().optional(),
        olderThanDays: z.number().min(1).max(365).optional(),
      })
    )
    .use(
      withAudit({
        action: 'group.clearAllMessages',
        entityType: 'group',
        getEntityId: (input) => (input as { groupId: string }).groupId,
      })
    )
    .mutation(async ({ input }) => {
      const group = await TelegramGroup.findById(input.groupId);
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      // Check if bot has delete permission
      if (!group.botPermissions?.canDeleteMessages) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Bot does not have permission to delete messages in this group',
        });
      }

      // For range deletion, use lastMessageId if toMessageId not specified
      const toMessageId = input.toMessageId || group.lastMessageId;

      const job = await botTasksQueue.add(
        'clear-all-messages',
        {
          type: 'clear-all-messages',
          data: {
            chatId: group.telegramId,
            groupDbId: input.groupId,
            fromMessageId: input.fromMessageId,
            toMessageId,
            olderThanDays: input.olderThanDays,
          },
        } as BotTaskJob,
        { priority: 3 } // Lower priority for heavy operation
      );

      return {
        jobId: job.id,
        message: `Clear all messages queued for ${group.name}`,
        fromMessageId: input.fromMessageId,
        toMessageId,
      };
    }),

  // Get messages sent to this group (for selection/deletion)
  getMessages: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        includeDeleted: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const { PostHistory } = await import('@common');

      const filter: Record<string, unknown> = {
        groupId: input.groupId,
      };

      if (!input.includeDeleted) {
        filter['metrics.deletedAt'] = { $exists: false };
      }

      const [messages, total] = await Promise.all([
        PostHistory.find(filter)
          .sort({ sentAt: -1 })
          .skip((input.page - 1) * input.limit)
          .limit(input.limit)
          .populate('campaignId', 'name')
          .populate('creativeId', 'name')
          .lean(),
        PostHistory.countDocuments(filter),
      ]);

      return {
        data: messages,
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),
});
