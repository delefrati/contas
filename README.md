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
