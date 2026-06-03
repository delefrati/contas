# contas

Expense tracking system with:

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

### Creating the First Admin User

After the first deployment, create the initial admin member:

```bash
# Local
./scripts/create-admin.sh 'Alice' 'alice@example.com'

# Production
COMPOSE_FILE=docker-compose.prod.yml ./scripts/create-admin.sh 'Alice' 'alice@example.com'
```
