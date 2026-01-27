import { Schema, model, models, type Document, type Model, type Types } from 'mongoose';
import type { ISession } from '$types/session';

export interface SessionDocument extends Omit<ISession, '_id' | 'userId'>, Document {
  userId: Types.ObjectId;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'sessions',
  }
);

// TTL index to auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<SessionDocument> = models['Session'] || model<SessionDocument>('Session', sessionSchema);
