---
id: MB-4
title: "Add a Content-Security-Policy to the app"
status: todo
sprint: backlog
points: 3
epic: security
---

The `Caddyfile` sets HSTS, `nosniff`, `X-Frame-Options` and a referrer policy, but no
Content-Security-Policy, which is the header that limits the damage of an XSS. Add one for the
frontend, in Caddy's `security_headers` or in the frontend's `nginx.conf`.

- **Google sign-in:** the policy allows what Google Identity Services needs (`accounts.google.com`
  scripts, frames and styles).
- **Band logos and the offline copy:** images from the API and `blob:`/`data:` where the app
  uses them, and the service worker still installs.
- **Report first:** ship it as `Content-Security-Policy-Report-Only`, check the browser console
  on every page, then switch it to enforcing.
- **The API** answers JSON only, so it gets `default-src 'none'`.

**Done when:** the production build serves the header and every page (login, central login,
admin panel, agenda, phone view, songs, finance) works with it enforced and no CSP errors in
the console, checked with `/verify`; `DEPLOY-OCI.md` mentions it.
