# Worktree run: build and prove the complete solution

Use one separate Git worktree for both building and proof. Keep docs in the main repo's `learn/NN-slug/`. Commands below are examples: resolve paths from config and use the owner's shell.

Use the project's package manager, scripts, and runner for every command here; see [project-config.md](project-config.md), "Commands follow the project". Do not substitute npm for a Bun project or use `bun test` for Vitest. An existing `dev` script may replace the `start:dev` examples.

## 1. Record the starting state

Read the main repo's `git status --short` and `git rev-parse HEAD`. Use its current commit as the lesson baseline; `baseBranch` stays the owner's shipping target. If the ticket needs another starting point, settle that with the owner before building.

A new worktree has committed files only. Look at the owner's tracked changes and the untracked files that matter. Copy needed changes into the lesson worktree without changing, staging, or committing anything in the main checkout. Record which changes form the baseline, apart from the lesson changes. Do not copy secrets, `node_modules`, `dist`, or unrelated files as part of that baseline. If a change is unclear, ask which state the lesson should use.

## 2. Create the worktree

Resolve `lessonWorktreesPath` from config, default a sibling `<repo-name>-lessons` folder. Resolve its absolute path and confirm it is outside the main repo. Use `<lessonWorktreesPath>/NN-slug` for this lesson.

```text
git worktree add --detach <lesson-worktree-path> <starting-commit>
```

This registers the worktree in Git, and leaves the main checkout, index, and branch unchanged. No branch switch, commit, push, or merge is part of lesson preparation.

If the folder exists, check `git worktree list` and its status first. Reuse it only when it belongs to this lesson and matches the recorded baseline. Keep existing solution edits. Do not overwrite another folder, reset work, or remove a worktree automatically.

Apply any recorded baseline changes, then work from `<lesson-worktree-path>/<appPath>`.

### Scaffold lesson (empty repo)

The worktree has no app yet. Run the same command the guide will teach, inside the worktree:

```text
npx @nestjs/cli@latest new . --package-manager <packageManager> --skip-git --strict
```

`--skip-git` stops it from making a nested repo. Record the CLI version it used. Use that version in the guide.

## 3. Make the lesson database

If this ticket is pure domain logic or module wiring with no database use, record "database: not applicable" and skip database creation and migration steps. Run the relevant tests without adding database setup. Keep isolation checks for any other services the lesson actually uses.

Lesson database name: `<owner's database name>_lesson_<NN>`. Example: `shop_lesson_04`. See `project-config.md`.

Use [`scripts/lesson-db.mjs`](../scripts/lesson-db.mjs) in this skill. It never prints passwords or full URLs, works the same from PowerShell and bash, and refuses any name without `_lesson_<NN>`. It never drops anything.

```text
node <this-skill>/scripts/lesson-db.mjs prepare --main-app <repo>/<appPath> --worktree-app <worktree>/<appPath> --lesson 04 [--env DATABASE_URL] [--shadow]
node <this-skill>/scripts/lesson-db.mjs create  --worktree-app <worktree>/<appPath> [--env DATABASE_URL] [--shadow]
node <this-skill>/scripts/lesson-db.mjs check   --worktree-app <worktree>/<appPath> [--env DATABASE_URL] [--shadow]
```

1. `prepare` copies the main app's `.env` into the worktree (only when the worktree has none), and sets `databaseUrlEnv` to the same URL with the database renamed. It refuses unless `--worktree-app` is in the linked worktree from step 2: not the main app folder, not a folder inside the main checkout, not a plain folder or another clone. So it can never rewrite the owner's `.env`. With `--shadow` (Prisma), it also sets `SHADOW_DATABASE_URL` to `<name>_lesson_<NN>_shadow`. It prints the lesson database name.
2. `create` makes the database on the same server, with the app's `pg` package, or with `psql` when `pg` is not installed. Already there is fine. Run it after step 5 installs `node_modules`, so `pg` can be found.
3. Before any reset (`migration:revert`, `prisma migrate reset`, `DROP SCHEMA`), run `check`. It exits 1 unless the worktree points at a `_lesson_<NN>` database.
4. If `create` fails with `permission denied` or a login error, stop. Ask the owner to create it once (`createdb shop_lesson_04`) or to give another empty database. Record what was used.

The app reads its database from separate vars (`DB_HOST`, `DB_NAME`, ...) instead of one URL? Then set only the name var in the worktree `.env` by hand to `<name>_lesson_<NN>`, and create the database with `psql` or the owner's help.

No Postgres on this app (MongoDB, SQLite)? Use the same idea: a separate database or file named with `_lesson_<NN>`. Record it.

## 4. Prepare the worktree environment

`prepare` already set the database URL. In the worktree `.env`, also set:

```dotenv
PORT=<free port>
NODE_ENV=development
```

Check every place a database URL can come from, and make each one point at the lesson database:

- `.env.test`, `.env.e2e`, `test/setup*.ts`, `jest-e2e.json` `setupFiles`, `vitest.config.*`
- `ConfigModule.forRoot({ envFilePath })` in the app
- TypeORM data source files (`data-source.ts`, `ormconfig.*`) that read other env vars like `DB_HOST`, `DB_NAME`
- `prisma/schema.prisma` `url = env("...")`, `drizzle.config.ts`
- env vars already set in your shell, which win over `.env` in many setups

