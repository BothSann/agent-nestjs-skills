---
name: nestjs-learn-write-lesson
description: Turn a picked NestJS learning ticket into a full lesson - build and test the complete solution in a separate Git worktree against its own Postgres lesson database, following project rules and the nestjs-best-practices skill, and write README.md, GUIDE.md, and check-yourself.md under learn/ in the main repo. Give step 1 only. Use when the owner says "write the lesson", "build lesson 04", "the ticket is ok, go on", or confirms a proposed ticket. Never writes the app code the owner should type in their checkout. Use nestjs-learn-pick-task to pick a task and nestjs-learn-coach to review typed code instead.
license: MIT
metadata:
  author: thannsopheakboth
  version: "1.0.1"
---

# NestJS Learn: Write the Lesson

The owner picked a task. `TICKET.md` exists. Now build the lesson they will follow.
Build the complete app solution in a separate lesson worktree, prove it there against a separate lesson database, then teach it one step at a time. Keep the lesson docs in the main repo's `learn/NN-slug/`.

Read these first:

- [references/hard-rules.md](references/hard-rules.md) — who writes what
- [references/layout.md](references/layout.md) — lesson files, status, kind
- [references/voice.md](references/voice.md) — plain English
- [references/project-config.md](references/project-config.md) — config fields and the lesson database
- [references/code-quality.md](references/code-quality.md) — **which rules the code must follow, and in what order.** The most important file for this skill.
- [references/review-rules.md](references/review-rules.md) — mistakes reviewers keep finding

## How It Works

1. **Read the ticket.** `learn/NN-slug/TICKET.md`. If `status` is not `proposed`, ask why before going on.
2. **Confirm decisions.** Show the "Decisions" table. Wait for "ok" or changes. Write the answers into the ticket.
3. **Load the rules.** Follow "Where the rules come from" in `code-quality.md`:
   - Run the scanner from `nestjs-learn-pick-task` (or reuse its JSON from this session). Take the paths from `qualitySources`. It sits next to this skill when both are installed: `<skills folder>/nestjs-learn-pick-task/scripts/scan-project.mjs <repo-root> --no-gh`.
   - Scanner not installed: find the same sources by hand. Use the config fields `rulesDirs`, `skillsDirs`, `guidelines`, `nestDocsPath`, or else the default places in `project-config.md`. List what you found in the GUIDE, and say the scanner was not run.
   - Read **every** project rule file (`qualitySources.rules`) and the guideline files.
   - Read one sibling file of each layer you will touch. Example: the current `auth.controller.ts` before a new controller, and the exception filter before writing error answers.
   - Map the ticket to `nestjs-best-practices` rule files with the table in `code-quality.md`. Read only those.
   - Check version-sensitive calls in the docs (`nestDocsPath` clone, else docs.nestjs.com) and in the installed `.d.ts` files.
4. **Prepare the worktree, lesson database, and baseline.** Follow [references/worktree-run.md](references/worktree-run.md). Record the starting commit, account for uncommitted changes, make the lesson database with [scripts/lesson-db.mjs](scripts/lesson-db.mjs), point every config at it, and run baseline tests before building.
5. **Build and prove the solution there.** Write the complete code and tests in the worktree. Prove every criterion and run the gates there. Never use the owner's database. See "Solution rules" below.
6. **Rule pass.** Read the diff again against every rule file from step 3. Fix, then prove again. See "Rule pass" in `code-quality.md`.
7. **Write the lesson files:**
   - `README.md` from [references/readme-template.md](references/readme-template.md)
   - `GUIDE.md` from [references/guide-template.md](references/guide-template.md), with the "Rules this lesson follows" table
   - `check-yourself.md` from [references/check-yourself-template.md](references/check-yourself-template.md): each answer right under its question
8. **Set status.** `TICKET.md` frontmatter `status: in-progress`.
9. **Give step 1 only.** Then stop and wait for "done", "stuck", or "check".

## Solution rules

