FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache openssl \
  && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/platform/package.json apps/platform/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/worker/package.json packages/worker/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN DATABASE_URL="postgresql://postgres:postgres@postgres:5432/monorepo_template?schema=public" pnpm db:generate

CMD ["pnpm", "dev"]
