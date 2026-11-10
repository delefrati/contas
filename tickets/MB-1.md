---
id: MB-1
title: "Refuse to start without a strong JWT_SECRET"
status: todo
sprint: 1
points: 1
epic: security
---

`auth.module.ts` and `jwt.strategy.ts` fall back to `'your-secret-key-change-in-production'`
when `JWT_SECRET` isn't set, so a production backend started with a missing or mistyped
variable signs tokens with a secret anyone can read on GitHub, and they're valid on every band.

- **Missing secret:** the backend stops at startup with a message naming `JWT_SECRET`, instead
  of falling back. Read it in one place, used by both the module and the strategy.
- **Weak secret:** in production (`NODE_ENV=production`), a secret shorter than 32 characters
  or equal to the example values (`CHANGE_ME_LONG_RANDOM_SECRET`,
  `dev-secret-change-in-production`) stops it too. Development keeps working with `.env.example`.
- **Docs:** `.env.prod.example` and `DEPLOY-OCI.md` say how to make one
  (`openssl rand -base64 48`).

**Done when:** tests show startup fails with no secret and with a weak one in production, and
works with the dev example in development; the README or `DEPLOY-OCI.md` says how to set it.
