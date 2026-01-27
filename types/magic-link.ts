import type { ObjectId, Timestamps } from './common';

export interface IMagicLink extends Timestamps {
  _id: ObjectId;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}
