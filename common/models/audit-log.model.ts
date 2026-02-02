import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { IAuditLog, AuditChanges, AuditMetadata } from '$types/audit-log';

export interface AuditLogDocument extends Omit<IAuditLog, '_id' | 'userId'>, Document {
  userId: Types.ObjectId;
}

const auditChangesSchema = new Schema<AuditChanges>(
  {
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const auditMetadataSchema = new Schema<AuditMetadata>(
  {
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    route: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    success: {
      type: Boolean,
      required: true,
    },
    errorMessage: {
      type: String,
    },
  },
  { _id: false }
);

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String, // Can be MongoDB ObjectId string or Telegram ID
      index: true,
    },
    changes: {
      type: auditChangesSchema,
      default: () => ({}),
    },
    metadata: {
      type: auditMetadataSchema,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'audit_logs',
  }
);

// Indexes for querying
auditLogSchema.index({ 'metadata.timestamp': -1 });
auditLogSchema.index({ userId: 1, 'metadata.timestamp': -1 });
auditLogSchema.index({ action: 1, 'metadata.timestamp': -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, 'metadata.timestamp': -1 });
auditLogSchema.index({ 'metadata.success': 1 });

export const AuditLog: Model<AuditLogDocument> = models['AuditLog'] || model<AuditLogDocument>('AuditLog', auditLogSchema);
