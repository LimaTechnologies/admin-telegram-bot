# Domain: Infrastructure

## Last Update
- **Date:** 2026-01-29
- **Commit:** chore/external-services-config
- **Summary:** Configured external MongoDB and S3 services, added utility scripts

## Files

### Docker
- `docker-compose.yml` - Service orchestration
- `docker/dashboard/Dockerfile` - Next.js dashboard
- `docker/bot/Dockerfile` - Telegram bot service
- `docker/worker/Dockerfile` - BullMQ workers

### Configuration
- `.env` - Production environment variables
- `.env.local` - Development environment variables
- `tsconfig.json` - TypeScript configuration
- `next.config.ts` - Next.js configuration

### Scripts
- `scripts/create-s3-bucket.ts` - Creates S3 bucket for file storage
- `scripts/test-connections.ts` - Tests MongoDB and S3 connectivity

### Services
- `services/bot/` - grammY Telegram bot
- `services/worker/` - BullMQ job processors

### Queue System
- `common/queue/connection.ts` - Redis connection
- `common/queue/queues.ts` - Queue definitions

## Connections
- **database** - All services connect to MongoDB
- **api** - Dashboard exposes tRPC API
- **authentication** - Bot and workers share auth context

## Recent Commits
- Initial Docker and infrastructure setup

## Attention Points

### Docker Services
```yaml
services:
  dashboard:  # Next.js on :3000
  bot:        # grammY bot (webhook mode)
  worker:     # BullMQ processors (scalable)
  redis:      # Queue backend on :6379 (local)
  # mongodb:  # EXTERNAL: sparksglee.dental:8000
  # minio:    # EXTERNAL: s3.sparksglee.dental
```

### Queue Architecture
```
Per-Group Queues (Rate Limited)
├── post:group:{groupId} → 1 msg per cooldown

Per-Bot Queues (API Limited)
├── post:bot:{botId} → 30 msgs/second

System Queues
├── audit:log → Async audit logging
├── analytics:aggregate → Hourly aggregation
└── campaign:check → Status checks
```

### Environment Variables
```env
# Database (External MongoDB)
MONGODB_URI=mongodb://user:pass@sparksglee.dental:8000/tgadmin

# Redis (Local)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Auth
SESSION_SECRET=...
MAGIC_LINK_SECRET=...

# Email
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...

# Telegram
TELEGRAM_BOT_TOKEN=...

# Storage (External S3)
S3_ENDPOINT=https://s3.sparksglee.dental
S3_BUCKET=telegram-admin
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

### Gotchas
- Use bracket notation for env vars: `process.env['VARIABLE']`
- Redis connection uses singleton pattern
- Worker concurrency configurable via env
- Bot token stored in Settings model (single source)
- Gmail requires App Password (2FA must be enabled)
- MongoDB and S3 are EXTERNAL services (not in docker-compose)
- Run `bun run scripts/create-s3-bucket.ts` to create the S3 bucket
- Run `bun run scripts/test-connections.ts` to verify connectivity
