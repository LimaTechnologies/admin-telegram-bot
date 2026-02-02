import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { AuditLog } from '@common';

export const auditRouter = router({
  // List audit logs (admin only)
  list: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        userId: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        success: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, userId, action, entityType, entityId, startDate, endDate, success } = input;

      const filter: Record<string, unknown> = {};
      if (userId) filter['userId'] = userId;
      if (action) filter['action'] = action;
      if (entityType) filter['entityType'] = entityType;
      if (entityId) filter['entityId'] = entityId;
      if (success !== undefined) filter['metadata.success'] = success;

      if (startDate || endDate) {
        filter['metadata.timestamp'] = {};
        if (startDate) (filter['metadata.timestamp'] as Record<string, Date>)['$gte'] = new Date(startDate);
        if (endDate) (filter['metadata.timestamp'] as Record<string, Date>)['$lte'] = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ 'metadata.timestamp': -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', 'name email')
          .select('-__v'),
        AuditLog.countDocuments(filter),
      ]);

      return {
        data: logs.map((l) => l.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get audit log by ID (admin only)
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const log = await AuditLog.findById(input.id)
        .populate('userId', 'name email')
        .select('-__v');

      if (!log) {
        return null;
      }
      return log.toObject();
    }),

  // Get actions summary (admin only)
  getActionsSummary: adminProcedure
    .input(
      z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate } = input;

      const match: Record<string, unknown> = {};
      if (startDate || endDate) {
        match['metadata.timestamp'] = {};
        if (startDate) (match['metadata.timestamp'] as Record<string, Date>)['$gte'] = new Date(startDate);
        if (endDate) (match['metadata.timestamp'] as Record<string, Date>)['$lte'] = new Date(endDate);
      }

      const summary = await AuditLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              action: '$action',
              success: '$metadata.success',
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.action',
            total: { $sum: '$count' },
            successful: {
              $sum: {
                $cond: [{ $eq: ['$_id.success', true] }, '$count', 0],
              },
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$_id.success', false] }, '$count', 0],
              },
            },
          },
        },
        { $sort: { total: -1 } },
      ]);

      return summary;
    }),

  // Get stats for dashboard (admin only)
  getStats: adminProcedure.query(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const [todayEvents, activeUsers, failedActions] = await Promise.all([
      // Events today
      AuditLog.countDocuments({
        'metadata.timestamp': { $gte: todayStart },
      }),
      // Distinct users in last 24 hours
      AuditLog.distinct('userId', {
        'metadata.timestamp': { $gte: yesterdayStart },
      }).then((users) => users.length),
      // Failed actions in last 24 hours
      AuditLog.countDocuments({
        'metadata.timestamp': { $gte: yesterdayStart },
        'metadata.success': false,
      }),
    ]);

    return {
      todayEvents,
      activeUsers,
      failedActions,
    };
  }),

  // Get user activity (admin only)
  getUserActivity: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const logs = await AuditLog.find({ userId: input.userId })
        .sort({ 'metadata.timestamp': -1 })
        .limit(input.limit)
        .select('action entityType metadata.timestamp metadata.success');

      return logs.map((l) => l.toObject());
    }),

  // Export audit logs (admin only)
  export: adminProcedure
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        format: z.enum(['json', 'csv']).default('json'),
      })
    )
    .query(async ({ input }) => {
      const logs = await AuditLog.find({
        'metadata.timestamp': {
          $gte: new Date(input.startDate),
          $lte: new Date(input.endDate),
        },
      })
        .sort({ 'metadata.timestamp': -1 })
        .populate('userId', 'name email')
        .select('-__v')
        .limit(10000); // Limit export size

      if (input.format === 'csv') {
        const headers = ['timestamp', 'user', 'action', 'entityType', 'entityId', 'success', 'duration'];
        const rows = logs.map((log) => {
          const obj = log.toObject();
          const user = obj.userId as { name?: string; email?: string } | undefined;
          return [
            obj.metadata.timestamp.toISOString(),
            user?.email || obj.userId.toString(),
            obj.action,
            obj.entityType,
            obj.entityId?.toString() || '',
            obj.metadata.success,
            obj.metadata.duration,
          ].join(',');
        });
        return [headers.join(','), ...rows].join('\n');
      }

      return logs.map((l) => l.toObject());
    }),
});
