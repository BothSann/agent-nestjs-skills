# Scoring: which 3 tasks to offer

## 1. Make the candidate list

From the scan JSON:

| Source | Candidate |
|---|---|
| `blockers` has `no_nest_app` | The scaffold lesson. It is the only candidate. |
| `lessons` with `status: in-progress` and `mergedPr: null` | "Finish lesson NN" |
| `lessons` with a `mergedPr` | not a candidate. Its PR is merged. Ask the owner to mark it `done`. |
| `lessons` with `status: proposed` | "Start lesson NN" (ticket exists, no solution yet) |
| `endpoints.stubs` | Replace the stub with real code |
| `endpoints.missing` | Build the endpoint |
| `planTasks` with `done: false` | The earliest allowed task in the project's milestone plan, split into small slices if needed |
| Tables the doc needs but `tables` lacks | Entity or schema + migration (only if an endpoint needs it next) |
| `practices` with `missing` or `problem` | One practice lesson each, from [practice-tasks.md](practice-tasks.md), after you confirm the hint |

Group endpoints that must ship together. Example: `POST` and `DELETE /api/v1/users/:id/follow` share one table. Still offer them as separate tasks when each one stands alone.

## 2. Drop what cannot start yet

A task cannot start if what it needs is missing.

| Task | Needs |
|---|---|
| `POST /api/v1/auth/logout` | login |
| `GET /api/v1/users/me` | login (a guard that sets `request.user`) |
| `GET /api/v1/users/:id/posts` | `posts` table |
| `e2e-tests` practice | a database connection the tests can point at |
| `rate-limiting` practice on login | the login endpoint |

Read the endpoint's "Does" column and the build order to find these.

An explicit project plan wins over the scores below. Finish required foundation work before suggesting later API endpoints. Do not turn a whole milestone into one lesson. Checklist ticks are the plan's claims; confirm relevant evidence before calling a task built. If the plan says domain first, keep that order and use plain domain tests. Disabled CORS is valid for an API-to-API app; a `cors: n/a` hint is not a missing-security task.

## 3. Rank

| Signal | Score |
|---|---|
| Lesson `in-progress` | always first |
| In the earliest unfinished build order step | +3 |
| A stub route (half done, small) | +2 |
| Practice with status `problem` and a security rule (`security-*`) | +3 |
| Practice with status `problem`, other rules | +2 |
| Practice with status `missing` | +1 |
| Teaches a NestJS idea not in past lessons | +2 |
| Reuses a class the owner already built | +1 (practice) |
| Needs a new package | −1 (more setup, less NestJS) |
| Bigger than one endpoint, one table, or one rule | do not offer. Split it. |

Past lessons: read the `title` of each `done` lesson in the scan. Read their README "New words" only if you must check an idea is new.

## 4. Pick 3

- The top score is **next**.
- Options 2 and 3 should teach **different** ideas. Not three CRUD endpoints of the same shape.
- When both kinds exist, offer at least one endpoint and one practice.
- Mix sizes when you can: S = one file changed or a stub replaced. M = new entity + migration + endpoint, or a filter used by the whole app.

## Example

Scan says: users `POST` is a stub, login missing, `ValidationPipe` has no `whitelist`, no shutdown hooks, no lesson in progress.

| Candidate | Build step | Stub | Practice | New idea | Score |
|---|---|---|---|---|---|
| `POST /api/v1/users` | step 1 (+3) | yes (+2) | | DTO, `ConflictException` (+2) | 7 |
| `validation-pipe` problem | | | security problem (+3) | `whitelist` (+2) | 5 |
| `POST /api/v1/auth/login` | step 2 | no | | `@nestjs/jwt`, guards (+2), new package (−1) | 1 |
| `shutdown-hooks` missing | | | missing (+1) | lifecycle hooks (+2) | 3 |

Offer: create user (next), lock down `ValidationPipe`, shutdown hooks.
