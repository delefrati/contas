---
id: MB-5
title: "Run npm audit in CI"
status: todo
sprint: backlog
points: 1
epic: security
---

CI runs lint and tests, but nothing tells us when a dependency has a known vulnerability.
Add `npm audit --omit=dev --audit-level=high` to the backend and frontend jobs in
`.github/workflows/ci.yml`.

- **Production dependencies only,** so a dev tool's advisory doesn't block a deploy.
- **Fix what it finds** on the day it's added, or the first run fails.

**Done when:** CI runs the audit in both jobs and passes on `main`.
