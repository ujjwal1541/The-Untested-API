# Task Manager API Take-Home Submission

A small Express + in-memory-store Task Manager API, delivered as a 2-day take-home:
read unfamiliar code, add test coverage, find and fix bugs, and ship a new endpoint.

The original brief is in [ASSIGNMENT.md](./ASSIGNMENT.md). This README covers what
was actually built.

---

## 🔗 Live deployment

**Base URL:** [`https://the-untested-api.onrender.com`](https://the-untested-api.onrender.com)

Deployed on [Render](https://render.com) as a Node web service. Try it now:

```bash
curl https://the-untested-api.onrender.com/tasks/
```

>  **The data store is in-memory.** Every restart (deploys, or the free-tier
> instance spinning down on idle) wipes all tasks back to an empty list. This
> is expected — see the README's "Project structure" note below.

---

## Quick start (local)

```bash
cd task-api
npm install
npm start        # http://localhost:3000
npm test         # run the test suite
npm run coverage # run with coverage report
```

Node.js 18+. The data store is in-memory and resets on every restart — no
database setup required.

---

## What's in this submission

| Item | Where |
|---|---|
| Unit tests (service layer) | `task-api/tests/taskService.test.js` |
| Unit tests (validators) | `task-api/tests/validators.test.js` |
| Integration tests (Supertest) | `task-api/tests/tasks.routes.test.js` |
| Bug report (6 bugs, root-caused) | [`BUG_REPORT.md`](./BUG_REPORT.md) |
| Fixes | `task-api/src/**`, marked with `FIX (BUG-n)` comments |
| New endpoint | `PATCH /tasks/:id/assign` |
| Full write-up (coverage, design decisions, open questions) | [`SUBMISSION.md`](./SUBMISSION.md) |

**Test results:** 73 tests passing across 3 suites, ~98% statement coverage
(see [SUBMISSION.md](./SUBMISSION.md#coverage) for the full report).

---

## Project structure

```
task-api/
  src/
    app.js                  # Express app setup
    routes/tasks.js         # Route handlers
    services/taskService.js # Business logic + in-memory data store
    utils/validators.js     # Input validation helpers
  tests/                    # Unit + integration tests
  package.json
  jest.config.js
ASSIGNMENT.md               # Original brief
BUG_REPORT.md               # Bugs found, with code locations and root causes
SUBMISSION.md               # Coverage output, design decisions, open questions
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks` | List tasks. Supports `?status=`, `?page=`, `?limit=` (composable) |
| `POST` | `/tasks` | Create a task |
| `PUT` | `/tasks/:id` | Full update of a task |
| `DELETE` | `/tasks/:id` | Delete a task (204) |
| `PATCH` | `/tasks/:id/complete` | Mark a task complete |
| `GET` | `/tasks/stats` | Counts by status + overdue count |
| `PATCH` | `/tasks/:id/assign` | Assign (or unassign) a task — new in this submission |

### Task shape

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority": "low | medium | high",
  "assignee": "string | null",
  "dueDate": "ISO 8601 or null",
  "completedAt": "ISO 8601 or null",
  "createdAt": "ISO 8601"
}
```

> Note: the code uses `todo | in_progress | done`, not the `pending |
> in-progress | completed` vocabulary that appeared in the original README —
> see "What surprised me" in [SUBMISSION.md](./SUBMISSION.md) for why.

### Sample requests

Every command below is shown two ways:
- **bash / macOS / Linux / Git Bash**
- **PowerShell** (Windows) — note the backtick line-continuations and the
  escaped quotes inside `-d`; PowerShell's built-in `curl` is aliased to
  `Invoke-WebRequest`, so use `curl.exe` explicitly.

Replace `<base-url>` with either `http://localhost:3000` (local) or
`https://the-untested-api.onrender.com` (live), and `<id>` with a real task id
from a `GET /tasks` response.

---

**1. Create a task — `POST /tasks`**

bash:
```bash
curl -X POST <base-url>/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write tests", "priority": "high"}'
```

PowerShell:
```powershell
curl.exe -X POST <base-url>/tasks `
  -H "Content-Type: application/json" `
  -d '{\"title\": \"Write tests\", \"priority\": \"high\"}'
```

---

**2. List all tasks — `GET /tasks`**
```bash
curl <base-url>/tasks
```

**List tasks, filtered and paginated**
```bash
curl "<base-url>/tasks?status=todo&page=1&limit=10"
```
Valid `status` values: `todo`, `in_progress`, `done`.

---

**3. Get one task — `GET /tasks/:id`**
```bash
curl <base-url>/tasks/<id>
```

---

**4. Full update — `PUT /tasks/:id`**

bash:
```bash
curl -X PUT <base-url>/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"title": "Write more tests", "status": "in_progress", "priority": "medium"}'
```

PowerShell:
```powershell
curl.exe -X PUT <base-url>/tasks/<id> `
  -H "Content-Type: application/json" `
  -d '{\"title\": \"Write more tests\", \"status\": \"in_progress\", \"priority\": \"medium\"}'
```

---

**5. Mark complete — `PATCH /tasks/:id/complete`**

bash:
```bash
curl -X PATCH <base-url>/tasks/<id>/complete
```

PowerShell:
```powershell
curl.exe -X PATCH <base-url>/tasks/<id>/complete
```

---

**6. Assign / unassign a task — `PATCH /tasks/:id/assign`**

bash:
```bash
curl -X PATCH <base-url>/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "Ada Lovelace"}'
```

PowerShell:
```powershell
curl.exe -X PATCH <base-url>/tasks/<id>/assign `
  -H "Content-Type: application/json" `
  -d '{\"assignee\": \"Ada Lovelace\"}'
```

Send `{"assignee": null}` to clear the assignment. Empty/whitespace-only
names return `400`; an unknown task id returns `404`.

---

**7. Delete a task — `DELETE /tasks/:id`**

bash:
```bash
curl -X DELETE <base-url>/tasks/<id>
```

PowerShell:
```powershell
curl.exe -X DELETE <base-url>/tasks/<id>
```
Returns `204 No Content` on success (no response body).

---

**8. Get stats — `GET /tasks/stats`**
```bash
curl <base-url>/tasks/stats
```
Returns counts by status plus an `overdue` count:
```json
{ "todo": 2, "in_progress": 1, "done": 1, "overdue": 1 }
```

---

**Paginated list response shape**
```json
{ "data": [], "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
```

---

## Bugs found and fixed

Six bugs were found by writing tests against the documented behavior first,
then running them against the original code. Full detail (code locations,
root causes, fixes) is in [BUG_REPORT.md](./BUG_REPORT.md).

1. **Status filter used substring matching** (`includes()` instead of `===`) —
   `?status=do` matched both `todo` and `done`.
2. **Pagination was off by one page** — `page=1` skipped the first ten tasks;
   the offset used 0-indexed math against a 1-indexed page param. *(Highest
   priority — the only bug that made data permanently unreachable.)*
3. **Completing a task silently reset its priority** to `medium`.
4. **`completedAt` drifted out of sync with `status`** on `PUT` updates.
5. **Mass assignment** — `PUT` could overwrite a task's `id` and `createdAt`.
6. **`status` and pagination were mutually exclusive** — combining them
   silently dropped the pagination.

1–5 are fixed; 6 has a documented partial fix and caveat. A handful of
lower-priority issues (unbounded `limit`, no `Content-Type` enforcement, no
ordering guarantee) were found but reported rather than fixed — see the "Not
fixed" section of [BUG_REPORT.md](./BUG_REPORT.md).

---

## Design notes on `PATCH /tasks/:id/assign`

- `assignee` defaults to `null` (not absent) on new tasks, so clients never
  have to distinguish "missing" from "unassigned".
- Empty/whitespace-only strings are rejected (`400`); explicit `null` clears
  the assignment; omitting the field entirely is also a `400`.
- Reassigning an already-assigned task is allowed (last write wins) rather
  than returning `409` — see [SUBMISSION.md](./SUBMISSION.md) for the
  reasoning and its tradeoffs.
- Names are trimmed and capped at 100 characters.
- Validation runs before the existence check, so a malformed body returns
  `400` even for an unknown id.

---

## Deployment

Deployed on **Render** as a Node web service:

- **Root Directory:** repo root (no `task-api/` subfolder in this deployment)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment / Runtime:** Node
- **Environment variables:** none needed — `app.js` reads `process.env.PORT`,
  which Render injects automatically

Live URL: **https://the-untested-api.onrender.com**
Tasks endpoint: **https://the-untested-api.onrender.com/tasks/**

---

## Further reading

- [ASSIGNMENT.md](./ASSIGNMENT.md) — the original brief
- [BUG_REPORT.md](./BUG_REPORT.md) — bugs, root causes, fixes
- [SUBMISSION.md](./SUBMISSION.md) — coverage report, design decisions, what
  I'd test next, and open questions before shipping to production
