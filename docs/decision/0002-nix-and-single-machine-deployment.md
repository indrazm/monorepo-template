---
status: accepted
date: 2026-11-24
supersedes: []
superseded_by: null
---

# 0002: Nix for the toolchain and services, Terraform and Ansible for one machine

## Context

Docker provided both sides of the environment. `docker-compose.dev.yaml` started PostgreSQL and Redis for development, and `Dockerfile` plus `docker-compose.yaml` built and ran the API. That meant a container runtime on every developer machine and on the server, a second description of installed software, and a Compose-only environment surface (`DOCKER_DATABASE_URL`, `API_HOST_PORT`) that the application never read.

The repository already targets a single Linux machine per deployment: one API process, one worker, PostgreSQL, and Redis. A cluster, container scheduler, or managed database is out of scope.

Nix covers the local side without a daemon: `devShells.default` provides Bun, Node.js 24, PostgreSQL, and Redis, and one app starts the two services with data under `.dev/`.

## Decision

Docker is removed. `flake.nix` defines the toolchain and local services; Terraform and Ansible describe the deployment.

- `nix develop` provides Bun, Node.js 24, PostgreSQL, and Redis. `.env.example` keeps the development ports `15432` and `16379` so local services do not collide with anything already listening.
- `nix run .#dev-infra` starts PostgreSQL (with the `monorepo_template` database) and Redis from `.dev/`; `nix run .#dev-infra -- status` and `-- down` inspect and stop them. The script is `tooling/dev-infra.sh` and needs no Nix-specific behavior, so it also runs from the dev shell.
- `infra/terraform` creates one Hetzner Cloud server, its SSH key, and a firewall that opens 22 to configured CIDRs and 80/443 to the world. Cloud-init creates the unprivileged `deploy` user. The provider and server type are variables, so another provider is a rewrite of `main.tf` alone.
- `infra/ansible` configures that machine: Node.js 24 from NodeSource, Bun for the application user, PostgreSQL and Redis on the loopback interface, the repository checkout, `.env` from variables, migrations, systemd units for the API and worker, and Caddy for TLS.
- The application still runs on Node.js. Bun installs dependencies and starts the scripts that systemd supervises.

## Alternatives

- Keep Compose for development and deployment: no migration work, but it keeps a container runtime in both environments and a second source of truth for installed software.
- NixOS with a flake-based system configuration: the strongest reproducibility, but it requires NixOS images and a `nixos-rebuild` workflow, which is a larger commitment than a single Ubuntu machine.
- Kubernetes or a container platform: unnecessary for one machine and one process per service.

## Consequences

Benefits: no container runtime, one toolchain definition for development and CI, services that behave the same locally and on the server, and a deployment that is a readable playbook rather than layer cache behavior.

Costs and limits:

- The playbook assumes Debian or Ubuntu with `apt`, `systemd`, and the `community.postgresql` collection.
- One machine is a single point of failure. There is no zero-downtime rollout: `app_ref` changes restart the API and the worker.
- Ansible installs Node.js and Bun outside Nix, so the server's toolchain comes from upstream installers while development comes from the flake.
- Secrets live in `infra/ansible/group_vars/all.yml` (ignored by Git); `ansible-vault` is optional and not wired up.
- The Terraform state is local and ignored by Git. A shared backend is required before more than one operator applies changes.
- The web application still deploys to Cloudflare; the machine serves the API and the worker only.

## Status history

| Date       | Status   | Reason                                          |
| ---------- | -------- | ----------------------------------------------- |
| 2026-11-24 | accepted | Docker replaced by Nix, Terraform, and Ansible. |
