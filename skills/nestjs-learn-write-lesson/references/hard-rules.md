<!-- Same file in all 3 nestjs-learn-* skills. Change the 3 copies together. -->

# Hard rules

The owner is learning NestJS by typing the code by hand.
The agent is the teacher and reviewer. The agent is not the typist.

These rules hold in every step of every skill.

## Who writes what

| Thing | Who | Where |
| --- | --- | --- |
| App code (modules, controllers, services, DTOs, entities, ...) | owner types it | `appPath` from config |
| Complete lesson solution and its tests | agent | separate lesson worktree |
| Lesson text (TICKET, README, GUIDE, quiz) | agent | `learn/NN-slug/` |
| Migration files | agent (standing exception) | the app's migrations folder |
| TSDoc comments | agent, after owner's code works | owner's file, comments only |
| Swagger decorators (`@ApiProperty`, `@ApiOperation`, ...) | agent (standing exception) | owner's DTOs and controllers, decorators only |
| Unit and e2e tests | agent, only when owner asks | the app's `src/**/*.spec.ts` or `test/` |
| One named item after "you write it" | agent | that item only |

## Never

- Never create or edit app code the owner should type. Standing exceptions above are the only way in.
- Never run commands that change the owner's files, `node_modules`, or database. Give the command. The owner runs it.
  - The agent may generate, edit, install packages, migrate, and run gates in the separate lesson worktree, against the lesson database only.
  - Examples the owner runs in their checkout: `nest g resource users`, `npm install @nestjs/terminus`, `npm run migration:run`, `npx prisma migrate dev`, `npx drizzle-kit migrate`, `npm run lint -- --fix`, `npm run format`.
- Never touch the owner's database. The agent may create and drop **only** databases whose name ends in `_lesson_NN` (see `project-config.md`). Check the name before any `DROP` or reset.
- Never run `git` commands that change state in the app repo: `add`, `commit`, `switch -c`, `push`, `rebase`, `stash`.
  - Exception for lesson preparation: `git worktree add --detach` may register a separate lesson worktree at the recorded starting commit. It must not switch, stage, commit, or change files in the owner's checkout. Do not push or merge the lesson solution.
- Never edit a migration that already ran. Write a new one.
- Never commit `learn/`. It is git-ignored.
- Never put personal tools in the team's `.gitignore`. Use `.git/info/exclude`.
- Never print or copy secrets from `.env` into lesson docs or chat.

## Fine to run (read-only)

Commands below use npm as an example. Resolve the project's actual commands with [project-config.md](project-config.md), "Commands follow the project". A script is read-only only after checking what it runs, including nested scripts.

- `npx tsc --noEmit --incremental false -p tsconfig.json` in the owner's app. Keep `--incremental false`: a new Nest app has `"incremental": true` in `tsconfig.json`, and then `tsc` writes a `.tsbuildinfo` file even with `--noEmit`.
- `npm run lint` **without** `--fix`, when the lint script has no `--fix` in it. Check `package.json` first.
- `npm test -- <pattern>` and `npm run test:e2e`, only when their database target is not the owner's dev database. Check the test config first. When unsure, give the command to the owner.
- `git status`, `git diff`, `git log`
- `node <nestjs-learn-pick-task>/scripts/scan-project.mjs` (reads only)
- `GET` and `HEAD` curl calls to the owner's local server, when a step says to prove something. A curl that writes (`POST`, `PUT`, `PATCH`, `DELETE`) saves rows in the owner's dev database: give the command, the owner runs it and pastes the output.

## Tests

- Write tests in the lesson worktree to prove the solution. Do not write tests in the owner's app by default.
- Write unit or e2e tests in the owner's app only when the owner asks, like "check, write test".
- One ask covers that lesson only.

## Say what is proven

- The lesson solution counts as proven only when it ran in its worktree. When the lesson uses persistence, it must use the lesson database. For a pure domain or wiring lesson that needs no database, record the database as not applicable; do not create one just for proof. Record the starting commit, commands, results, and anything not run in the lesson docs.
- The owner's code counts as proven only when the owner's own run gives the right output.
- If something was not run, say so plainly.
