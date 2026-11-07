# Write a proven lesson

Build the complete solution in a separate worktree, then write docs from what was tested. Keep the project's stack and layout. Read [config.md](config.md) for gates.

## 1. Prepare
1. Read the ticket. Expect status proposed. Confirm open decisions, keeping answers already given.
2. Read project rules (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/`), sibling code in the layers you'll touch, and the `nestjs-best-practices` rules mapped in [check.md](check.md). Verify version-sensitive APIs against installed types. Report a missing source once.
3. Record `git status --short` and `git rev-parse HEAD`. Copy only needed uncommitted changes into the worktree, never secrets, `node_modules`, or `dist`. If a change is unclear, ask.

## 2. Worktree
Use `<lessonWorktreesPath>/NN-slug`, resolved and confirmed outside the repo:

```text
git worktree add --detach <path> <starting-commit>
```

If the folder exists, reuse it only if it belongs to this lesson and baseline. In `<path>/<appRoot>`, install from the lockfile: `pnpm install --frozen-lockfile`, `npm ci`, `bun install --frozen-lockfile`, or `yarn install --immutable`. Then run setup the app needs, such as `prisma generate`. Never link the owner's `node_modules`. A scaffold has no app yet, so run the same `nest new` and install commands the guide teaches, with `--skip-git`. `nest new .` refuses a folder that has a `README.md`: move it aside and back. Add `*.tsbuildinfo` to `.gitignore`.

## 3. Isolate services
Skip the database when the lesson doesn't use one, and record "database: not applicable". Otherwise start a throwaway Postgres with the project's major version:

```text
docker run --rm -d --name <repo>-lesson-NN -e POSTGRES_PASSWORD=lesson -e POSTGRES_DB=lesson -p 127.0.0.1::5432 postgres:<major>
docker port <repo>-lesson-NN 5432
```

Write a new worktree `.env` from `.env.example` with `DATABASE_URL` pointing at that port; never copy the owner's `.env`. Check every other source too: `.env.test`, `vitest.config.*`, `ConfigModule` `envFilePath`, `prisma.config.ts`, `drizzle.config.ts`, and shell variables. Before any server or test proof, print the effective database host and name the way the app loads config, without credentials, and confirm it's the container. Use fakes for mail and payments, and record each one. Pick a free port, and never touch the owner's server.

## 4. Build and prove
1. Run the existing tests first, and record baseline failures.
2. Write the solution at normal paths, with the same generator and install commands the guide teaches. Pin the major when adding a package (`prisma@7`). pnpm 11 runs install scripts only for packages in `allowBuilds` in `pnpm-workspace.yaml`, so add them first. Make schema changes with the project's migration tool, reviewing each file. Prisma 7: generate the client inside a layer, list it in `generatedDirs` in `.dependency-cruiser.cjs`, and run `prisma generate` after `migrate dev`.
3. Write tests for each criterion and refusal, following the `test-*` rules. Step checks name a test file, because a test file whose imports don't exist yet fails alone. Prove "at the same time" criteria with concurrent requests, e.g. `Promise.all` in an e2e test.
4. Review against the loaded rules, fix, and rerun. A new failure in an old test must be fixed, not hidden.
5. Run every gate in the worktree. Stop only servers you started, then `docker stop <repo>-lesson-NN`.

## 5. Write docs in `learn/NN-slug/`
1. Write README, GUIDE, and `check-yourself.md` from [templates.md](templates.md). GUIDE code comes from tested files.
2. Add first-seen TypeScript, Node, and Nest ideas to `learn/concepts.md`, using the format in [teach.md](teach.md). Check existing headings first.
3. Run `node <skill-dir>/scripts/learn.mjs guide-size learn/NN-slug/GUIDE.md`. Over the limit: split the ticket and rebuild the smaller slice. Never remove teaching to fit.

## 6. Start the lesson
1. Copy this lesson's test files into the owner's checkout. Never overwrite an existing file: if a shared file such as a test setup file changed, show the diff and let the owner apply it. Tests for a folder the lesson creates (the app, a module from `add-module`) are copied when giving the first step after it exists, and that step says so.
2. Set the ticket to in-progress. Disclose any incomplete proof.
3. Reply with the ticket and reference paths, baseline, changed-file count, criterion and gate results, rules and clashes, and limits. Then say: "Start a fresh session here to keep token use low, and say **start**." The owner may continue here if they prefer.
