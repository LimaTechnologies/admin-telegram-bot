import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure, adminProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { botTasksQueue, getSettings } from '@common';
import type { BotTaskJob } from '$types/telegram-group';

export const botAdminRouter = router({
  // Get bot status and info
  getStatus: protectedProcedure.query(async () => {
    try {
      const settings = await getSettings();
      const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

      if (!token) {
        return {
          isConfigured: false,
          isActive: false,
          emergencyStop: settings.spamControl.emergencyStopActive,
          username: null,
          botId: null,
        };
      }

      // Try to get bot info
      const { Bot } = await import('grammy');
      const bot = new Bot(token);
      const me = await bot.api.getMe();

      return {
        isConfigured: true,
        isActive: settings.bot.isActive,
        emergencyStop: settings.spamControl.emergencyStopActive,
        username: me.username,
        botId: me.id,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
        canReadMessages: me.can_read_all_group_messages,
      };
    } catch (error) {
      return {
        isConfigured: false,
        isActive: false,
        emergencyStop: false,
        username: null,
        botId: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }),

  // Get bot info from Telegram API
  getMe: protectedProcedure.query(async () => {
    try {
      const settings = await getSettings();
      const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

      if (!token) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Bot token not configured' });
      }

      const { Bot } = await import('grammy');
      const bot = new Bot(token);
      const me = await bot.api.getMe();

      return me;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get bot info',
      });
    }
  }),

  // Send message to any chat (admin only)
  sendMessage: adminProcedure
    .input(
      z.object({
        chatId: z.string(),
        text: z.string().min(1).max(4096),
        parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
        disableNotification: z.boolean().optional(),
      })
    )
    .use(
      withAudit({
        action: 'bot.sendMessage',
        entityType: 'bot',
      })
    )
    .mutation(async ({ input }) => {
      const job = await botTasksQueue.add(
        'send-message',
        {
          type: 'send-message',
          data: {
            chatId: input.chatId,
            text: input.text,
            parseMode: input.parseMode || 'HTML',
            disableNotification: input.disableNotification,
          },
        } as BotTaskJob,
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: 'Message queued for sending',
      };
    }),

  // Delete message from any chat (admin only)
  deleteMessage: adminProcedure
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.number(),
      })
    )
    .use(
      withAudit({
        action: 'bot.deleteMessage',
        entityType: 'bot',
      })
    )
    .mutation(async ({ input }) => {
      const job = await botTasksQueue.add(
        'delete-message',
        {
          type: 'delete-message',
          data: {
            chatId: input.chatId,
            messageId: input.messageId,
          },
        } as BotTaskJob,
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: 'Delete request queued',
      };
    }),

  // Get chat member info
  getChatMember: operatorProcedure
    .input(
      z.object({
        chatId: z.string(),
        userId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        const settings = await getSettings();
        const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

        if (!token) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Bot token not configured' });
        }

        const { Bot } = await import('grammy');
        const bot = new Bot(token);
        const member = await bot.api.getChatMember(input.chatId, input.userId);

        return member;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get chat member',
        });
      }
    }),

  // Ban user from group (admin only)
  banUser: adminProcedure
    .input(
      z.object({
        chatId: z.string(),
        userId: z.number(),
        untilDate: z.number().optional(),
        revokeMessages: z.boolean().optional(),
      })
    )
    .use(
      withAudit({
        action: 'bot.banUser',
        entityType: 'bot',
      })
    )
    .mutation(async ({ input }) => {
      try {
        const settings = await getSettings();
        const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

        if (!token) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Bot token not configured' });
        }

        const { Bot } = await import('grammy');
        const bot = new Bot(token);
        await bot.api.banChatMember(input.chatId, input.userId, {
          until_date: input.untilDate,
          revoke_messages: input.revokeMessages,
        });

        return { success: true, message: `User ${input.userId} banned from chat ${input.chatId}` };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to ban user',
        });
      }
    }),

  // Unban user from group (admin only)
  unbanUser: adminProcedure
    .input(
      z.object({
        chatId: z.string(),
        userId: z.number(),
        onlyIfBanned: z.boolean().optional(),
      })
    )
    .use(
      withAudit({
        action: 'bot.unbanUser',
        entityType: 'bot',
      })
    )
    .mutation(async ({ input }) => {
      try {
        const settings = await getSettings();
        const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

        if (!token) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Bot token not configured' });
        }

        const { Bot } = await import('grammy');
        const bot = new Bot(token);
        await bot.api.unbanChatMember(input.chatId, input.userId, {
          only_if_banned: input.onlyIfBanned,
        });

        return { success: true, message: `User ${input.userId} unbanned from chat ${input.chatId}` };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to unban user',
        });
      }
    }),

  // Pin message in chat (operator+)
  pinMessage: operatorProcedure
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.number(),
        disableNotification: z.boolean().optional(),
      })
    )
    .use(
      withAudit({
        action: 'bot.pinMessage',
        entityType: 'bot',
      })
    )
    .mutation(async ({ input }) => {
      try {
        const settings = await getSettings();
        const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

        if (!token) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Bot token not configured' });
        }

        const { Bot } = await import('grammy');
        const bot = new Bot(token);
        await bot.api.pinChatMessage(input.chatId, input.messageId, {
          disable_notification: input.disableNotification,
        });

        return { success: true, message: `Message ${input.messageId} pinned` };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to pin message',
        });
      }
    }),

  // Unpin message in chat (operator+)
  unpinMessage: operatorProcedure
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.number().optional(),
      })
    )
    .use(
      withAudit({
        action: 'bot.unpinMessage',
        entityType: 'bot',
      })
    )
    .mutation(async ({ input }) => {
      try {
        const settings = await getSettings();
        const token = settings.bot.token || process.env['TELEGRAM_BOT_TOKEN'];

        if (!token) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Bot token not configured' });
        }

        const { Bot } = await import('grammy');
        const bot = new Bot(token);

        if (input.messageId) {
          await bot.api.unpinChatMessage(input.chatId, input.messageId);
        } else {
          await bot.api.unpinAllChatMessages(input.chatId);
        }

        return { success: true, message: input.messageId ? `Message ${input.messageId} unpinned` : 'All messages unpinned' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to unpin message',
        });
      }
    }),

  // Get queue stats
  getQueueStats: protectedProcedure.query(async () => {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        botTasksQueue.getWaitingCount(),
        botTasksQueue.getActiveCount(),
        botTasksQueue.getCompletedCount(),
        botTasksQueue.getFailedCount(),
        botTasksQueue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        error: error instanceof Error ? error.message : 'Failed to get queue stats',
      };
    }
  }),
});
