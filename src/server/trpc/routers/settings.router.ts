import { z } from 'zod';
import { router, adminProcedure, protectedProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { getSettings, Settings, AuditService } from '@common';

const updateSettingsSchema = z.object({
  bot: z
    .object({
      token: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .optional(),
  spamControl: z
    .object({
      globalMaxAdsPerHour: z.number().min(1).max(1000).optional(),
      globalCooldownMinutes: z.number().min(1).max(60).optional(),
      requireManualApproval: z.boolean().optional(),
      keywordBlacklist: z.array(z.string()).optional(),
      emergencyStopActive: z.boolean().optional(),
    })
    .optional(),
  notifications: z
    .object({
      emailOnError: z.boolean().optional(),
      emailOnLowBalance: z.boolean().optional(),
      emailOnDealEnd: z.boolean().optional(),
      errorEmailRecipients: z.array(z.string().email()).optional(),
    })
    .optional(),
});

export const settingsRouter = router({
  // Get settings
  get: protectedProcedure.query(async () => {
    const settings = await getSettings();
    // Hide the bot token for non-admin users
    const result = settings.toObject();
    result.bot.token = result.bot.token ? '***hidden***' : '';
    return result;
  }),

  // Get full settings (admin only)
  getFull: adminProcedure.query(async () => {
    const settings = await getSettings();
    return settings.toObject();
  }),

  // Update settings (admin only)
  update: adminProcedure
    .input(updateSettingsSchema)
    .use(
      withAudit({
        action: 'settings.update',
        entityType: 'settings',
        getBefore: async () => {
          const settings = await getSettings();
          return settings;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { bot, spamControl, notifications } = input;

      const updateData: Record<string, unknown> = {};

      if (bot) {
        Object.entries(bot).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[`bot.${key}`] = value;
          }
        });
      }

      if (spamControl) {
        Object.entries(spamControl).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[`spamControl.${key}`] = value;
          }
        });
      }

      if (notifications) {
        Object.entries(notifications).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[`notifications.${key}`] = value;
          }
        });
      }

      const settings = await Settings.findOneAndUpdate(
        { key: 'default' },
        updateData,
        { new: true, upsert: true }
      );

      return settings.toObject();
    }),

  // Emergency stop (admin only)
  emergencyStop: adminProcedure.mutation(async ({ ctx }) => {
    const settings = await Settings.findOneAndUpdate(
      { key: 'default' },
      { 'spamControl.emergencyStopActive': true },
      { new: true }
    );

    // Log emergency stop with sync logging
    await AuditService.logEmergencyStop(ctx.session.userId, {
      route: 'settings.emergencyStop',
      success: true,
      duration: 0,
      ipAddress: ctx.req.ip,
      userAgent: ctx.req.userAgent,
    });

    return { success: true, settings: settings?.toObject() };
  }),

  // Resume operations (admin only)
  resume: adminProcedure
    .use(
      withAudit({
        action: 'spam.resume',
        entityType: 'settings',
      })
    )
    .mutation(async () => {
      const settings = await Settings.findOneAndUpdate(
        { key: 'default' },
        { 'spamControl.emergencyStopActive': false },
        { new: true }
      );

      return { success: true, settings: settings?.toObject() };
    }),

  // Get spam risk level
  getSpamRiskLevel: protectedProcedure.query(async () => {
    const settings = await getSettings();

    // Calculate risk based on current activity
    // This is a simplified version - in production, you'd analyze recent posting patterns
    const riskLevel = settings.spamControl.emergencyStopActive
      ? 'red'
      : settings.spamControl.requireManualApproval
        ? 'yellow'
        : 'green';

    return {
      level: riskLevel,
      emergencyStopActive: settings.spamControl.emergencyStopActive,
      requireManualApproval: settings.spamControl.requireManualApproval,
    };
  }),
});
