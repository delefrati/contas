# TODO

## Organizations (multi-tenant)
- [ ] Add `Organization` model (id, name, logo, createdAt)
- [ ] Associate `User`, `Member`, `Expense`, `ExpenseType` to an organization
- [ ] Organization logo upload/storage
- [ ] Separate user management per organization (admins can only manage their own org's users)
- [ ] Organization switcher in the UI
- [ ] Seed/migration for existing data to a default organization

## Frontend Routing
- [ ] Add named routes for each dashboard tab (expenses, expense-types, members, logs)
- [ ] Deep-link support: navigating to `/expenses` opens the correct tab
- [ ] Redirect unauthenticated users to `/login` and preserve intended destination
- [ ] 404 page

## Unit Tests
### Backend (NestJS)
- [ ] Auth service: login, OIDC flow, token validation
- [ ] Expense service: CRUD, soft-delete, authorization checks
- [ ] ExpenseType service: CRUD, soft-delete
- [ ] Member service: CRUD
- [ ] Log service: query/filter

### Frontend (Vitest)
- [ ] `useAuth` composable
- [ ] Login page form validation
- [ ] Dashboard tab rendering

## Cypress (E2E)
- [ ] Login flow (local credentials)
- [ ] OIDC login flow (mocked provider)
- [ ] Create / edit / delete expense
- [ ] Create / edit / delete expense type
- [ ] Member management
- [ ] Log viewer pagination and filters
- [ ] Organization switching

## Security
- [ ] Enforce HTTPS in production (redirect HTTP → HTTPS)
- [ ] Add `helmet` middleware to NestJS (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting on auth endpoints (`@nestjs/throttler`)
- [ ] Rotate JWT secret via environment variable; document minimum entropy requirements
- [ ] Validate and sanitize all user inputs (class-validator DTOs on every endpoint)
- [ ] Scope JWT tokens to organization (add `orgId` claim; validate on every request)
- [ ] CSRF protection for cookie-based sessions
- [ ] Audit log: record who changed what and when (extend existing Log module)
- [ ] Dependency audit (`npm audit`) in CI pipeline
- [ ] Secrets management: move all credentials out of `.env` into a vault/secret manager for production
