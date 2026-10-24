<!-- Shared by all three nestjs-learn-* skills; update every copy. -->
# Project config

Personal facts: `learn/learn.config.json` at repo root. Preserve existing values. Adapt to any NestJS project: CRUD or DDD, root app or monorepo, existing manager/runner/ORM/auth/engine. Examples are not requirements. If detection fails, inspect project rules/scripts and report unknowns rather than reshaping the app.

## Fields
Required: `appPath`, `baseBranch`, `shell`, `baseUrl`. Other fields are optional.

| Field | Meaning / default |
|---|---|
| appPath | App folder relative to repo; "." or a custom workspace path |
| sourceRoot | Inside appPath; nest-cli.json sourceRoot, else src |
| lessonWorktreesPath | Outside-repo reference root; see layout.md |
| buildOrderDoc | Existing numbered plan or Markdown checklists; IDs optional |
| endpointDocs | Array of extra endpoint requirement docs; paths relative to repo |
| docs | Other task-relevant docs to read |
| rulesDirs | Project rule directories |
| skillsDirs | Directories containing nestjs-best-practices |
| guidelines | Agent/project guideline files |
| nestDocsPath | Local Nest docs clone; optional, otherwise official online docs |
| packageManager | Explicit npm/pnpm/yarn/bun; otherwise app/root packageManager, then lockfile (including bun.lock/bun.lockb) |
| testRunner | Override wrapped/custom runner; otherwise script, then app/workspace Jest/Vitest dependencies; null = unknown |
| orm | Existing tool: TypeORM, Prisma, Drizzle, MikroORM, Mongoose, none, or configured custom tool |
| migrationCommand | Existing migration script, if needed |
| databaseUrlEnv | PostgreSQL URL key for helper; DATABASE_URL by default |
| generator | Existing generator command prefix, e.g. pnpm exec nest g |
| baseBranch | Starting/shipping target, e.g. origin/main |
| commitStyle | Project message convention/example |
| ticketPrefix | L- by default |
| shell | Owner's shell, e.g. powershell or bash |
| baseUrl | Owner's local API URL, including prefix/version |
| gates | Required commands from project rules/scripts |
| standingExceptions | Allowed owner-app edits; absent values are off |

Exception values: `migrations` allows TypeORM migration classes or Prisma SQL (owner types schema and runs them). Drizzle migrations/journal/snapshot are generated together by the owner. `tsdoc` allows comments after working code; `swagger` allows matching decorators. Tests/fixes/named app items need the owner's explicit request.

Without configured paths, scanner searches repo/app `.claude/rules`, `.cursor/rules`, `.ai/rules`, `.claude/skills`, `.agents/skills`; global `~/.claude/skills` and `~/.agents/skills`; repo/app CLAUDE.md and AGENTS.md. See [code-quality.md](code-quality.md) for rule precedence.

## Commands follow the project
Inspect scripts (including nested ones), workspace scope, and installed tools first. Use the project's manager; never introduce another lockfile.

| Manager | Script | Installed tool | Isolated worktree install |
|---|---|---|---|
| npm | npm run SCRIPT -- ARGS | npx --no-install TOOL ARGS | npm ci --ignore-scripts |
| pnpm | pnpm run SCRIPT ARGS | pnpm exec TOOL ARGS | pnpm install --frozen-lockfile --ignore-scripts |
| yarn | yarn run SCRIPT ARGS | yarn run TOOL ARGS | Berry: yarn install --immutable --mode=skip-build; v1: --frozen-lockfile --ignore-scripts |
| bun | bun run SCRIPT ARGS | bun run TOOL ARGS | bun install --frozen-lockfile --ignore-scripts |

Bun + Vitest uses `bun run test`, not native `bun test`; native Bun projects keep their runner. Vitest uses `vi`, Jest uses `jest`; other runners keep their APIs. Use existing dev/gate scripts, not assumed names. Read-only compiler flags: `--noEmit --incremental false`.
An external `--config=FILE` permits read-only scanner trials; paths remain relative to the target. Trial facts are not owner-approved and do not authorize writing lessons.

## Lesson persistence
Only isolate storage when the task uses it. Otherwise record "database: not applicable". Keep the existing engine. The helper `lesson-db.mjs` accepts PostgreSQL URLs only; MongoDB, other SQL engines, or SQLite use native tools with a separate lesson database/file. Verify the app/tests' effective target, not just .env.

PostgreSQL: `<owner-db>_lesson_NN`, plus explicit Prisma shadow `<owner-db>_lesson_NN_shadow`. Preserve other URL parts. Create in worktree setup; never reset/drop the owner's target. If credentials lack creation rights, ask for an isolated database; do not bypass the boundary. Proof paths/results belong in lesson docs, never credentials in config.

Minimal config (add discovered optional facts):
```json
{
  "appPath": ".",
  "baseBranch": "origin/main",
  "shell": "powershell",
  "baseUrl": "http://localhost:3000"
}
```
