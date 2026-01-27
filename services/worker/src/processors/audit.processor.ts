import { Job } from 'bullmq';
import { AuditLog, logger } from '@common';
import type { AuditAction, EntityType, AuditChanges, AuditMetadata } from '$types/audit-log';

interface AuditJobData {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  changes?: AuditChanges;
  metadata: AuditMetadata;
}

export async function processAuditLog(job: Job<AuditJobData>): Promise<void> {
  const { userId, action, entityType, entityId, changes, metadata } = job.data;

  try {
    await AuditLog.create({
      userId,
      action,
      entityType,
      entityId,
      changes: changes || {},
      metadata,
    });

    logger.debug('Audit log created', { action, entityType, entityId });
  } catch (error) {
    logger.error('Failed to create audit log', error, { action, entityType });
    throw error;
  }
}
