import { router } from '../trpc';
import { authRouter } from './auth.router';
import { userRouter } from './user.router';
import { groupRouter } from './group.router';
import { campaignRouter } from './campaign.router';
import { creativeRouter } from './creative.router';
import { modelRouter } from './model.router';
import { casinoRouter } from './casino.router';
import { dealRouter } from './deal.router';
import { scheduledPostRouter } from './scheduledPost.router';
import { settingsRouter } from './settings.router';
import { auditRouter } from './audit.router';
import { analyticsRouter } from './analytics.router';
import { botAdminRouter } from './bot-admin.router';
import { queueRouter } from './queue.router';
import { purchaseRouter } from './purchase.router';

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  group: groupRouter,
  campaign: campaignRouter,
  creative: creativeRouter,
  model: modelRouter,
  casino: casinoRouter,
  deal: dealRouter,
  scheduledPost: scheduledPostRouter,
  settings: settingsRouter,
  audit: auditRouter,
  analytics: analyticsRouter,
  botAdmin: botAdminRouter,
  queue: queueRouter,
  purchase: purchaseRouter,
});

export type AppRouter = typeof appRouter;
