---
id: MB-6
title: "Show a not-found page for unknown addresses"
status: todo
sprint: backlog
points: 2
epic: frontend
---

The router has no catch-all route, so an address that matches nothing, such as a mistyped
`/agenda/abc` or an old link, shows an empty page. Add a `/:pathMatch(.*)*` route with a page
that says the address doesn't exist and links home.

- **Band subdomains:** the link goes to `/dashboard`; signed out, to the login.
- **Central host:** its guard already sends everything but the login and the admin panel to
  `CentralLogin`; keep that, and show the page for unknown `/admin/...` addresses.
- **Translations:** the text in every language in `frontend/src/i18n/locales`.

**Done when:** router tests show an unknown address lands on the page on a band subdomain and
under `/admin`; checked in a browser.
