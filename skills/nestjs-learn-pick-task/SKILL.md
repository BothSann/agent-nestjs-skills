---
name: nestjs-learn-pick-task
description: Scan a NestJS app (or an empty repo) and offer the owner 3 real tasks to learn from - endpoints from their scope doc, or best-practice gaps such as missing validation or graceful shutdown - then write the TICKET.md for the one they pick. Use when the owner is learning NestJS by building their own app and asks "what should I learn next", "give me a task", "next lesson", "pick a ticket", "what is left to build", or starts a new lesson. Reads learn/learn.config.json and runs a read-only scanner first. Do not use to write lesson code (nestjs-learn-write-lesson) or to review the owner's code (nestjs-learn-coach).
license: MIT
metadata:
  author: thannsopheakboth
  version: "1.0.1"
---

# NestJS Learn: Pick a Task

The owner learns NestJS by building a real app. They type the code. You teach.
This skill finds what is not built yet, or what the app does not do well yet, and offers 3 tasks to learn from.

**Facts first.** Do not suggest a task until the scan JSON exists.
Do not open source files to guess what is built. The scanner does that. Open a file only to confirm a practice hint before you offer it.

Read these before you write anything to the owner:

- [references/hard-rules.md](references/hard-rules.md) — who writes what. Never break these.
- [references/voice.md](references/voice.md) — plain English. Short sentences.
- [references/layout.md](references/layout.md) — lesson folders, status, and kind.

## How It Works

1. Check for `learn/learn.config.json` at the repo root.
   - Missing: follow [references/first-run.md](references/first-run.md). Stop until it exists.
2. Run the scanner. Save JSON to the scratchpad, not the repo.
3. Handle blockers (table below).
   - `summary.staleLessons` not empty: that lesson's PR is already merged, but `TICKET.md` still says `proposed` or `in-progress`. Say so ("Lesson 04: PR #6 merged"). Ask the owner to confirm, then set `status: done`. Never offer "finish lesson NN" for it.
4. Read the scan JSON and the `buildOrderDoc` "Build order" section. Nothing else yet.
5. Build the candidate list from three sources, and rank it with [references/scoring.md](references/scoring.md):
   - the scaffold lesson, when `no_nest_app`
   - endpoints: `endpoints.stubs` and `endpoints.missing`
   - practices: `practices` rows with `missing` or `problem`. Map each with [references/practice-tasks.md](references/practice-tasks.md). Confirm the hint by reading the file in its `evidence` first.
6. Offer 3. Mark one as **next**. Wait for the owner to pick.
7. Write `learn/NN-slug/TICKET.md` from [references/ticket-template.md](references/ticket-template.md), with `status: proposed` and the right `kind`.
8. Hand off. Tell the owner: say **"write the lesson"** to go on.

## Usage

```bash
node <this-skill-dir>/scripts/scan-project.mjs <repo-root> > <scratchpad>/scan.json
```

**Arguments:**
- `<repo-root>` — the folder with `learn/` (defaults to the current folder)
- `--no-gh` — skip `gh pr list`. Then stale lessons are not found. The scan asks GitHub because remote branches are often deleted after merge.

The scanner is read-only. It reads files with text search. It never starts the app, runs `npm`, or opens a database.
Logs go to stderr. JSON goes to stdout.

**Examples:**

```bash
# Monorepo, app in apps/api (appPath comes from the config)
node ~/.claude/skills/nestjs-learn-pick-task/scripts/scan-project.mjs C:/Users/me/Desktop/shop > "$SCRATCH/scan.json"

# No GitHub CLI
node ~/.claude/skills/nestjs-learn-pick-task/scripts/scan-project.mjs . --no-gh > "$SCRATCH/scan.json"
```

## Output

Main keys (full list in the script):

| Key | What it holds |
|---|---|
| `blockers` | problems to handle first |
| `app` | `path`, `sourceRoot`, `nestApp`, `globalPrefix`, `versioning`, `defaultVersion` |
| `stack` | `nestVersion`, `orm`, `packageManager`, `platform`, `testRunner`, known `packages`, `scripts` |
| `routes` | method, full path, handler, file:line, `stub` |
| `tables` | entities, Prisma models, Drizzle tables |
| `migrations` | TypeORM migration classes and SQL migration files |
| `classes` | per feature folder: controllers, services, dtos, entities, guards ... |
| `tests` | unit and e2e spec files and test counts. `unit.onlyDefault`: only the generated `app.controller.spec.ts` |
| `practices` | best-practice hints: `id`, `rule` (a `nestjs-best-practices` rule file), `status` (`ok`, `missing`, `problem`, `n/a`), `evidence`, `note` |
| `buildOrder` | numbered list under the "Build order" heading of `buildOrderDoc` |
| `endpoints.done` / `.stubs` / `.missing` | doc endpoints split by what the routes show |
| `lessons` | `learn/NN-*` folders with `status`, `kind`, `branch`, plus `mergedPr` when a merged PR matches |
| `qualitySources` | project rule files, the `nestjs-best-practices` skill (path, version, rule count), guideline files, `nestDocs` |
| `summary.nextLessonNumber` | number for the new lesson folder |

