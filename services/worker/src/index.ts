import { Worker } from 'bullmq';
import { connectDB, getRedisConnection, QUEUE_NAMES, subscriptionCheckQueue, logger } from '@common';
import { processAuditLog } from './processors/audit.processor';
import { processCampaignCheck } from './processors/campaign.processor';
import { processAnalyticsAggregation } from './processors/analytics.processor';
import { processBotTasks } from './processors/bot-tasks.processor';
import { processSubscriptionCheck } from './processors/subscription.processor';

async function main() {
  logger.info('Starting worker service...');

  // Connect to database
  await connectDB();
  logger.info('Connected to database');

  const connection = getRedisConnection();

  // Audit log worker
  const auditWorker = new Worker(
    QUEUE_NAMES.AUDIT_LOG,
    processAuditLog,
    {
      connection,
      concurrency: 10,
    }
  );

  auditWorker.on('completed', (job) => {
    logger.debug('Audit log processed', { jobId: job.id });
  });

  auditWorker.on('failed', (job, err) => {
    logger.error('Audit log failed', err, { jobId: job?.id });
  });

  // Campaign check worker
  const campaignWorker = new Worker(
    QUEUE_NAMES.CAMPAIGN_CHECK,
    processCampaignCheck,
    {
      connection,
      concurrency: 5,
    }
  );

  campaignWorker.on('completed', (job) => {
    logger.debug('Campaign check completed', { jobId: job.id });
  });

  campaignWorker.on('failed', (job, err) => {
    logger.error('Campaign check failed', err, { jobId: job?.id });
  });

  // Analytics aggregation worker
  const analyticsWorker = new Worker(
    QUEUE_NAMES.ANALYTICS_AGGREGATE,
    processAnalyticsAggregation,
    {
      connection,
      concurrency: 2,
    }
  );

  analyticsWorker.on('completed', (job) => {
    logger.debug('Analytics aggregation completed', { jobId: job.id });
  });

  analyticsWorker.on('failed', (job, err) => {
    logger.error('Analytics aggregation failed', err, { jobId: job?.id });
  });

  // Bot tasks worker
  const botTasksWorker = new Worker(
    QUEUE_NAMES.BOT_TASKS,
    processBotTasks,
    {
      connection,
      concurrency: 5,
    }
  );

  botTasksWorker.on('completed', (job) => {
    logger.debug('Bot task completed', { jobId: job.id, type: job.data?.type });
  });

  botTasksWorker.on('failed', (job, err) => {
    logger.error('Bot task failed', err, { jobId: job?.id, type: job?.data?.type });
  });

  // Subscription check worker (expiration notifications + message deletion)
  const subscriptionWorker = new Worker(
    QUEUE_NAMES.SUBSCRIPTION_CHECK,
    processSubscriptionCheck,
    {
      connection,
      concurrency: 2,
    }
  );

  subscriptionWorker.on('completed', (job) => {
    logger.debug('Subscription check completed', { jobId: job.id, type: job.data?.type });
  });

  subscriptionWorker.on('failed', (job, err) => {
    logger.error('Subscription check failed', err, { jobId: job?.id, type: job?.data?.type });
  });

  // Schedule repeatable jobs for subscription checks
  // Check for subscriptions expiring in 7 days (runs daily at 9:00 AM)
  await subscriptionCheckQueue.add(
    'check-expiring-7days',
    { type: 'check-expiring-7days' },
    {
      repeat: { pattern: '0 9 * * *' }, // Every day at 9:00 AM
      jobId: 'subscription-7days-check',
    }
  );

  // Check for subscriptions expiring in 1 day (runs daily at 9:00 AM)
  await subscriptionCheckQueue.add(
    'check-expiring-1day',
    { type: 'check-expiring-1day' },
    {
      repeat: { pattern: '0 9 * * *' }, // Every day at 9:00 AM
      jobId: 'subscription-1day-check',
    }
  );

  // Process expired subscriptions (runs every hour)
  await subscriptionCheckQueue.add(
    'process-expired',
    { type: 'process-expired' },
    {
      repeat: { pattern: '0 * * * *' }, // Every hour
      jobId: 'subscription-expired-check',
    }
  );

  logger.info('Subscription check jobs scheduled');

  logger.info('Worker service started successfully');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all([
      auditWorker.close(),
      campaignWorker.close(),
      analyticsWorker.close(),
      botTasksWorker.close(),
      subscriptionWorker.close(),
    ]);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Worker service failed to start', err);
  process.exit(1);
});
