# Deployment infrastructure

Terraform provisions one server; Ansible configures it and deploys the application. Nothing runs in a container.

```text
Internet
  │  80/443
  ▼
Caddy ──► 127.0.0.1:8000  monorepo-api (systemd)
  │
  ├──► 127.0.0.1:6379   redis-server
  └──► 127.0.0.1:5432   postgresql
        monorepo-worker (systemd) ──► Redis
```

The web application is not served from this machine; it deploys to Cloudflare. See [deployment rules](../docs/deployment.md).

## Prerequisites

- Terraform 1.9 or newer.
- Ansible with the `community.postgresql` collection.
- A Hetzner Cloud API token with read and write access.
- An SSH key pair. The public key is installed for the `deploy` user.
- A domain or subdomain whose `A` and `AAAA` records point at the server address. Caddy obtains the certificates.

## Provision the machine

```sh
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars
terraform init
terraform apply
```

`terraform output` prints the address, an SSH command, and an inventory entry. Terraform keeps state in `infra/terraform/terraform.tfstate`, which is ignored by Git.

The firewall opens SSH only to `ssh_allowed_cidrs` and opens 80/443 to everyone. Restrict or remove the HTTP rules when Caddy is not in use.

## Configure and deploy

```sh
cd infra/ansible
cp inventory.example.yml inventory.yml
cp group_vars/all.yml.example group_vars/all.yml
$EDITOR inventory.yml group_vars/all.yml
ansible-galaxy collection install -r requirements.yml
ansible-playbook site.yml
```

The playbook installs Node.js 24 and Bun, PostgreSQL and Redis, checks out `app_repo` at `app_ref` into `app_dir`, writes `.env`, installs workspace dependencies, applies committed migrations, installs the `monorepo-api` and `monorepo-worker` units, and starts Caddy.

`inventory.yml` and `group_vars/all.yml` are ignored by Git because they hold addresses and secrets.

## Operations

| Task                  | Command                                         |
| --------------------- | ----------------------------------------------- |
| Redeploy a new commit | Set `app_ref`, then `ansible-playbook site.yml` |
| Apply a migration     | Included in the playbook                        |
| Follow the API log    | `journalctl -u monorepo-api -f`                 |
| Follow the worker log | `journalctl -u monorepo-worker -f`              |
| Restart the API       | `systemctl restart monorepo-api`                |
| Check the services    | `systemctl status monorepo-api monorepo-worker` |

## Notes and limits

- One machine means one point of failure and a restart during deployment. Scaling out is a later change.
- The database password is embedded in `DATABASE_URL`, so use a URL-safe value.
- Generate `better_auth_secret` with `openssl rand -base64 32`. Store it in an `ansible-vault` file if more than one operator needs access.
- The playbook runs `bun install --frozen-lockfile` on every run; it is idempotent and cheap.
- Committing a `.tf` file runs `terraform fmt` through the hk pre-commit hook.
- `domain`, `server_type`, `location`, and `image` are variables. Another provider means rewriting `terraform/main.tf`; the Ansible side stays the same.