Short example:

```json
{
  "routes": [{ "method": "POST", "path": "/api/v1/users", "handler": "UsersController.create", "file": "src/users/users.controller.ts:12", "stub": true }],
  "endpoints": { "stubs": [{ "method": "POST", "path": "/api/v1/users" }], "missing": [{ "method": "POST", "path": "/api/v1/auth/login" }] },
  "practices": [{ "id": "validation-pipe", "rule": "security-validate-all-input", "status": "problem", "evidence": ["src/main.ts:9"], "note": "ValidationPipe without whitelist: true" }],
  "summary": { "endpointsStub": 1, "endpointsMissing": 14, "practicesMissing": ["shutdown-hooks"], "nextLessonNumber": 4 }
}
```

A **stub** is a route that exists but does no real work: it throws `NotImplementedException`, or it (or the service method it calls) returns the `This action adds a new user` text that `nest g resource` writes.
It counts as not built. It is often the best next task: small, and the route is already there.

## Blockers

| Blocker | Do this |
|---|---|
| `no_config` | Follow [references/first-run.md](references/first-run.md). |
| `no_git` | Ask the owner to run `git init`. Lesson worktrees need git. |
| `no_commits` | Worktrees need one commit. Ask the owner to commit something first (even a README). Give the commands. |
| `no_nest_app` | Empty repo, or `appPath` is wrong. Ask which. Empty: the only first task is the scaffold lesson. Wrong path: fix the config. |
| `no_build_order_doc` | Fine to go on with practice tasks. Offer to draft a scope doc with the owner (see first-run.md). |
| `no_best_practices_skill` | Fine to go on. Say lessons follow project rules and the review rules only. To add it: `npx skills add BothSann/agent-nestjs-skills --skill nestjs-best-practices`. |
| `router_module_prefixes` | The app uses `RouterModule.register()`. Its prefixes are not read, so route paths may be short. Endpoints are matched on the end of the path. Say so once. |

## Present Results to User

Use this shape. Plain words. Real paths.

```markdown
## Where the app is

- Built: 3 endpoints (`GET /api/v1/posts`, ...). 2 stubs (`POST /api/v1/users`, `DELETE /api/v1/users/:id`).
- Missing: 14 endpoints. Build order step 1 "Users" is not finished.
- Best-practice gaps: `ValidationPipe` has no `whitelist` (`src/main.ts:9`). No shutdown hooks. No health check.
- Lessons: 3 done. None in progress.

## Pick one

| # | Task | Kind | Size | You learn |
|---|---|---|---|---|
| 1 **next** | `POST /api/v1/users` — replace the stub | endpoint | S | DTO with `class-validator`, `ConflictException` on a used email, `bcrypt` |
| 2 | Lock down input: `whitelist` + `forbidNonWhitelisted` | practice | S | how `ValidationPipe` strips extra fields; why `role: "admin"` must not get through |
| 3 | `POST /api/v1/auth/login` | endpoint | M | `@nestjs/jwt`, a guard, `@HttpCode(200)`, rate limit on login |

Why 1 is next: build order step 1 is "Users". The route exists but returns the `nest g resource` text.

Say the number. I will write `learn/04-create-user/TICKET.md`.
```

Rules for the offer:

- Exactly 3 unless fewer exist.
- If a lesson is `in-progress`, the first option is **finish lesson NN**. Then 2 new ones.
- No Nest app yet: offer only the scaffold lesson, and say why.
- Each option is one small slice: one endpoint, one table, or one practice. Never "all of users".
- Mix kinds when you can: at least one endpoint and one practice, if both exist.
- "You learn" names real NestJS features, not vague ideas.

## After the Owner Picks

1. Folder: `learn/<nextLessonNumber padded to 2>-<kebab-slug>/`.
2. Write `TICKET.md` from the template. `status: proposed`. `kind`: `scaffold`, `endpoint`, or `practice`.
3. Open questions from the project docs that touch this task: propose an answer in "Decisions". The owner confirms.
4. Do not create a lesson worktree or write the solution, README, or GUIDE here. That is `nestjs-learn-write-lesson`.
5. End with: "Read the ticket. Change any decision you do not like. Then say **write the lesson**."

## Troubleshooting

| Problem | Fix |
|---|---|
| A route path looks wrong | Compare one route with `main.ts` (`setGlobalPrefix`, `enableVersioning`) and its `@Controller()`. Prefixes set in `RouterModule` or by a variable are not read. |
| All endpoints show missing | The doc paths and the routes differ in prefix or version. Compare one pair: doc `/api/v1/users`, route `/api/v1/users` matches. Doc `/users`: fix the doc or the config. |
| A practice hint is wrong | Hints come from text search. Read the evidence file. Drop the hint if the code already does it another way (for example `helmet` set up in a separate file the scan missed). |
| Lessons show `status: unknown` | Old lesson with no frontmatter. Ask the owner the status. Add frontmatter to its `TICKET.md`. |
| `bad JSON in learn.config.json` | Trailing comma or comment. JSON allows neither. |
