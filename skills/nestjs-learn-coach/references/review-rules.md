<!-- Same file in all 3 nestjs-learn-* skills. Change the 3 copies together. -->

# Review rules

General NestJS review rules. They hold in any NestJS project.
Use them on "check", after the project's own rules and before `nestjs-best-practices` (see `code-quality.md`).
A project rule wins a clash.

Each rule is short. The example shows the mistake it catches.

## Layers

- A controller reads the request, calls one service method, and returns. No queries, no business rules.
  - Example: `if (dto.quantity > product.stock)` in a controller is a business rule. Move it to the service.
- Input checks live in the DTO (`class-validator`). Business rules live in the service.
  - Example: `if (dto.name.length > 60) throw ...` in a service is an input check. Use `@MaxLength(60)`.
- Get classes by constructor injection. Not `moduleRef.get()` spread around, and not `new UsersService()`.
- A module exports only what other modules need. Not every provider "just in case".
- A provider used by one module only lives in that module. Do not move it to a `shared` or `common` module.
- `forwardRef()` is a smell. First try to move the shared piece into its own module, or use an event.
- When a new path replaces an old one, delete the old one and its test.
- Delete methods nobody calls. Add them back when a caller needs them.
- No `any` in DTOs, service arguments, or return types. Use the DTO or an interface.

## Security and login

- Every DTO used with `@Body()` is a class with validation decorators. An `interface` or `type` checks nothing at runtime.
- The global `ValidationPipe` has `whitelist: true` (and usually `forbidNonWhitelisted: true`). Otherwise `{ "role": "admin" }` slips into the entity.
- Never spread a DTO straight into an entity save when the entity has fields the user must not set (`role`, `isVerified`, `balance`).
- A response never contains `password`, `passwordHash`, or refresh tokens. Send a response DTO with `@Expose()` fields, converted with `excludeExtraneousValues: true` (or `@SerializeOptions({ type: SomeResponseDto, excludeExtraneousValues: true })` when the handler returns an entity). `@Exclude()` on the entity is only a second guard.
- Passwords are hashed with `bcrypt` or `argon2`. Never `sha256` alone.
- A refresh token is stored as a hash, rotated on use, and the whole family is revoked when an old one comes back.
- Login and "forgot password" answer the same way for a wrong email and a wrong password. No "user not found" leak.
- A route that loads a record by id checks that the user may see **that** record, not only that they are logged in.
  - Example: `GET /orders/:id` with a role guard only lets Alice read Bob's order by changing the id.
- A global guard denies by default. A public route says so with a decorator like `@Public()`.
- Behind a proxy, set trust proxy (Express `app.set('trust proxy', ...)`, Fastify `trustProxy` option). Otherwise every rate limit keys on the proxy IP.
- Secrets come from `ConfigService`, never a string in the code. `JWT_SECRET` has no default value.
- File upload: size and type checked on the server (`ParseFilePipe` with `MaxFileSizeValidator`, `FileTypeValidator`).

## Database

- `synchronize: true` is for a throwaway local database only. Every real schema change is a migration.
- Never edit a migration that already ran. Write a new one.
- Before adding a table, ask if a column does the job.
- Index the columns a list endpoint filters or sorts by.
- A list endpoint has paging with a max page size. Never "return all rows".
- Load relations in the query (`relations`, `include`, a join). Not one query per row in a loop.
- Two or more writes that must all succeed run in one transaction. Every query inside it uses the transaction's manager or client, not the normal one.
- No slow outside call (payment, email) inside an open transaction. Do it after commit, or use an outbox.
- On PostgreSQL, one failed statement breaks the whole transaction. `try/catch` around it does not save it. Use a savepoint or do the step after commit.
- A unique rule ("one email per user") is a unique index in the database, not only a `findOne` check first. Two requests at once both pass the check.
- Map the database's unique error (Postgres `23505`) to `409 Conflict`, not `500`.

## At the same time (concurrency)

