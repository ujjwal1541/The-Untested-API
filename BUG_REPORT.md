# Bug Report — Task Manager API

All bugs below were found by writing tests against the documented behaviour first
and then running them against the original code. Each entry says where the bug
lives, why it happens, and what the fix is.

---

## BUG-1 — Status filter does a substring match (`GET /tasks?status=...`)

**Where:** `src/services/taskService.js`, `getByStatus`
```js
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

**Expected:** `?status=todo` returns only tasks whose status is exactly `todo`.

**Actual:** `String.prototype.includes` is a substring test, so:
- `?status=do` returns both `todo` **and** `done` tasks
- `?status=` (empty string) returns *every* task, because `''` is a substring of everything
- `?status=n_prog` returns `in_progress` tasks

**Why it happens:** the author reached for `includes` (array-style membership) but
`t.status` is a string, not an array, so it silently became a substring match.

**How I found it:** a unit test on `getByStatus` asserting that a partial value
like `'do'` returns nothing. It returned two tasks.

**Fix:** exact comparison `t.status === status`, plus validating the query param
in the route so an unknown status returns `400` instead of a misleading empty
list. **(Fixed.)**

---

## BUG-2 — Pagination is off by one page (`GET /tasks?page=1&limit=10`)

**Where:** `src/services/taskService.js`, `getPaginated`
```js
const offset = page * limit;
```

**Expected:** pages are 1-indexed (as the README's sample request implies), so
`page=1&limit=10` returns items 1–10.

**Actual:** with `page=1&limit=10` the offset is `10`, so the first page returns
items 11–20 — **the first ten tasks are unreachable through the API**. With
25 tasks, `page=3` returns an empty array while items 21–25 are never served.

**Why it happens:** 0-indexed offset arithmetic applied to a 1-indexed page
parameter. The route defaults `page` to `1` (`parseInt(page) || 1`), which makes
the bug hit the very first request.

**How I found it:** created 25 tasks, requested page 1, asserted `data[0].title
=== 'Task 1'`. Got `'Task 11'`.

**Fix:** `const offset = (page - 1) * limit;`, clamp `page`/`limit` to positive
integers, and return pagination metadata (`page`, `limit`, `total`,
`totalPages`) so clients can tell when they've reached the end. **(Fixed.)**

> Note: this changes the paginated response shape from a bare array to
> `{ data, page, limit, total, totalPages }`. That's a breaking change for any
> existing consumer, but the endpoint was unusable anyway and a paginated list
> without a total is not shippable. Non-paginated `GET /tasks` still returns a
> plain array, so the unpaginated contract is untouched.

---

## BUG-3 — Completing a task silently resets its priority

**Where:** `src/services/taskService.js`, `completeTask`
```js
const updated = { ...task, priority: 'medium', status: 'done', ... };
```

**Expected:** `PATCH /tasks/:id/complete` sets `status` and `completedAt`, nothing else.

**Actual:** a `high` priority task comes back as `medium` after being completed.
Silent data loss — nothing in the API surface hints at it.

**Why it happens:** looks like a copy-paste of the create defaults into the
completion payload.

**How I found it:** the happy-path integration test for `/complete` asserted the
whole returned task shape and `priority` didn't match what was created.

**Fix:** drop `priority: 'medium'` from the spread. **(Fixed.)**

---

## BUG-4 — `completedAt` drifts out of sync with `status` on `PUT /tasks/:id`

**Where:** `src/services/taskService.js`, `update` — a blind
`{ ...tasks[index], ...fields }` merge.

**Expected:** `completedAt` is a derived field: set when a task becomes `done`,
cleared when it's reopened.

**Actual:**
- `PUT` with `{ status: 'done' }` leaves `completedAt: null` — so `/complete`
  and `PUT` produce different task states for the same logical action.
- Reopening a completed task with `{ status: 'todo' }` keeps a stale
  `completedAt` timestamp, so it looks completed and open at once. `GET /stats`
  then reports it as potentially overdue while it still carries a completion time.

**How I found it:** a unit test round-tripping a task through
`done -> todo` and asserting `completedAt`.

**Fix:** derive `completedAt` inside `update` whenever `status` changes.
**(Fixed.)**

---

## BUG-5 — Mass assignment: `PUT /tasks/:id` can overwrite `id` and `createdAt`

**Where:** `src/services/taskService.js`, `update` — the same unfiltered merge,
combined with `validateUpdateTask` only checking four known fields and ignoring
everything else in the body.

**Expected:** server-owned identity fields are immutable.

**Actual:** `PUT /tasks/<id>` with `{ "id": "hacked" }` rewrites the task's id.
The task is then unreachable at its original URL, and two tasks can be given the
same id, which breaks `findById`, `update` and `remove` (they all take the first
match). Arbitrary junk keys are also persisted onto the task.

**How I found it:** an edge-case test that POSTs a hostile update body and
asserts `id`/`createdAt` are unchanged.

**Fix:** strip `id` and `createdAt` from the update payload before merging.
**(Fixed.)** A stricter version would whitelist updatable fields and reject
unknown keys with a `400` — I left that out because it's a behaviour change I'd
want product sign-off on.

---

## BUG-6 — `status` and pagination are mutually exclusive (silently)

**Where:** `src/routes/tasks.js`, `GET /`

The `if (status)` branch returns early, so `?status=todo&page=2&limit=5`
silently ignores paging and returns every matching task. A client paging through
a filtered list gets the full list on every request and never terminates.

**Fix applied:** the two params now compose. **Caveat, stated plainly:** the
current fix paginates first and filters the page, which is cheap but means a
page can come back partially filled. The correct fix is to filter the collection
and then slice it — that belongs in the service layer alongside a real query
API, which felt out of scope here. Called out rather than quietly shipped.

---

## Not fixed (reported only)

- **`GET /tasks?status=` with an empty value** now returns `400`. That's arguably
  better read as "no filter". A product decision, so I picked the strict reading
  and documented it.
- **No `Content-Type` enforcement.** `POST /tasks` with a form body reaches the
  validator as `{}` and returns a `title` error rather than `415`.
- **No ordering guarantee.** Tasks come back in insertion order, which is an
  accident of the array store, not a contract. Pagination without a stable
  `ORDER BY` is a bug waiting to happen once this hits a real database.
- **Unbounded `limit`.** `?limit=1000000` is accepted. Should be capped (e.g. 100).
- **`getStats` recomputes `overdue` on every call** against `new Date()` — fine
  now, a hotspot at scale.
- **Global mutable store.** `let tasks = []` in module scope means the service is
  a singleton; tests need `_reset()` between cases, and a `_`-prefixed export
  used only by tests is shipped in production code.
