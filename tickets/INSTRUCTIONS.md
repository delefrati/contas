# Writing a ticket for minhabanda.com

How a ticket is written in this project, for people and agents. The board is
[sprintdown](https://github.com/delefrati/sprintdown): run `sprintdown serve` in the repo root.
`sprintdown check` enforces the rules in `sprintdown.yml`: every ticket has `points` and an
`epic`, its points are 1, 2, 3, 5 or 8, and its body has a **Done when:** line.

## The frontmatter

- **ID:** the highest existing number plus one, as `MB-<n>`, in a file named `MB-<n>.md`. Never
  reuse an ID.
- **Sprint:** a new ticket goes in the backlog, `sprint: backlog`, until a sprint is planned.
- **Status:** `todo`.
- **Owner:** a GitHub handle, or left out while no one has it.
- **Points:** the ticket's size against others, not time:

  | Points | Size |
  |---|---|
  | 1 | A small fix or tweak |
  | 2 | One focused change |
  | 3 | A feature in one layer (backend or frontend), or a small one across both |
  | 5 | A feature across the backend and the frontend, with a migration |
  | 8 | Bigger than any done so far. Consider splitting it |

- **Epic:** one of the labels in use, such as `security`, `testing`, `frontend`, `agenda`,
  `songs`, `finance`, `members`, `admin` or `ops`. A new one is fine when none fits.
- **depends_on:** the tickets that must be done first, and only those.

## The body

- **What it delivers,** in a paragraph or two, and why.
- **A bullet for each case** the change has to handle, with the case in bold.
- **Done when:** one line, `**Done when:**`, that someone can check: what the tests show, what
  was checked in a browser (see the `/verify` skill), and which docs say so.
- **Band isolation:** a change that reads or writes band data says how it stays inside the
  band of the request's subdomain.
- **The docs that change with it,** such as the README or `DEPLOY-OCI.md`, are updated in the
  same change.
