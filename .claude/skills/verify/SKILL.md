---
name: verify
description: Run minhabanda.com locally in an isolated Docker stack and drive the API/UI to verify a change at runtime.
---

# Verifying changes locally

## Start an isolated stack

Use a separate compose project so the developer's own `db_data` volume is untouched:

```bash
export COMPOSE_PROJECT_NAME=saverify
docker compose up -d --build db backend frontend
until curl -sf http://localhost:8001/api/health; do sleep 3; done
```

- The backend applies every Prisma migration on startup (check `docker compose logs backend`).
- Requests to `localhost` resolve to `DEFAULT_BAND` (`maverick`, created by the migrations).
- Ports: API `:8001`, frontend `:51731`, MySQL `:33061`.
- Seed with the real scripts (with `.env` sourced and `COMPOSE_PROJECT_NAME` exported):
  `scripts/create-band.sh`, `scripts/create-admin.sh`, `scripts/create-super-admin.sh`.

## Getting a session (gotcha)

Google login can't run locally: GSI rejects the `localhost:51731` origin ("The given origin
is not allowed"). Mint the same JWT that `AuthService.createToken` issues instead. `JWT_SECRET`
is empty in `.env`, so the backend falls back to `your-secret-key-change-in-production`:

```bash
docker compose exec -T backend node -e 'console.log(require("jsonwebtoken").sign(
  { memberId: 1, bandId: 1, name: "Ana" }, "your-secret-key-change-in-production", { expiresIn: "24h" }))'
```

Use `{ superAdminId: <id>, ... }` for a super admin. Also insert a matching `sessions` row if the
flow under test reads or deletes sessions (logout). Then call the API with
`Authorization: Bearer <token>`. For the UI, set `localStorage.auth_token` (plus
`auth_member`) on `http://localhost:51731` and open `/dashboard`.

## Flows worth driving

- `GET /api/auth/me`, `GET /api/members`, `POST /api/songs` and then `GET /api/logs` (checks the log author).
- `POST /api/auth/logout` and `/logout/all`, then inspect the `sessions` table.
- Error paths: `POST /api/auth/central/google` with a fake credential (expect 400),
  `/central/exchange` with a bad code (400), and a token for another band (401).

## Cleanup

```bash
COMPOSE_PROJECT_NAME=saverify docker compose down -v
docker image rm saverify-backend saverify-frontend
rm -rf .playwright-mcp   # Playwright MCP writes snapshots/screenshots here
```