Then prove it twice:

1. `lesson-db.mjs check` says the worktree `.env` points at `<name>_lesson_<NN>`.
2. Run a one-line script in the worktree that loads config the way the app does (same `ConfigModule` options, same env files, same shell) and prints **only the database name**. It must also print `<name>_lesson_<NN>`. The `.env` alone is not proof: a shell env var or a test env file can win over it.

Other outside services:

| Service | In the worktree |
|---|---|
| Redis (cache, BullMQ, throttler storage) | another Redis db number (`/15`) or an in-memory fake. Never `FLUSHALL`. |
| Mail, SMS, payments | a fake provider in tests (`overrideProvider(...).useValue(...)`), and sandbox or log-only settings for curl proof |
| File storage (S3) | a local folder in the worktree, or a fake |
| Queues | run the worker in the worktree, or call the processor in tests |

Record each fake.

## 5. Install, then run the baseline

Install with the lockfile, only in the worktree:

| `packageManager` | Command |
|---|---|
| npm | `npm ci --ignore-scripts` |
| pnpm | `pnpm install --frozen-lockfile --ignore-scripts` |
| yarn | `yarn install --immutable --mode=skip-build` (Berry) or `yarn install --frozen-lockfile --ignore-scripts` (v1) |
| bun | `bun install --frozen-lockfile --ignore-scripts` |

Then run only the setup scripts the app needs, now that the environment points at the lesson database: `npx prisma generate`, native builds such as `bcrypt` (`npm rebuild bcrypt`). Never link or share the main app's `node_modules`.

Now create the lesson database (`lesson-db.mjs create`, step 3) and prove the target (step 4). Then apply migrations to the lesson database (`migrationCommand` from config, or the ORM's command). Run the existing tests for the areas the ticket touches: `npm test -- <pattern>`, `npm run test:e2e`. Record baseline results and failures that were already there.

## 6. Build the solution

Write the complete code at its normal app paths in the worktree:

- Run the same generator the guide will teach (`npx nest g module users`, `npx nest g controller users --no-spec`, ...). Record the exact command.
- New package? Install it in the worktree with the package manager. The guide tells the owner the same install command.
- Schema change: write the migration the way the app does, then apply it to the lesson database:

| ORM | Make the migration | Watch out |
|---|---|---|
| TypeORM | `npm run migration:generate -- src/migrations/<Name>` (the app's script) against the lesson database | Run `lesson-db.mjs check` first |
| Prisma | `npx prisma migrate dev --name <name>` | `migrate dev` needs a **shadow database**. Without one set, Prisma makes and drops its own, with a random name: that breaks the `_lesson_` rule and needs the CREATEDB right. Run `prepare` and `create` with `--shadow`, then point Prisma at `SHADOW_DATABASE_URL`: by a CLI flag if the installed version has one (`npx prisma migrate dev --help`), else in the worktree's `schema.prisma` (`shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`) or `prisma.config.ts`. That line is setup, not lesson code: undo it before you record the changed files, and leave it out of the guide. |
| Drizzle | `npx drizzle-kit generate`, then `npx drizzle-kit migrate` | `generate` needs no database. `migrate` reads `drizzle.config.ts`: check it reads the worktree `.env`. |
- Unit tests and e2e tests for every acceptance criterion and every decision in the code.

Run the migration, the baseline tests, and the new tests again. Fix what the lesson broke and put those changes in the guide. A new failure in an old test must not be passed off as a proven solution.

## 7. Prove each criterion and run gates

Start the lesson server only when curl proof needs it: `npm run start` (or `start:dev`) from the worktree app folder, with the lesson `PORT`. Reuse the owner's port only when it is free. Never stop the owner's server or send lesson requests to it. Check the lesson server answered: its log says `Nest application successfully started` and the port is the lesson port.

One curl, or a test, per criterion. Record real status codes and bodies for the GUIDE. For bearer tokens, take the token from the real login answer. For cookies, use a private cookie jar.

For "at the same time" criteria (unique email, one-time token), prove it with two requests at once, for example in an e2e test with `Promise.all`.

Run every command in `gates` from the worktree app folder. Run `git status` in the worktree too, so new untracked files appear in the changed-file list. Stop only the lesson server you started.

## 8. Record and keep the result

README and GUIDE get a "Solution workspace" section: worktree and app paths, starting commit, copied baseline changes, all changed files, the lesson database name, commands, baseline and final test results, gates, criterion results, fakes, and anything not run. Never include credentials or `.env` contents.

Example proof statement, using real results only:

> I ran this in the lesson worktree against `shop_lesson_04`. 6 of 6 criteria passed. 31 unit tests and 9 e2e tests passed. Lint and build gave 0 errors.

The worktree is the complete reference solution. Take guide snippets from its tested files, keep it while the owner learns, and do not merge, push, or delete it. If proof is not complete, say so before giving the owner step 1.
