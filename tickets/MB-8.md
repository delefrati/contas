---
id: MB-8
title: "Run the Cypress specs in CI"
status: todo
sprint: backlog
points: 3
epic: testing
depends_on: [MB-7]
---

CI runs the unit tests only, so the Cypress specs rot unnoticed. Add a job that builds the
frontend, serves it with the API mocked as the specs already do, and runs `cypress run`.

- **No backend or database** in the job, if the specs mock the API; otherwise start the stack
  with `docker compose`.
- **Failures** upload the screenshots and videos as artifacts.

**Done when:** a CI run on `main` runs the specs and passes, and a broken spec fails the job.
