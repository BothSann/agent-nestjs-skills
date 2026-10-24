# First run: make `learn/learn.config.json`

Do this once per project. The field list is in [project-config.md](project-config.md).

## 1. Find what you can, without asking

Read-only checks:

| Field | How to find it |
|---|---|
| `appPath` | Folder whose `package.json` has `@nestjs/core`. Check `.`, `apps/api`, `api`, `backend`, `server`. None: the repo is empty, use `.`. |
| `buildOrderDoc` | The project's existing planning doc with a "Build order" list or Markdown checklists. Task IDs are optional. Keep its filename and structure. |
| `endpointDocs` | Separate requirement docs containing endpoint tables or backticked `METHOD /path` pairs. Do not require the task plan to repeat every endpoint. |
| `rulesDirs` | `.claude/rules/`, `.cursor/rules/` in the repo root or the app. |
| `packageManager` | Project rules, then app/root `package.json` `packageManager`, then `bun.lock` / `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`. |
| `orm` | `package.json`: `@prisma/client`, `drizzle-orm`, `typeorm`, `@mikro-orm/core`. |
| `migrationCommand` | `package.json` scripts with `migration` or `migrate` in the name. Prisma: `npx prisma migrate deploy`. Drizzle: `npx drizzle-kit migrate`. |
| `generator` | `npx nest g` (or `pnpm nest g`) when `@nestjs/cli` is in `devDependencies`. |
| `baseBranch` | `git symbolic-ref refs/remotes/origin/HEAD` |
| `gates` | Project-required commands and existing scripts. Prefer the required aggregate `check` plus `build` when present; inspect what `check` runs. Use `bun run` for Bun, including Vitest tests. |
| `baseUrl` | `main.ts`: port in `app.listen(...)`, `setGlobalPrefix(...)`, and versioning. Example: `http://localhost:3000/api/v1`. |
| `nestDocsPath` | Ask. Many owners have no local clone; then leave it out. |
| `shell` | Windows: `powershell`. Else `bash`. |

## 2. Ask the owner the rest

Ask in one message. Offer your guess as the default.

Example:

```markdown
I need a few facts. My guesses are in bold. Say "ok", or fix the ones that are wrong.

1. App folder: **apps/api**
2. Scope doc with the endpoint list: **docs/api-scope.md** (or none: then tasks come from best practices only)
3. Start branches from: **origin/main**
4. Your shell: **powershell**
5. Local API url: **http://localhost:3000/api/v1**
6. Database: **Postgres, URL in `DATABASE_URL`**. Each lesson gets its own database next to yours, like `shop_lesson_04`. Can your database user create databases?
7. Things I may always write in your app for you: **migration files, TSDoc comments, Swagger decorators**
8. A local clone of docs.nestjs.com? **none**
```

## 3. Write the file

- Path: `learn/learn.config.json`.
- Check `learn/` is git-ignored: `git check-ignore learn/`. If not, tell the owner to add `learn/` to `.git/info/exclude`. Do not edit the shared `.gitignore`.
- Then run the scanner again.

## Empty repo

The scan says `no_nest_app` (and maybe `no_commits`).

- Worktrees need one commit. If there is none, give the owner the commands to make one (a README is enough). They run them.
- The first lesson is the scaffold lesson (`kind: scaffold`): `nest new`, a first route, `ConfigModule`, a global `ValidationPipe`, and the database connection. See [practice-tasks.md](practice-tasks.md), "Scaffold lesson".
- Write the config with `appPath: "."` unless the owner wants the app in a sub-folder like `apps/api`.

## No scope doc?

The scanner needs a list of endpoints to find which endpoints are missing. Without one, use the existing milestone plan and practice hints, or draft an endpoint scope doc first. Do not replace a project task plan just because it is not an endpoint table.

- Offer to draft `docs/api-scope.md` with the owner: a table per area with `Method | Path | Auth | Does`, and a "Build order" numbered list.
- Use the full path the app answers on, with prefix and version: `/api/v1/users`, not `/users`.
- The owner owns the doc. Draft it, show it, let them change it. They commit it.

```markdown
## 1. Users

| Method | Path | Auth | Does |
|---|---|---|---|
| POST | `/api/v1/users` | public | Sign up. |
| GET | `/api/v1/users/me` | user | Current user. |

## Build order

1. Users
2. Auth
```