- A limit ("3 sends per hour") or a one-time token (reset link, OTP) is claimed all-or-nothing: a conditional `UPDATE ... WHERE used = false` or a lock. Test two requests at once.
- Stock, balance, and counters change with one `UPDATE ... SET x = x - 1 WHERE x >= 1`, not read-then-write in TypeScript.
- A queue job checks that its reason is still true before it acts (the order still exists, the code has not expired).
- A queue job has max attempts, backoff, and a final failed state.
- Long work runs on a queue, not in the HTTP request.
- A POST that charges money or creates an order is safe to retry: an idempotency key.

## Errors

- Throw Nest's HTTP exceptions (`NotFoundException`, `ConflictException`) or your own domain errors mapped by one filter. Never `throw new Error('not found')`, which becomes `500`.
- One exception filter shapes every error. Not a `try/catch` in each controller.
- Never swallow an error: `catch (e) {}` or `catch (e) { console.log(e) }` hides real failures.
- Every `async` call is awaited or returned. A floating promise loses its error.
- Log with Nest's `Logger`, not `console.log`. Include the ids that help find the request. Never log passwords or tokens.

## API answers

- Every row has the same keys. Do not drop a key because it is `null`.
- One response DTO per answer shape.
- The same idea has the same shape in every endpoint (dates, money, paging `meta`).
- Status codes: `201` for create, `204` for delete with no body, `400` for bad input, `401` not logged in, `403` logged in but not allowed, `404` not found, `409` conflict.
- `@HttpCode(200)` on a POST that does not create anything (like login).
- Route params are checked: `@Param('id', ParseUUIDPipe)` or `ParseIntPipe`.
- Document every success answer and every error a client can reach (Swagger, if the project uses it).

## Names

- Files: `users.controller.ts`, `users.service.ts`, `create-user.dto.ts`, `user.entity.ts`. Kebab-case plus the Nest suffix.
- Leave out words the folder already says. In `src/billing/`, `InvoicesService`, not `BillingInvoicesService`.
- Leave out words the arguments already say: `revokeAll(userId)`, not `revokeAllForUser(userId)`.
- Repository methods name the storage step: `create()`, `findByEmail()`. Not `createNewUserInDatabase()`.
- Two classes must not differ only by singular vs plural.
- One idea, one word, in class, method, queue, and event names.

## Tests

- Unit tests build the class with `Test.createTestingModule()` and mock its dependencies with `useValue`.
- E2E tests boot the real app with the same global pipes, filters, and prefix as `main.ts`. Put that setup in one function both use.
- E2E tests run against a test database, never the dev database.
- Every acceptance criterion and every refusal has a test.
- A security check is tested for every actor: guest, wrong role, other user's record, allowed.
- Close the app in `afterAll(() => app.close())`, so Jest does not hang on open handles.
- No test that compares a value with where it came from (`config.get('X')` against `process.env.X`). Assert the literal.

## Startup and deploy

- `app.enableShutdownHooks()` is on, so `SIGTERM` closes the database pool and finishes running requests.
- Config is checked at startup. A missing `DATABASE_URL` stops the app with a clear message, not a crash on the first request.
- The health check has a liveness and a readiness endpoint (`@nestjs/terminus`).
- The app listens on `0.0.0.0` in a container.
- Migrations run as a deploy step, not in `onModuleInit` of every instance.

## How to write a review

1. Name the head commit and the base branch.
2. List the checks you ran. List what you did not run, and why.
3. Do not raise a problem the change copied from existing code. It is not new.
4. Each finding gets:
   - a severity: **P1** breaks prod or security, **P2** wrong behavior, **P3** quality or naming
   - a one-line title
   - an Actual / Expected row with a real input
   - a fix
   - the rule it breaks, or the proof you ran when no rule names the bug (see `code-quality.md`, "In a review")
5. Keep questions apart from findings.
6. On a recheck, prove each fix by running it. Reading it is not proof.
7. Check how the framework behaves in `node_modules` or by running it. Not from memory.

Example finding:

```markdown
**P1 — Sign-up lets a user make themselves admin**

| Request | Actual | Expected |
|---|---|---|
| `POST /users` with `{"email":"a@b.co","password":"secret-pass-1","role":"admin"}` | 201, user saved with `role = "admin"` | 400 `property role should not exist` |

**Fix:** turn on `whitelist: true` and `forbidNonWhitelisted: true` in the global `ValidationPipe`, and add the `role` case to `users.e2e-spec.ts`.
```
