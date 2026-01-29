// Database
export { connectDB, disconnectDB, mongoose } from './db';

// Models
export * from './models';

// Queue
export {
  getRedisConnection,
  closeRedisConnection,
  auditLogQueue,
  analyticsQueue,
  campaignCheckQueue,
  botTasksQueue,
  getPostQueue,
  closeAllQueues,
  QUEUE_NAMES,
} from './queue';

// Services
export { AuthService } from './services/auth.service';
export { EmailService } from './services/email.service';
export { AuditService } from './services/audit.service';
export { StorageService } from './services/storage.service';
export {
  getBot,
  getBotApi,
  getBotInfo,
  stopBot,
  isBotInitialized,
  getChatDetails,
  getBotPermissions,
  getChatMemberCount,
  syncGroupToDatabase,
  discoverAllGroups,
  handleBotAddedToGroup,
  handleBotRemovedFromGroup,
  handleBotPermissionsChanged,
} from './services/telegram.service';

// Campaign Posting
export {
  postCampaignMessage,
  postCampaignToAllGroups,
  scheduleCampaignPosts,
  resetRotationState,
  getRotationState,
} from './services/campaign-posting.service';

// Logger
export { logger } from './services/logger';
