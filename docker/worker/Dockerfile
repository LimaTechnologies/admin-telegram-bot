# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy common and worker service
COPY common ./common
COPY types ./types
COPY services/worker ./services/worker
COPY tsconfig.json ./

# Build worker
WORKDIR /app/services/worker
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["bun", "run", "./dist/index.js"]
