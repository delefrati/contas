---
id: MB-2
title: "Rate-limit the sign-in endpoints"
status: todo
sprint: backlog
points: 2
epic: security
---

Nothing limits how often the sign-in endpoints can be called: `POST /api/auth/login/google`,
`/api/auth/central/google`, `/api/auth/central/exchange` and the admin panel's
`/api/admin/auth/google`. Add `@nestjs/throttler` and limit those, by client IP.

- **Client IP behind Caddy:** the backend sees Caddy's address, so trust the proxy
  (`trust proxy`) and key the limit on the forwarded address, or every user shares one bucket.
- **Limits:** a few attempts per minute per IP on the sign-in routes; the rest of the API is
  left as is.
- **Over the limit:** a `429` the frontend shows as a "try again in a moment" message on the
  login pages, not as a generic error.

**Done when:** tests show the sign-in routes answer `429` after the limit and other routes
don't, and that two different forwarded IPs get their own limits; in a browser, the login page
shows the message.
