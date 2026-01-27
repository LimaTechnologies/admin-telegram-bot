import { auditLogQueue } from '../queue';
import { logger } from './logger';
import type { AuditAction, EntityType, AuditChanges, AuditMetadata } from '$types/audit-log';

interface AuditLogInput {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  changes?: AuditChanges;
  metadata: Omit<AuditMetadata, 'timestamp'>;
}

class AuditServiceClass {
  async log(input: AuditLogInput): Promise<void> {
    try {
      await auditLogQueue.add('audit-log', {
        ...input,
        metadata: {
          ...input.metadata,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break the main flow
      logger.error('Failed to queue audit log', error, { action: input.action });
    }
  }

  async logSync(input: AuditLogInput): Promise<void> {
    // Synchronous logging for critical operations
    // This directly writes to the database instead of using the queue
    try {
      const { AuditLog } = await import('../models/audit-log.model');
      await AuditLog.create({
        ...input,
        metadata: {
          ...input.metadata,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to write audit log', error, { action: input.action });
    }
  }

  // Helper methods for common audit operations
  async logLogin(userId: string, metadata: Omit<AuditMetadata, 'timestamp'>): Promise<void> {
    await this.log({
      userId,
      action: 'user.login',
      entityType: 'user',
      entityId: userId,
      metadata,
    });
  }

  async logLogout(userId: string, metadata: Omit<AuditMetadata, 'timestamp'>): Promise<void> {
    await this.log({
      userId,
      action: 'user.logout',
      entityType: 'user',
      entityId: userId,
      metadata,
    });
  }

  async logCreate(
    userId: string,
    entityType: EntityType,
    entityId: string,
    data: Record<string, unknown>,
    metadata: Omit<AuditMetadata, 'timestamp'>
  ): Promise<void> {
    const action = `${entityType}.create` as AuditAction;
    await this.log({
      userId,
      action,
      entityType,
      entityId,
      changes: { after: data },
      metadata,
    });
  }

  async logUpdate(
    userId: string,
    entityType: EntityType,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    metadata: Omit<AuditMetadata, 'timestamp'>
  ): Promise<void> {
    const action = `${entityType}.update` as AuditAction;
    await this.log({
      userId,
      action,
      entityType,
      entityId,
      changes: { before, after },
      metadata,
    });
  }

  async logDelete(
    userId: string,
    entityType: EntityType,
    entityId: string,
    data: Record<string, unknown>,
    metadata: Omit<AuditMetadata, 'timestamp'>
  ): Promise<void> {
    const action = `${entityType}.delete` as AuditAction;
    await this.log({
      userId,
      action,
      entityType,
      entityId,
      changes: { before: data },
      metadata,
    });
  }

  async logEmergencyStop(userId: string, metadata: Omit<AuditMetadata, 'timestamp'>): Promise<void> {
    await this.logSync({
      userId,
      action: 'spam.emergency_stop',
      entityType: 'settings',
      metadata,
    });
  }
}

export const AuditService = new AuditServiceClass();
