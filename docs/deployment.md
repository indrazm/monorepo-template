# Deployment

The API runs on Node.js. The web app deploys to Cloudflare with static assets and SPA fallback. The BullMQ worker runs separately with Redis.

## API and PostgreSQL

```sh
cp .env.example .env
openssl rand -base64 32
# Set BETTER_AUTH_SECRET in .env to the generated value.
docker compose up --build
```

Production Compose sets `NODE_ENV=production`, applies committed migrations, and exposes the API on port 8000. Set `API_HOST_PORT` to change the host port and `DOCKER_DATABASE_URL` to change the container's database connection. Compose includes the API and PostgreSQL; it does not start the web app, worker, or Redis.

- Use a unique auth secret of at least 32 characters.
- Set `BETTER_AUTH_URL` to the public API URL.
- Set `CLIENT_ORIGINS` to comma-separated HTTP(S) frontend origins without paths.
- Review migrations before deploying. See [database rules](database.md).
- Supply the worker with its own runtime environment and `REDIS_URL`.

## Cloudflare web app

```sh
pnpm --filter @repo/web exec wrangler login
pnpm --filter @repo/web preview:cloudflare
VITE_API_URL="https://api.example.com" pnpm deploy:web
```

`VITE_API_URL` is public and embedded at build time. The configured Worker name is `tacto-web`. After configuring a custom domain, allow that origin in the API's `CLIENT_ORIGINS`.

Validate the deployment bundle without publishing:

```sh
pnpm build
pnpm --filter @repo/web exec wrangler deploy --dry-run
```
