---
id: MB-7
title: "E2E tests for the central login, the band picker and the logs page"
status: todo
sprint: backlog
points: 3
epic: testing
---

Cypress covers expenses, expense types, members, language and the band login page, but not
the flows added since: signing in at the central host and being handed off to the band, a
super admin choosing among bands, and the logs page. Some existing specs may be stale too (the
login spec expects an `h1` with "Contas").

- **Existing specs** pass again first, against the current app.
- **Google sign-in** is mocked: intercept the API's login call, never call Google.
- **Central login:** a member of one band is sent to that band; a member of several, or a super
  admin, picks one.
- **Logs:** the page lists entries and its filters and pagination work.

**Done when:** `npx cypress run` passes locally with the new specs.
