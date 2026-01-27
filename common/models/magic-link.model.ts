import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { IMagicLink } from '$types/magic-link';

export interface MagicLinkDocument extends Omit<IMagicLink, '_id'>, Document {}

const magicLinkSchema = new Schema<MagicLinkDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'magic_links',
  }
);

// TTL index to auto-delete expired magic links
magicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MagicLink: Model<MagicLinkDocument> = models['MagicLink'] || model<MagicLinkDocument>('MagicLink', magicLinkSchema);
