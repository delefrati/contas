---
id: MB-9
title: "Spike: where production secrets should live"
status: todo
sprint: backlog
points: 2
epic: ops
---

Production secrets (`JWT_SECRET`, the database passwords, Google's client secret, the
Cloudflare token) live in `.env` on the server and on the machine that deploys with
`scripts/sync-from-prod.sh`. Look at the options for this setup, a single OCI VM with Docker
Compose: Docker secrets, OCI Vault, an encrypted file (sops/age) in the repo, or keeping `.env`
with tighter permissions.

- **Cost and effort** for a one-server, one-person project.
- **What changes** in the deploy script and in `DEPLOY-OCI.md` for the chosen option.
- **Rotation:** how a secret is changed, and what it breaks (a new `JWT_SECRET` signs everyone out).

**Done when:** a short write-up in `DEPLOY-OCI.md` picks one option with its reasons, and a
follow-up ticket exists for the change if it's not keeping `.env`.
