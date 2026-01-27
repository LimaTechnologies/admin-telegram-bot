import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, operatorProcedure } from '../trpc';
import { withAudit } from '../middleware/audit.middleware';
import { Creative, StorageService } from '@common';

const createCreativeSchema = z.object({
  name: z.string().min(1).max(200),
  media: z.object({
    type: z.enum(['image', 'video', 'text']),
    url: z.string().optional(),
    s3Key: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    duration: z.number().optional(),
  }),
  caption: z.string().min(1),
  ctaStyle: z.enum(['soft', 'hard']).default('soft'),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  isABTest: z.boolean().default(false),
  abTestVariant: z.string().optional(),
});

const updateCreativeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  caption: z.string().min(1).optional(),
  ctaStyle: z.enum(['soft', 'hard']).optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  isCompliant: z.boolean().optional(),
  complianceNotes: z.string().optional(),
});

export const creativeRouter = router({
  // List creatives
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        type: z.enum(['image', 'video', 'text']).optional(),
        isCompliant: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search, type, isCompliant, tags } = input;

      const filter: Record<string, unknown> = {};
      if (search) {
        filter['$or'] = [
          { name: { $regex: search, $options: 'i' } },
          { caption: { $regex: search, $options: 'i' } },
        ];
      }
      if (type) filter['media.type'] = type;
      if (isCompliant !== undefined) filter['isCompliant'] = isCompliant;
      if (tags?.length) filter['tags'] = { $in: tags };

      const [creatives, total] = await Promise.all([
        Creative.find(filter)
          .sort({ 'performance.performanceScore': -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('-__v'),
        Creative.countDocuments(filter),
      ]);

      return {
        data: creatives.map((c) => c.toObject()),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  // Get single creative
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const creative = await Creative.findById(input.id).select('-__v');
      if (!creative) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Creative not found' });
      }
      return creative.toObject();
    }),

  // Get all creatives (for selection)
  getActive: protectedProcedure.query(async () => {
    const creatives = await Creative.find({ isCompliant: true })
      .sort({ name: 1 })
      .select('_id name media.type');
    return creatives.map((c) => c.toObject());
  }),

  // Create creative (operator+)
  create: operatorProcedure
    .input(createCreativeSchema)
    .use(
      withAudit({
        action: 'creative.create',
        entityType: 'creative',
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const creative = await Creative.create({
        ...input,
        createdBy: ctx.session.userId,
      });
      return creative.toObject();
    }),

  // Update creative (operator+)
  update: operatorProcedure
    .input(updateCreativeSchema)
    .use(
      withAudit({
        action: 'creative.update',
        entityType: 'creative',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const creative = await Creative.findById((input as { id: string }).id);
          return creative;
        },
        getAfter: (_, result) => result,
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      const creative = await Creative.findByIdAndUpdate(id, data, { new: true }).select('-__v');
      if (!creative) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Creative not found' });
      }

      return creative.toObject();
    }),

  // Delete creative (operator+)
  delete: operatorProcedure
    .input(z.object({ id: z.string() }))
    .use(
      withAudit({
        action: 'creative.delete',
        entityType: 'creative',
        getEntityId: (input) => (input as { id: string }).id,
        getBefore: async (input) => {
          const creative = await Creative.findById((input as { id: string }).id);
          return creative;
        },
      })
    )
    .mutation(async ({ input }) => {
      const creative = await Creative.findById(input.id);
      if (!creative) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Creative not found' });
      }

      // Delete file from S3 if exists
      if (creative.media.s3Key) {
        await StorageService.deleteFile(creative.media.s3Key);
      }

      await creative.deleteOne();
      return { success: true };
    }),

  // Get presigned upload URL
  getUploadUrl: operatorProcedure
    .input(
      z.object({
        fileName: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await StorageService.getPresignedUploadUrl(
        input.fileName,
        input.mimeType,
        'creatives'
      );
      return result;
    }),

  // Get all tags
  getTags: protectedProcedure.query(async () => {
    const tags = await Creative.distinct('tags');
    return tags;
  }),

  // Get top performing creatives
  getTopPerforming: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ input }) => {
      const creatives = await Creative.find({ isCompliant: true })
        .sort({ 'performance.performanceScore': -1 })
        .limit(input.limit)
        .select('name media.type performance');
      return creatives.map((c) => c.toObject());
    }),
});
