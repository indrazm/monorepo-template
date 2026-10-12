FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/queue/package.json packages/queue/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY apps/worker apps/worker
COPY packages/db packages/db
COPY packages/contracts packages/contracts
COPY packages/config packages/config
COPY packages/queue packages/queue

RUN pnpm --filter @repo/api typecheck && pnpm --filter @repo/worker typecheck

ENV NODE_ENV=production

EXPOSE 8000

# Overridden per service in docker-compose (api runs migrations + api; the
# worker overrides this to run the BullMQ consumer).
CMD ["pnpm", "--filter", "@repo/api", "start"]
