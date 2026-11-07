# Project config

`learn/learn.config.json` holds personal facts. Preserve existing values, and adapt to the project rather than reshaping it.

| Field | Meaning |
|---|---|
| appRoot | Required. App folder from the repo root; `.` or e.g. `apps/api` |
| baseBranch | Required. Shipping target, e.g. `origin/main` |
| shell | Required. `powershell` or `bash` |
| baseUrl | Required. Local API URL with prefix and version |
| planDoc | Plan with endpoint tables and a "Build order" list, or checklists |
| docs | Other docs to read and scan for endpoints, e.g. business rules |
| gates | Required commands; default below |
| commitStyle | Message convention |
| lessonWorktreesPath | Default: sibling `<repo-name>-lessons` |
| standingExceptions | `["docs"]` or `[]` |

The package manager, test runner, and ORM come from the scan's `stack` line. Use them for every command: never `npm` in a pnpm or bun project, and never `bun test` when the runner is Vitest. Read `package.json` scripts before naming one.

Default gates, run from `appRoot` with the project's manager: `lint`, `build`, `test`, `test:e2e`, `arch`, and `arch:selftest`. Use only the scripts that exist, and prefer a project-required `check` script after reading what it runs. In a monorepo, use the manager's filter, such as `pnpm --filter api test`.

## Old config
The scan reports `blocker: old_config` for fields from nestjs-learn 1.x. Rewrite the file and show the diff: `appPath` becomes `appRoot`, `buildOrderDoc` becomes `planDoc`, and `endpointDocs` joins `docs`. Map `tsdoc` or `swagger` exceptions to `docs` and drop `migrations`. Drop the fields that are now detected or fixed: `sourceRoot`, `rulesDirs`, `skillsDirs`, `guidelines`, `nestDocsPath`, `packageManager`, `testRunner`, `orm`, `migrationCommand`, `databaseUrlEnv`, `generator`, and `ticketPrefix`.

## First run
Read `learn.mjs scan` output, `git symbolic-ref refs/remotes/origin/HEAD`, and `main.ts`, for the port, `setGlobalPrefix`, and versioning. Ask for the rest in one message, with your guesses as defaults. Then:
1. Write the config.
2. Run `git check-ignore learn/`. If it isn't ignored, tell the owner to add `learn/` to `.git/info/exclude`.
3. Scan again.

## Empty repo
With `no_nest_app`, the first lesson is `kind: scaffold`. With `no_commits`, give the owner the commands for a first commit, because worktrees need one. Default `appRoot` to `apps/api` if a frontend is planned, otherwise `.`. A scaffold uses pnpm, Nest 12, Prisma 7, Vitest, and Postgres, unless the owner chose otherwise.

## No plan
Offer to draft `docs/plan.md` with the owner, or use `idea-to-plan`. The owner owns and commits it. Use full paths:

```markdown
## 1. Identity
| Method | Path | Auth | Does |
|---|---|---|---|
| POST | `/api/v1/auth/register` | public | Sign up |

## Build order
1. Identity
```
