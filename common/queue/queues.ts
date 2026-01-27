import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from './connection';

// Queue names
export const QUEUE_NAMES = {
  POST_GROUP: (groupId: string) => `post:group:${groupId}`,
  AUDIT_LOG: 'audit:log',
  ANALYTICS_AGGREGATE: 'analytics:aggregate',
  CAMPAIGN_CHECK: 'campaign:check',
} as const;

// Default queue options
const defaultQueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

// Audit log queue (async logging)
export const auditLogQueue = new Queue(QUEUE_NAMES.AUDIT_LOG, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Analytics aggregation queue
export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS_AGGREGATE, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Campaign check queue
export const campaignCheckQueue = new Queue(QUEUE_NAMES.CAMPAIGN_CHECK, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Factory function for per-group post queues
const postQueues = new Map<string, Queue>();

export function getPostQueue(groupId: string): Queue {
  const queueName = QUEUE_NAMES.POST_GROUP(groupId);

  if (!postQueues.has(groupId)) {
    const queue = new Queue(queueName, {
      ...defaultQueueOptions,
      defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
    postQueues.set(groupId, queue);
  }

  return postQueues.get(groupId)!;
}

// Get queue events for monitoring
export function getQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, {
    connection: getRedisConnection(),
  });
}

// Close all queues gracefully
export async function closeAllQueues(): Promise<void> {
  await auditLogQueue.close();
  await analyticsQueue.close();
  await campaignCheckQueue.close();

  for (const queue of postQueues.values()) {
    await queue.close();
  }
  postQueues.clear();
}
