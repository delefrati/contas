# minhabanda.com

Band management app ([minhabanda.com](https://minhabanda.com)) — calendar of shows and rehearsals with their setlists, songs, members and expenses — with:

- NestJS backend API with Prisma ORM
- MySQL database
- Vue.js frontend consuming the API
- Google OIDC authentication
- Docker Compose infrastructure

## Structure

- `/backend-nest`: NestJS API (TypeScript + Prisma)
- `/frontend`: Vue.js application
- `/mysql/init`: database initialization scripts
- `docker-compose.yml`: service orchestration

## User manual

The manual for members and super admins, in Portuguese, is in
[`frontend/src/manual/`](frontend/src/manual), one markdown file per part, starting with
[`entrar.md`](frontend/src/manual/entrar.md). The app shows it at `/ajuda`, signed out and
offline too, with a Help link on every screen; its screenshots are in
[`frontend/public/manual/`](frontend/public/manual).

**Every change to a screen's layout or behaviour updates the manual in the same commit:** the text
of its part and, if the screen looks different, its screenshots. To retake them:

```bash
scripts/manual-screenshots.sh                  # every screenshot
scripts/manual-screenshots.sh agenda evento    # only these
scripts/manual-screenshots.sh --keep           # and leave the stack up to take prints by hand
scripts/manual-screenshots.sh --down           # stop a stack left up with --keep
```

It starts a separate local stack (its own database; stop the dev stack first, they share the
ports), fills it with the made-up band "Os Exemplos" from
[`scripts/manual/seed.mjs`](scripts/manual/seed.mjs) (members, songs with lyrics, events with a
setlist, expenses and a super admin, with dates around today) and takes the screenshots listed in
[`scripts/manual/screenshots.mjs`](scripts/manual/screenshots.mjs) in the light theme. With
`--keep` it prints a line to paste in the browser console to sign in as Ana Souza. A new screen
in the manual gets a line in that list and a `![...](/manual/<name>.png)` in its part.

## Tickets

Work is planned in [`tickets/`](tickets), one markdown file per ticket, read by
[sprintdown](https://github.com/delefrati/sprintdown). With `sprintdown` on your `PATH`, run
`sprintdown serve` here for the board, and `sprintdown check` to validate the tickets. How to
write one is in [`tickets/INSTRUCTIONS.md`](tickets/INSTRUCTIONS.md).

## Getting Started

Create the environment file in the project root:

```bash
cp .env.example .env
```

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:51731
- Backend API: http://localhost:8001/api/health
- MySQL: localhost:33061

## Production Deploy (Oracle Cloud Free)

Files added for HTTPS deploy:

- `docker-compose.prod.yml`: production override (no public DB/backend exposure).
- `Caddyfile`: reverse proxy with automatic TLS for app and API.
- `.env.prod.example`: production environment variables.

Quick steps:

```bash
cp .env.prod.example .env
# edit .env with domain, ACME email and secrets
bash scripts/sync-from-prod.sh
```

The sync script builds images locally, uploads them to the server via SSH, and restarts services. Full guide: `DEPLOY-OCI.md`.

## Database Migrations

The project uses two complementary strategies:

- Prisma Migrate in the backend (applied automatically when the backend container starts).
- SQL in `mysql/init` for MySQL initialization on a fresh database.

### Fresh Database

Scripts in `mysql/init` are executed automatically by MySQL when the `db_data` volume doesn't exist yet.

### Existing Database

To apply versioned SQL files on an already-created volume:

```bash
bash scripts/apply-mysql-init-existing.sh
```

The script tracks already-applied files in the `schema_migrations` table to avoid reapplication.

### Manual Prisma (optional)

```bash
cd backend-nest
npm run migrate:status
npm run migrate:deploy
```

### Bands

Each band is served on its own subdomain (`<slug>.minhabanda.com`) and only sees its own
members, expenses, songs and events. The backend picks the band from the request host
(`BASE_DOMAIN`); locally, requests to `localhost` use `DEFAULT_BAND` (`maverick`).

Create a band and its first admin member:

```bash
# Local
./scripts/create-band.sh maverick 'Maverick' 'Alice' 'alice@example.com'

# Production
COMPOSE_FILE=docker-compose.prod.yml ./scripts/create-band.sh maverick 'Maverick' 'Alice' 'alice@example.com'
```

Add another admin to an existing band:

```bash
./scripts/create-admin.sh maverick 'Bob' 'bob@example.com'
```

Super admins manage the platform: they aren't members of any band (so they don't show up in
member lists or expense splits) but can sign in to every band. At the central login they
choose among all bands; in a band they also belong to, they sign in as that member.

```bash
./scripts/create-super-admin.sh 'Alice' 'alice@example.com'
```

With a super admin in place, the band's first member is optional:
`./scripts/create-band.sh maverick 'Maverick'`.

### Admin panel

Super admins also get an admin panel at `https://minhabanda.com/admin` (locally,
`http://localhost:<frontend port>/admin`). They sign in with Google there, and from it they can:

- create bands, with an optional first member, and rename, disable or re-enable them;
- add, edit and disable the members of any band;
- add and disable other super admins (but not themselves).

A disabled band keeps its data, but its subdomain stops resolving: nobody can sign in, and it
no longer gets a certificate. Changes made to a band show up in that band's log. Changes to
the platform itself (super admins, admin sign-ins) are logged without a band (`band_id` NULL).

Panel sessions are separate from band sessions: they last 8 hours, work only on the central
host, and end as soon as the super admin logs out or is disabled. The scripts above still work,
and you need `create-super-admin.sh` once to create the first super admin.
