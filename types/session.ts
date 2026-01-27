import type { ObjectId, Timestamps } from './common';

export interface ISession extends Timestamps {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionContext {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}
