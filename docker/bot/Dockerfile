# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy common and bot service
COPY common ./common
COPY types ./types
COPY services/bot ./services/bot
COPY tsconfig.json ./

# Build bot
WORKDIR /app/services/bot
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/bot/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["bun", "run", "./dist/index.js"]
