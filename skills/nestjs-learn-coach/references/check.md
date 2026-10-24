# "check" and "check and fix"

## "check": read-only review

1. Read the owner's files for this step or lesson. Use `git diff` against the base branch, plus `git status` for new files.
2. Run read-only checks: `npx tsc --noEmit --incremental false -p tsconfig.json`, `npm run lint` without `--fix` (check the script first), the scanner for route paths and stubs ([next-step.md](next-step.md), "Check a route"), a `GET` curl to their local server. A curl that writes (`POST`, `PUT`, `PATCH`, `DELETE`): give the command, the owner runs it and pastes the output. Run their tests only when they cannot hit the owner's dev database (see hard-rules.md).
3. Compare with the ticket's criteria, then the rules in the order in [code-quality.md](code-quality.md): project rules first, then [review-rules.md](review-rules.md), then the `nestjs-best-practices` rule files mapped to the layers the owner touched. The lesson solution is a guide, not the only valid answer.
4. Report in this order:

| Order | Section | What goes in it |
|---|---|---|
| 1 | Right | What works and follows the rules. Be specific. |
| 2 | Breaks | Bugs, wrong status codes, missing validation, leaks, security holes. File:line + why. |
| 3 | Style | Rule breaks from `rulesDirs`, names, types, lint. File:line + rule file. |

- Name the file and line. Say why. **Do not fix it.**
- If their way works and follows the rules, say so, even if the lesson solution is different.
- Say what you ran and what came out. Say what you did not run.

## "check and fix"

Same review. Then fix what is wrong in the app.

- Fix only what the review found. Nothing else.
- Then report a table so the owner learns from it:

```markdown
| File:line | Was | Now | Why |
|---|---|---|---|
| `src/users/users.service.ts:21` | `return this.users.save(user);` | `return UserResponseDto.from(await this.users.save(user));` | The entity has `passwordHash`. The DTO sends only `id`, `email`, `createdAt`. |
```

- Run the check again after the fix. Report the result.

## What to look for (NestJS)

Quick list. The full rules are in the files `code-quality.md` maps to. Cite the file, not this list.

| Area | Look for | Rule file |
|---|---|---|
| Module | providers listed, needed modules imported, only shared things exported, no `forwardRef` | `arch-feature-modules.md`, `arch-module-sharing.md`, `arch-avoid-circular-deps.md` |
| Controller | HTTP only, one service call, right status code (`@HttpCode`), params parsed (`ParseUUIDPipe`) | `error-throw-http-exceptions.md`, `api-use-pipes.md` |
| DTO | a class, decorators match the ticket, no `any`, nested objects use `@ValidateNested()` and `@Type()` | `security-validate-all-input.md` |
| Response | response DTO, no entity, no password or token fields | `api-use-dto-serialization.md` |
| Service | business rules here, constructor injection, Nest exceptions, no `console.log` | `arch-single-responsibility.md`, `di-prefer-constructor-injection.md`, `devops-use-logging.md` |
| Database | queries in a repository, transactions for multi-step writes, unique index plus `23505` to 409, no N+1 | `arch-use-repository-pattern.md`, `db-use-transactions.md`, `db-avoid-n-plus-one.md` |
| Migration | matches the entity, has `down`, indexes the queries need | `db-use-migrations.md` |
| Auth | guard on the route, record-level check, secrets from config | `security-use-guards.md`, `security-authorize-records.md`, `security-auth-jwt.md` |
| Errors | no `throw new Error()` for HTTP cases, no swallowed `catch` | `error-throw-http-exceptions.md`, `error-handle-async-errors.md` |
| Tests | one per criterion and refusal, mocks with `useValue`, `app.close()` | `test-use-testing-module.md`, `test-e2e-supertest.md` |

A finding with no rule behind it is taste. Mark it "optional" or drop it.
