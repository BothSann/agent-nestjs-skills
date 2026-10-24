<!-- Same file in all 3 nestjs-learn-* skills. Change the 3 copies together. -->

# Project config: `learn/learn.config.json`

Project facts live here, not in the skills. Same skills, any NestJS app.
`learn/` is git-ignored, so the config stays personal.

## Fields

| Field | Required | Means | Example |
|---|---|---|---|
| `appPath` | yes | folder with the app's `package.json` and `nest-cli.json`, relative to repo root | `apps/api` or `.` |
| `sourceRoot` | no | source folder inside `appPath`. Default: `sourceRoot` from `nest-cli.json`, else `src` | `src` |
| `lessonWorktreesPath` | no | root for lesson worktrees, outside the main repo. Default: sibling `<repo-name>-lessons` | `../shop-lessons` |
| `buildOrderDoc` | no | doc with the endpoint list and build order. Without it, tasks come only from best-practice rules. | `docs/api-scope.md` |
| `docs` | no | more docs to read when writing a lesson | `["docs/architecture.md"]` |
| `rulesDirs` | no | project coding rules (team lead or CTO). Win over everything else. | `[".claude/rules"]` |
| `skillsDirs` | no | folders that hold the `nestjs-best-practices` skill | `[".claude/skills"]` |
| `guidelines` | no | agent guideline files | `["CLAUDE.md"]` |
| `nestDocsPath` | no | local clone of `docs.nestjs.com`, for exact API checks | `C:/Users/me/Desktop/docs.nestjs.com` |
| `packageManager` | no | `npm`, `pnpm`, or `yarn`. Default: from the lockfile | `npm` |
| `orm` | no | `typeorm`, `prisma`, `drizzle`, `mikro-orm`, or `none`. Default: from `package.json` | `prisma` |
| `migrationCommand` | no | how the app applies migrations | `npm run migration:run` |
| `databaseUrlEnv` | no | env var with the Postgres URL. Default: `DATABASE_URL` | `DATABASE_URL` |
| `generator` | no | command prefix to make new files | `npx nest g` |
| `baseBranch` | yes | branch to start from and open PRs against | `origin/main` |
| `commitStyle` | no | example commit message | `feat(users): add me endpoint` |
| `ticketPrefix` | no | ticket id prefix. Default: `L-` | `SHOP-` |
| `shell` | yes | the owner's shell for commands | `powershell` or `bash` |
| `baseUrl` | yes | local API url for curl | `http://localhost:3000/api/v1` |
| `gates` | no | commands that must pass before a PR | see the examples |
| `standingExceptions` | no | what the agent may always write in the app | `["migrations", "tsdoc", "swagger"]` |

`standingExceptions` values:

| Value | Agent may write |
|---|---|
| `migrations` | migration files: a TypeORM migration class, or a Prisma `migration.sql`. Not Drizzle: there the owner runs `drizzle-kit generate`, so the journal stays right. The owner types the schema change and runs every migration. |
| `tsdoc` | TSDoc comments in the owner's files, after their code works |
| `swagger` | `@nestjs/swagger` decorators on DTOs and controllers |

## The lesson database

Each lesson uses its own Postgres database on the owner's server, next to the owner's database:

- Name: `<owner's database name>_lesson_<NN>`. Owner uses `shop`; lesson 04 uses `shop_lesson_04`.
- The URL is the owner's `databaseUrlEnv` value with only the database name swapped. User, password, host, and port stay the same.
- The agent creates it in the worktree step and may drop and recreate it. It never drops a database without `_lesson_` in its name.
- If the owner's database user cannot create databases, ask the owner to create it once (`createdb shop_lesson_04`), or to name another empty database for the lessons.

Each lesson uses `<lessonWorktreesPath>/NN-slug` for its complete solution. Real paths, starting commits, and proof results belong in the lesson docs, not in this config.

If `rulesDirs`, `skillsDirs`, or `guidelines` is missing, the scanner looks in the default places:
`.claude/rules`, `.cursor/rules`, `.ai/rules`, `.claude/skills`, `.agents/skills`, `~/.claude/skills`, `CLAUDE.md`, `AGENTS.md` (in the repo root and in `appPath`).
How the agent uses them: [code-quality.md](code-quality.md).

## Full example (monorepo, Prisma)

```json
{
  "appPath": "apps/api",
  "buildOrderDoc": "docs/api-scope.md",
  "docs": ["docs/architecture.md"],
  "rulesDirs": [".claude/rules"],
  "nestDocsPath": "C:/Users/me/Desktop/docs.nestjs.com",
  "packageManager": "pnpm",
  "orm": "prisma",
  "migrationCommand": "pnpm prisma migrate deploy",
  "generator": "pnpm nest g",
  "baseBranch": "origin/main",
  "commitStyle": "feat(users): add me endpoint",
  "ticketPrefix": "SHOP-",
  "shell": "powershell",
  "baseUrl": "http://localhost:3000/api/v1",
  "gates": ["pnpm lint", "pnpm build", "pnpm test", "pnpm test:e2e"],
  "standingExceptions": ["migrations", "tsdoc", "swagger"]
}
```

## Small app example (app at repo root, TypeORM)

```json
{
  "appPath": ".",
  "buildOrderDoc": "docs/scope.md",
  "orm": "typeorm",
  "migrationCommand": "npm run migration:run",
  "baseBranch": "origin/main",
  "shell": "bash",
  "baseUrl": "http://localhost:3000",
  "gates": ["npm run lint", "npm run build", "npm test"]
}
```

## Empty repo example (before `nest new`)

```json
{
  "appPath": ".",
  "baseBranch": "origin/main",
  "shell": "powershell",
  "baseUrl": "http://localhost:3000"
}
```

The scan reports `no_nest_app`. Lesson 01 is the scaffold lesson.
