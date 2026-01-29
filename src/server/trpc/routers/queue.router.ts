import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import {
  auditLogQueue,
  analyticsQueue,
  campaignCheckQueue,
  botTasksQueue,
  QUEUE_NAMES,
} from '@common';
import type { Queue, Job } from 'bullmq';

// Queue name to queue instance mapping
const queues: Record<string, Queue> = {
  [QUEUE_NAMES.AUDIT_LOG]: auditLogQueue,
  [QUEUE_NAMES.ANALYTICS_AGGREGATE]: analyticsQueue,
  [QUEUE_NAMES.CAMPAIGN_CHECK]: campaignCheckQueue,
  [QUEUE_NAMES.BOT_TASKS]: botTasksQueue,
};

// Helper to get queue by name
function getQueue(queueName: string): Queue {
  const queue = queues[queueName];
  if (!queue) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Queue "${queueName}" not found`,
    });
  }
  return queue;
}

// Helper to format job for response
function formatJob(job: Job) {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    opts: job.opts,
    progress: job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

export const queueRouter = router({
  // Get list of available queues
  getQueues: protectedProcedure.query(() => {
    return Object.keys(queues).map(name => ({ name }));
  }),

  // Get stats for all queues
  getAllStats: protectedProcedure.query(async () => {
    const stats = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        try {
          const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.isPaused(),
          ]);

          return {
            name,
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused,
            total: waiting + active + completed + failed + delayed,
          };
        } catch (error) {
          return {
            name,
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: false,
            total: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return stats;
  }),

  // Get stats for a specific queue
  getStats: protectedProcedure
    .input(z.object({ queueName: z.string() }))
    .query(async ({ input }) => {
      const queue = getQueue(input.queueName);

      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

      return {
        name: input.queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        total: waiting + active + completed + failed + delayed,
      };
    }),

  // Get jobs from a queue with pagination
  getJobs: protectedProcedure
    .input(
      z.object({
        queueName: z.string(),
        status: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed']).default('waiting'),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const start = (input.page - 1) * input.limit;
      const end = start + input.limit - 1;

      let jobs: Job[];
      let total: number;

      switch (input.status) {
        case 'waiting':
          jobs = await queue.getWaiting(start, end);
          total = await queue.getWaitingCount();
          break;
        case 'active':
          jobs = await queue.getActive(start, end);
          total = await queue.getActiveCount();
          break;
        case 'completed':
          jobs = await queue.getCompleted(start, end);
          total = await queue.getCompletedCount();
          break;
        case 'failed':
          jobs = await queue.getFailed(start, end);
          total = await queue.getFailedCount();
          break;
        case 'delayed':
          jobs = await queue.getDelayed(start, end);
          total = await queue.getDelayedCount();
          break;
        default:
          jobs = [];
          total = 0;
      }

      return {
        data: jobs.map(formatJob),
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  // Get a specific job by ID
  getJob: protectedProcedure
    .input(
      z.object({
        queueName: z.string(),
        jobId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const job = await queue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      const state = await job.getState();

      return {
        ...formatJob(job),
        state,
      };
    }),

  // Retry a failed job (admin only)
  retryJob: adminProcedure
    .input(
      z.object({
        queueName: z.string(),
        jobId: z.string(),
      })
    )
    .use(
      withAudit({
        action: 'queue.retryJob',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const job = await queue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      const state = await job.getState();
      if (state !== 'failed') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only failed jobs can be retried',
        });
      }

      await job.retry();

      return {
        success: true,
        message: `Job ${input.jobId} queued for retry`,
      };
    }),

  // Remove a job (admin only)
  removeJob: adminProcedure
    .input(
      z.object({
        queueName: z.string(),
        jobId: z.string(),
      })
    )
    .use(
      withAudit({
        action: 'queue.removeJob',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const job = await queue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      await job.remove();

      return {
        success: true,
        message: `Job ${input.jobId} removed`,
      };
    }),

  // Clean old jobs from a queue (admin only)
  cleanQueue: adminProcedure
    .input(
      z.object({
        queueName: z.string(),
        status: z.enum(['completed', 'failed']).default('completed'),
        grace: z.number().min(0).default(3600000), // Default 1 hour
      })
    )
    .use(
      withAudit({
        action: 'queue.clean',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const removed = await queue.clean(input.grace, 1000, input.status);

      return {
        success: true,
        message: `Cleaned ${removed.length} ${input.status} jobs older than ${input.grace}ms`,
        removed: removed.length,
      };
    }),

  // Pause a queue (admin only)
  pauseQueue: adminProcedure
    .input(z.object({ queueName: z.string() }))
    .use(
      withAudit({
        action: 'queue.pause',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      await queue.pause();

      return {
        success: true,
        message: `Queue "${input.queueName}" paused`,
      };
    }),

  // Resume a queue (admin only)
  resumeQueue: adminProcedure
    .input(z.object({ queueName: z.string() }))
    .use(
      withAudit({
        action: 'queue.resume',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      await queue.resume();

      return {
        success: true,
        message: `Queue "${input.queueName}" resumed`,
      };
    }),

  // Retry all failed jobs in a queue (admin only)
  retryAllFailed: adminProcedure
    .input(z.object({ queueName: z.string() }))
    .use(
      withAudit({
        action: 'queue.retryAllFailed',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const failedJobs = await queue.getFailed(0, 1000);

      let retried = 0;
      for (const job of failedJobs) {
        try {
          await job.retry();
          retried++;
        } catch {
          // Skip jobs that can't be retried
        }
      }

      return {
        success: true,
        message: `Retried ${retried} of ${failedJobs.length} failed jobs`,
        retried,
        total: failedJobs.length,
      };
    }),

  // Force send a delayed job immediately (admin only)
  forceSendJob: adminProcedure
    .input(
      z.object({
        queueName: z.string(),
        jobId: z.string(),
      })
    )
    .use(
      withAudit({
        action: 'queue.forceSend',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const job = await queue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      const state = await job.getState();
      if (state !== 'delayed') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only delayed/scheduled jobs can be force sent',
        });
      }

      // Promote the job to be executed immediately
      await job.promote();

      return {
        success: true,
        message: `Job ${input.jobId} promoted for immediate execution`,
      };
    }),

  // Reschedule a delayed job (admin only)
  rescheduleJob: adminProcedure
    .input(
      z.object({
        queueName: z.string(),
        jobId: z.string(),
        delay: z.number().min(0), // Delay in milliseconds from now
      })
    )
    .use(
      withAudit({
        action: 'queue.reschedule',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const queue = getQueue(input.queueName);
      const job = await queue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }

      const state = await job.getState();
      if (state !== 'delayed') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only delayed/scheduled jobs can be rescheduled',
        });
      }

      // Change the delay timestamp
      await job.changeDelay(input.delay);

      return {
        success: true,
        message: `Job ${input.jobId} rescheduled to execute in ${Math.round(input.delay / 1000)} seconds`,
      };
    }),

  // Calculate best posting hours for all groups
  calculateBestHours: adminProcedure
    .use(
      withAudit({
        action: 'queue.retryJob', // Using existing action
        entityType: 'queue',
      })
    )
    .mutation(async () => {
      const job = await analyticsQueue.add(
        'best-hours',
        { type: 'best-hours' },
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: 'Best posting hours calculation started',
      };
    }),

  // Sync member counts for all groups
  syncMemberCounts: adminProcedure
    .use(
      withAudit({
        action: 'queue.retryJob', // Using existing action
        entityType: 'queue',
      })
    )
    .mutation(async () => {
      const job = await analyticsQueue.add(
        'member-sync',
        { type: 'member-sync' },
        { priority: 2 }
      );

      return {
        jobId: job.id,
        message: 'Member count sync started',
      };
    }),

  // Create a scheduled message job
  scheduleMessage: adminProcedure
    .input(
      z.object({
        chatId: z.string(),
        text: z.string().min(1).max(4096),
        scheduledAt: z.string().datetime(), // ISO date string
        parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).default('HTML'),
      })
    )
    .use(
      withAudit({
        action: 'queue.scheduleMessage',
        entityType: 'queue',
      })
    )
    .mutation(async ({ input }) => {
      const scheduledDate = new Date(input.scheduledAt);
      const delay = scheduledDate.getTime() - Date.now();

      if (delay < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Scheduled time must be in the future',
        });
      }

      const job = await botTasksQueue.add(
        'scheduled-message',
        {
          type: 'send-message',
          data: {
            chatId: input.chatId,
            text: input.text,
            parseMode: input.parseMode,
          },
        },
        {
          delay,
          priority: 3,
          removeOnComplete: { age: 86400, count: 1000 }, // Keep for 24h
        }
      );

      return {
        jobId: job.id,
        scheduledAt: input.scheduledAt,
        message: `Message scheduled for ${scheduledDate.toLocaleString()}`,
      };
    }),
});