- Work at the real app paths inside `<lessonWorktreesPath>/NN-slug/`. No `ref/` folder or second proof copy.
- Follow every project rule, then `nestjs-best-practices`, in the order in `code-quality.md`. The project rule wins a clash. Write each clash down in the GUIDE.
- Code a senior NestJS dev would merge. Not a short demo. The owner copies what they see.
- Strict types: no `any`, DTO classes for every body, response DTOs for every answer shape.
- Tests: one per acceptance criterion and per decision in the code. Unit tests with `Test.createTestingModule`. E2E tests with `supertest` against the lesson database, using the same app setup as `main.ts`.
- Use the same generators the owner will use, run from the app folder inside the worktree. The guide gives the exact `generator` command and shows the tested final code.
- Only the files this ticket needs. No extras "for later".
- Migrations: write and run them in the worktree. In the owner's app, write the same migration only when `standingExceptions` has `migrations` and the owner confirms. The owner runs it.
- Tests: write and run them in the worktree to prove the solution. Do not tell the owner to type them. Write tests in the owner's app only when the owner asks.
- TSDoc and Swagger decorators: add them in the worktree. The owner does not type them. Add them to the owner's files later, when `standingExceptions` allows it.
- Take GUIDE snippets and expected output from the tested solution. Record its location, baseline, changed files, and proof results in README and GUIDE.

## Step design

Break the work into steps the owner can finish in 5–15 minutes each.

| Step kind | Example |
| --- | --- |
| Read and decide | Step 0: read the ticket, confirm decisions |
| Branch | `git fetch origin` then `git switch -c feat/create-user origin/main` |
| Install | `npm install bcrypt` and `npm install -D @types/bcrypt` |
| Generate | `npx nest g module users` |
| Type one file | `create-user.dto.ts` |
| Wire it | add `UsersModule` to `imports` in `app.module.ts` |
| Migrate | owner runs `npm run migration:run` (agent wrote the file, if allowed) |
| Prove | curl for criterion 1 |
| Ship | gates, commits, PR |

- One file or one wire-up per step.
- Each step ends with a **check** the owner runs and sees: `npx tsc --noEmit`, a log line at startup (`Mapped {/api/v1/users, POST} route`), a curl, or one test.
- A check passes using only the steps done so far. The route log line shows only after the module is imported.
- Mark who does each step: "you type", "you run", "agent writes" (standing exceptions only).

## Present Results to User

After writing everything, say:

```markdown
## Lesson 04 is ready

- Ticket: `learn/04-create-user/TICKET.md` (decisions saved)
- Solution: `<lessonWorktreesPath>/04-create-user/`, 6 changed files. Starting commit: `<commit>`.
- Proven in the lesson worktree against `shop_lesson_04`: 6 of 6 criteria. 12 unit and 5 e2e tests pass. Lint 0, build 0.
- Rules read: 3 project rules; best practice `security-validate-all-input.md`, `api-use-dto-serialization.md`, `db-use-migrations.md`, `error-throw-http-exceptions.md`. Clashes: none.
- Not proven: nothing. (Or: "criterion 5 needs Redis, faked in tests, not run with curl.")

## Step 1: branch

<the step, from GUIDE.md, with the command in the owner's shell>

Check: `git status` says "nothing to commit".

Say **done**, **stuck**, or **check**.
```

## Rules for giving steps

- One step per message. Never paste the whole guide.
- Commands in the owner's `shell` from config.
- Do not paste the full solution into chat. Point to the guide step. The guide shows the code to type.
- Say plainly what was not run.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Cannot create the lesson database | Ask the owner to create it once, or to name an empty database. See worktree-run.md, step 3. |
| Prisma `migrate dev` wants a shadow database | Run `lesson-db.mjs prepare` and `create` with `--shadow`. Never let Prisma make its own random one. See worktree-run.md, step 6. |
| Tests still hit the owner's database | Stop. Find the config that wins (shell env var, `.env.test`, `envFilePath`, data source file). Fix it in the worktree. Prove the database name again. |
| `npm ci` fails | Lockfile out of date with `package.json`. Say so. Do not "fix" the lockfile in the owner's checkout. Use `npm install` in the worktree only, and record it. |
| `bcrypt` native build fails on Windows | `npm rebuild bcrypt` in the worktree, or propose `argon2` / `bcryptjs` as a ticket decision. |
| A criterion needs Redis, mail, S3, payments | Fake it in tests (`overrideProvider`), use a sandbox for curl. Say it was faked. |
| Project rule and ticket disagree | Stop. Ask the owner. Fix the ticket or the rule first. |
| Owner changed a decision after the solution was written | Update the worktree, rerun proof, and update GUIDE and check-yourself. |
