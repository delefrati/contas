# API Examples - Contas Backend

This document provides practical examples of how to use the Contas API endpoints.

## Authentication Flow

### 1. Login with OIDC Provider

If you have an OIDC provider configured:

```bash
curl -X POST http://localhost:3000/api/auth/login/oidc \
  -H "Content-Type: application/json" \
  -d '{
    "oidcSub": "oidc-provider-user-id",
    "profile": {
      "email": "john@example.com",
      "displayName": "John Doe"
    }
  }'
```

Response:
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "member": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

### 2. Login with Email

```bash
curl -X POST http://localhost:3000/api/auth/login/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### 3. Use Token to Access Protected Endpoints

Store the token from login response, then use it:

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "data": {
    "memberId": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "oidcSub": "oidc-provider-user-id"
  }
}
```

### 4. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "message": "Logged out successfully"
}
```

### 5. Logout from All Devices

```bash
curl -X POST http://localhost:3000/api/auth/logout/all \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "message": "Logged out from all devices"
}
```

## Member Management

### Get All Members

```bash
curl -X GET http://localhost:3000/api/members
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "active": true,
      "oidcSub": "oidc-provider-user-id"
    }
  ]
}
```

### Get Member by ID

```bash
curl -X GET http://localhost:3000/api/members/1
```

### Update Member

```bash
curl -X PATCH http://localhost:3000/api/members/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

### Toggle Member Active Status

```bash
curl -X PATCH http://localhost:3000/api/members/1/toggle-active
```

## Expense Types

### Get All Expense Types

```bash
curl -X GET http://localhost:3000/api/expense-types
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Food",
      "deletedAt": null
    }
  ]
}
```

### Create Expense Type

```bash
curl -X POST http://localhost:3000/api/expense-types \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Transportation"
  }'
```

### Update Expense Type

```bash
curl -X PATCH http://localhost:3000/api/expense-types/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Public Transportation"
  }'
```

### Delete Expense Type

```bash
curl -X DELETE http://localhost:3000/api/expense-types/1
```

## Expenses

### Create Expense

```bash
curl -X POST http://localhost:3000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Team lunch",
    "amount": 120.50,
    "typeId": 1,
    "memberIds": [1, 2, 3]
  }'
```

### Get All Expenses

```bash
curl -X GET http://localhost:3000/api/expenses
```

### Get Expense Report by Member

This endpoint shows how much each member has spent:

```bash
curl -X GET http://localhost:3000/api/expenses/report/by-member
```

Response:
```json
{
  "data": [
    {
      "memberId": 1,
      "memberName": "John Doe",
      "totalAmount": 500.00,
      "count": 5
    },
    {
      "memberId": 2,
      "memberName": "Jane Doe",
      "totalAmount": 350.00,
      "count": 4
    }
  ]
}
```

### Delete Expense

```bash
curl -X DELETE http://localhost:3000/api/expenses/1
```

## Health Check

Check if the API is running:

```bash
curl -X GET http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

Example error response:
```json
{
  "statusCode": 400,
  "message": "Invalid email or password",
  "error": "Bad Request"
}
```

## Token Expiration

JWT tokens expire after 24 hours. When a token expires, you'll receive a 401 Unauthorized response. Simply login again to get a new token.

## Session Management

- Each login creates a new session in the database
- Sessions are tracked with an expiration time
- Logout removes the session from the database
- Expired sessions are automatically cleaned up (implement a cron job for this in production)

## Notes

- Replace `<token>` with the actual JWT token from login
- All timestamps are in ISO 8601 format
- Amounts are in decimal format with up to 2 decimal places
- OIDC integration requires proper configuration in environment variables
