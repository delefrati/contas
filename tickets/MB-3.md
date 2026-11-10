---
id: MB-3
title: "Validate every request body with DTOs and a global ValidationPipe"
status: todo
sprint: backlog
points: 5
epic: security
---

Controllers take request bodies as plain TypeScript types (`@Body() body: { name?: string;
active?: boolean }`), which aren't checked at runtime, so a wrong type or an unexpected field
reaches the services and Prisma. Add `class-validator` and `class-transformer`, a global
`ValidationPipe` with `whitelist` and `forbidNonWhitelisted`, and a DTO class for every body.

- **Every controller:** admin, auth, band, event, event-type, expense, expense-type, member,
  song, calendar. Inline body types become DTO classes.
- **Unknown fields** are rejected with `400`, so a client can't set `bandId`, `id` or other
  columns the endpoint doesn't mean to take.
- **Limits:** lengths on text fields that match the database columns, and numeric ranges on
  amounts, so the error is a `400` and not a database error.
- **Uploads** (the band logo) keep their own checks.
- **The frontend** keeps working: check every form still sends only fields its endpoint takes.

**Done when:** each controller's tests show a body with a wrong type or an extra field gets
`400`; every form in the app still saves, checked with `/verify`.
