# Deployment

The API runs on Node.js under systemd. The web app deploys to Cloudflare with static assets and SPA fallback. The BullMQ worker runs separately with Redis.

## Local services

Development PostgreSQL and Redis come from the Nix flake, not a container runtime:

```sh
nix run .#dev-infra
nix run .#dev-infra -- status
nix run .#dev-infra -- down
```

PostgreSQL listens on `15432` and Redis on `16379`, with data in `.dev/`. Both match the defaults in `.env.example`. Override the ports with `PGPORT` and `REDISPORT`.

## Single machine

One Linux machine runs the API, the worker, PostgreSQL, Redis, and Caddy as a TLS reverse proxy. [infra/README.md](../infra/README.md) is the working guide; the short version is:

```sh
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars
terraform init && terraform apply

cd ../ansible
cp inventory.example.yml inventory.yml
cp group_vars/all.yml.example group_vars/all.yml
$EDITOR inventory.yml group_vars/all.yml
ansible-galaxy collection install -r requirements.yml
ansible-playbook site.yml
```

Before deploying:

- Use a unique auth secret of at least 32 characters. The database password must be URL-safe because it is embedded in `DATABASE_URL`.
- Set `api_domain` and point its DNS records at the server. Caddy requests the certificate.
- Set `client_origins` to comma-separated HTTP(S) frontend origins without paths.
- Review migrations before deploying. See [database rules](database.md).
- Supply the worker with its own runtime environment and `REDIS_URL` when it moves off this machine.

The playbook checks out `app_ref`, installs dependencies, applies committed migrations, and restarts `monorepo-api` and `monorepo-worker`. The web app is not served from this machine.

## Cloudflare web app

```sh
bunx --cwd apps/web wrangler login
bun run --filter @repo/web preview:cloudflare
VITE_API_URL="https://api.example.com" bun run deploy:web
```

`VITE_API_URL` is public and embedded at build time. The configured Worker name is `monorepo-template-web`. After configuring a custom domain, allow that origin in the API's `CLIENT_ORIGINS`.

Validate the deployment bundle without publishing:

```sh
bun run build
bun run deploy:dry-run
```
