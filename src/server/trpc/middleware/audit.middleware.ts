import { middleware } from '../trpc';
import { AuditService } from '@common';
import type { AuditAction, EntityType } from '$types/audit-log';

// Helper to safely convert mongoose documents to plain objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlainObject(doc: any): Record<string, unknown> | undefined {
  if (!doc) return undefined;
  if (typeof doc.toObject === 'function') {
    return doc.toObject() as Record<string, unknown>;
  }
  return doc as Record<string, unknown>;
}

interface AuditOptions {
  action: AuditAction;
  entityType: EntityType;
  getEntityId?: (input: unknown) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getBefore?: (input: unknown, ctx: unknown) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAfter?: (input: unknown, result: unknown) => any;
}

export function withAudit(options: AuditOptions) {
  return middleware(async ({ ctx, next, input, path }) => {
    const startTime = Date.now();

    // Get before state if needed
    let before: Record<string, unknown> | undefined;
    if (options.getBefore) {
      const beforeResult = await options.getBefore(input, ctx);
      before = toPlainObject(beforeResult);
    }

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      // Get after state if needed
      let after: Record<string, unknown> | undefined;
      if (options.getAfter && result.ok) {
        const afterResult = options.getAfter(input, result.data);
        after = toPlainObject(afterResult);
      }

      // Log successful action
      if (ctx.session) {
        await AuditService.log({
          userId: ctx.session.userId,
          action: options.action,
          entityType: options.entityType,
          entityId: options.getEntityId?.(input),
          changes: { before, after },
          metadata: {
            route: path,
            duration,
            success: true,
            ipAddress: ctx.req.ip,
            userAgent: ctx.req.userAgent,
          },
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed action
      if (ctx.session) {
        await AuditService.log({
          userId: ctx.session.userId,
          action: options.action,
          entityType: options.entityType,
          entityId: options.getEntityId?.(input),
          changes: { before },
          metadata: {
            route: path,
            duration,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            ipAddress: ctx.req.ip,
            userAgent: ctx.req.userAgent,
          },
        });
      }

      throw error;
    }
  });
}
