# GUIDE template

Write the full guide from the tested worktree, using the owner's shell/manager/scripts. Keep chat to one step.
Use this outline:

```markdown
# Guide: <task>

## Proof and solution workspace
<Resolved worktree/app paths, baseline commit, copied owner changes, every changed/new file, isolated storage or not applicable, exact commands, baseline/final outcomes, fakes and unrun criteria. No credentials.>

## The big idea
<Concrete before/after behavior and request/control flow.>

## Rules this lesson follows
| Choice | Rule | Source |
|---|---|---|
| <Implementation choice> | <Reason> | <Real rule file/heading> |

Clashes: <project rule that won, or none>.

## Words
<New technical terms with project examples.>

## Step N: <one file, command, or wiring change>
Who: <you type | you run | agent writes under a valid exception>

What: <the thing in one plain sentence, then its exact path or command>
Why: <the problem it solves in this app, what breaks without it, and the rule>
When: <when it runs (boot, each request, on error, shutdown, one-off command) and when you would reach for it again>
How: <exact generator/command and tested code, then one line per new idea in that code; plain TypeScript first when useful>
Check: <command and actual expected output>
```

## What, Why, When, How

Every step explains all four for a junior developer. Use this app's names, files, numbers, and errors. A part that could fit any app is too vague; rewrite it.

| Part | Answers | Concrete | Too vague |
|---|---|---|---|
| What | What is this thing, and where does it go? | `PrismaService` (`src/prisma/prisma.service.ts`): the one class that holds the database connection. Repositories ask Nest for it. | Create `prisma.service.ts`. |
| Why | What problem does it solve here? What breaks without it? | Without it, each repository calls `new PrismaClient()` and opens its own pool; Postgres runs out of connections (`api-data.md` #2). | It is best practice. |
| When | When does it run, and when would I write one again? | Once at boot: Nest calls `onModuleInit` before the app listens, and `onModuleDestroy` on shutdown. You write another only for a second database. | When needed. |
| How | What do I type or run, and what does each new line do? | The command, the code, then: `super({ adapter })` hands the `pg` driver to Prisma; `$connect()` in `onModuleInit` makes a wrong URL fail at boot. | Code with no notes. |

Filled example:

```markdown
## Step 7: `PrismaService`
Who: you type

What: `PrismaService` is the app's only database client: a Nest provider that extends `PrismaClient`. File: `src/prisma/prisma.service.ts` (new), exported from `PrismaModule`.
Why: one shared connection pool for the whole app. If each repository made its own `PrismaClient`, every one would open new connections, and a bad `DATABASE_URL` would only fail on the first query (`api-data.md` #2).
When: Nest creates it once at boot. `onModuleInit` connects before the app listens; `onModuleDestroy` disconnects on shutdown. Later lessons never create another; repositories inject this one.
How: `pnpm exec nest g service prisma --format`, then replace the class body with the code below.
- `extends PrismaClient`: your service *is* the client, so `this.prisma.user.findMany()` works.
- `config.getOrThrow('DATABASE_URL')`: reads the validated URL; no `process.env` here.
- `super({ adapter: new PrismaPg({ connectionString }) })`: Prisma 7 talks to Postgres through the `pg` driver.
Check: `pnpm exec tsc --noEmit --incremental false -p tsconfig.json` prints nothing.
```

Steps should take 5–15 minutes; a check must pass using only previous steps. No curl before module/controller wiring. Use the installed compiler with `--noEmit --incremental false` for read-only checks. Plain domain tests need no Nest container/database.
Explain Nest metadata/DI or generated SQL once when first relevant. Adapt sibling patterns instead of copying a sample service architecture. Show before/after for baseline-test fixes; tests in the owner app require a request.
Git/package/migration commands in the owner checkout are owner-run. End with configured gates, criterion proof, project commit style, and PR base. Mark any missing proof; never fabricate outputs.
