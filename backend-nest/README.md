# Contas API - Backend

A NestJS-based REST API for expense tracking with JWT-based authentication.

## Features

- 🔐 JWT authentication with multiple login methods (OIDC and email)
- 📊 Expense tracking and management
- 👥 Member management
- 📝 Comprehensive activity logging
- 🗂️ Expense types and categorization
- 🔄 Multi-member expense tracking

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- Docker (optional, for containerized setup)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
DATABASE_URL="mysql://root:root@db:3306/contas"
NODE_ENV=development
PORT=3000
JWT_SECRET="your-secret-key-change-in-production"
OIDC_PROVIDER_URL="https://your-oidc-provider.com"
OIDC_CLIENT_ID="your-client-id"
OIDC_CLIENT_SECRET="your-client-secret"
```

### 3. Database Setup

Run migrations to set up the database schema:

```bash
npm run migrate:deploy
```

Check migration status:

```bash
npm run migrate:status
```

## Running the Application

### Development

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

### Production

```bash
npm run build
npm run start:prod
```

## API Documentation

### Authentication Endpoints

#### Login with OIDC
```http
POST /api/auth/login/oidc
Content-Type: application/json

{
  "oidcSub": "oidc-subject-id",
  "profile": {
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

Response:
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "member": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com"
    }
  }
}
```

#### Login with Email
```http
POST /api/auth/login/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "optional-password"
}
```

Response: Same as OIDC login

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

Response:
```json
{
  "data": {
    "memberId": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "roles": []
  }
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Logged out successfully"
}
```

#### Logout from All Devices
```http
POST /api/auth/logout/all
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Logged out from all devices"
}
```

### Member Endpoints

#### Get All Members
```http
GET /api/members
```

#### Get Member by ID
```http
GET /api/members/:id
```

#### Update Member
```http
PATCH /api/members/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```

#### Toggle Member Active Status
```http
PATCH /api/members/:id/toggle-active
```

### Expense Endpoints

#### Get All Expenses
```http
GET /api/expenses
```

#### Get Expense by ID
```http
GET /api/expenses/:id
```

#### Create Expense
```http
POST /api/expenses
Content-Type: application/json

{
  "description": "Lunch",
  "amount": 25.50,
  "typeId": 1,
  "memberIds": [1, 2]
}
```

#### Update Expense
```http
PATCH /api/expenses/:id
Content-Type: application/json

{
  "description": "Updated Description",
  "amount": 30.00
}
```

#### Delete Expense
```http
DELETE /api/expenses/:id
```

### Expense Type Endpoints

#### Get All Expense Types
```http
GET /api/expense-types
```

#### Create Expense Type
```http
POST /api/expense-types
Content-Type: application/json

{
  "name": "Food & Dining"
}
```

#### Update Expense Type
```http
PATCH /api/expense-types/:id
Content-Type: application/json

{
  "name": "Updated Name"
}
```

#### Delete Expense Type
```http
DELETE /api/expense-types/:id
```

## Database Schema

### members
- `id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(255))
- `email` (VARCHAR(255), UNIQUE, NULLABLE)
- `oidc_sub` (VARCHAR(255), UNIQUE, NULLABLE)
- `active` (BOOLEAN, DEFAULT: true)

### sessions
- `id` (INT, PK, AUTO_INCREMENT)
- `member_id` (INT, FK → members.id)
- `token` (VARCHAR(500), UNIQUE)
- `oidc_sub` (VARCHAR(255), NULLABLE)
- `expires_at` (DATETIME)
- `created_at` (DATETIME, DEFAULT: CURRENT_TIMESTAMP)

### expenses
- `id` (INT, PK, AUTO_INCREMENT)
- `description` (VARCHAR(255))
- `amount` (DECIMAL(12, 2))
- `fk_type` (INT, FK → expense_types.id, NULLABLE)
- `fk_member` (INT, FK → members.id, NULLABLE)
- `created_at` (VARCHAR(40))
- `deleted_at` (DATETIME, NULLABLE)

### expense_types
- `id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(255))
- `deleted_at` (DATETIME, NULLABLE)

### logs
- `id` (INT, PK, AUTO_INCREMENT)
- `action` (VARCHAR(50))
- `resource` (VARCHAR(100))
- `resource_id` (INT, NULLABLE)
- `details` (LONGTEXT, NULLABLE)
- `created_at` (DATETIME, DEFAULT: CURRENT_TIMESTAMP)
- `user_id` (INT, NULLABLE)

## Scripts

- `npm start` - Start production server
- `npm run start:dev` - Start development server with watch mode
- `npm run build` - Build for production
- `npm run migrate:deploy` - Deploy database migrations
- `npm run migrate:status` - Check migration status
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Generate test coverage

## Architecture

### Modules

- **AuthModule** - Authentication with JWT and OIDC support
- **MemberModule** - Member management
- **ExpenseModule** - Expense tracking
- **ExpenseTypeModule** - Expense type management
- **LogModule** - Activity logging
- **PrismaModule** - Database access layer

### Key Components

- **JWT Strategy** - Passport.js JWT authentication
- **Auth Service** - Login and token management
- **Auth Controller** - Authentication endpoints
- **Prisma ORM** - Database abstraction layer

## Development

### Code Quality

- ESLint for code linting
- Prettier for code formatting
- TypeScript for type safety

### Testing

Run the test suite:

```bash
npm test
```

With coverage:

```bash
npm run test:cov
```

## Docker

### Build Image

```bash
docker build -t contas-api .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://root:root@db:3306/contas" \
  -e JWT_SECRET="your-secret-key" \
  contas-api
```

### Docker Compose

See the root `docker-compose.yml` for the complete setup.

## Troubleshooting

### Database Connection Issues

- Ensure MySQL is running and accessible
- Verify `DATABASE_URL` in `.env` file
- Check credentials and network connectivity

### Migration Errors

- Run `npm run migrate:status` to check current state
- Review migration files in `prisma/migrations/`
- Reset database if needed (careful in production!)

### JWT Token Issues

- Ensure `JWT_SECRET` is set in `.env`
- Verify token hasn't expired (24h expiration by default)
- Check `Authorization: Bearer <token>` header format

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

UNLICENSED
