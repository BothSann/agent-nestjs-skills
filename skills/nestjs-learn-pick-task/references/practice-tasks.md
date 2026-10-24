# Practice tasks: turn a scan hint into a lesson

The scanner's `practices` rows are hints from text search. Each one names a rule file in the `nestjs-best-practices` skill.

Before you offer one:

1. Read the file and line in `evidence`. For `missing`, grep the app once for the other usual names (`helmet` in a `security.ts`, a `HealthController`, ...).
2. Drop the hint if the app already does it another way.
3. Read the rule file named in `rule`, in the `nestjs-best-practices` folder from `qualitySources.bestPractices`. The lesson follows its **Correct** example, after project rules.

## Hint to lesson

| Scan `id` | Status | Lesson | Size | You learn | Rule file |
|---|---|---|---|---|---|
| `validation-pipe` | missing | Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` | S | pipes, DTO classes, why an `interface` checks nothing at runtime | `security-validate-all-input.md` |
| `validation-pipe` | problem | Turn on `whitelist` and `forbidNonWhitelisted`; prove `role: "admin"` is refused | S | how extra fields get stripped or refused | `security-validate-all-input.md` |
| `config-validation` | missing / problem | `ConfigModule.forRoot({ isGlobal: true, validate })`: the app stops at startup when `DATABASE_URL` is missing | S | `ConfigService`, typed config, failing fast | `devops-use-config-module.md` |
| `raw-process-env` | problem | Move `process.env.X` reads into config and inject `ConfigService` | S | why one place reads env | `devops-use-config-module.md` |
| `shutdown-hooks` | missing | `enableShutdownHooks()`, readiness off in `beforeApplicationShutdown`, pool closes on `SIGTERM` | S | lifecycle hooks and their order | `devops-graceful-shutdown.md` |
| `health-checks` | missing | `@nestjs/terminus`: `/health/live` and `/health/ready` with a database check | S | health indicators, live vs ready | `micro-use-health-checks.md` |
| `security-headers` | missing | `app.useSecurityHeaders()` (or `helmet`) | S | what each header blocks | `security-headers-cors-csrf.md` |
| `cors` | problem | Restrict origins to the project's allowlist, or disable CORS if no cross-origin browser client needs it; credentials only when required | S | origins, preflight, why `enableCors()` alone allows every site | `security-headers-cors-csrf.md` |
| `rate-limiting` | missing | `ThrottlerModule` global, a strict limit on login | S | guards, `@Throttle`, `@SkipThrottle` | `security-rate-limiting.md` |
| `exception-filter` | missing | One global filter with `HttpAdapterHost`, one error shape, Postgres `23505` to `409` | M | filters, `APP_FILTER`, the error shape clients see | `error-use-exception-filters.md` |
| `migrations` | problem (`synchronize: true`) | Turn off `synchronize`, make the first migration, add the migration script | M | migrations, why `synchronize` can drop data | `db-use-migrations.md` |
| `migrations` | missing | First migration for the tables that exist | M | migration up and down | `db-use-migrations.md` |
| `logger` | problem | Swap `console.*` for `Logger`, then `ConsoleLogger({ json: true })` | S | Nest's logger, log levels, structured logs | `devops-use-logging.md` |
| `unit-tests` | missing | First real unit test for one service, with mocked dependencies | S | `Test.createTestingModule`, `useValue` mocks | `test-use-testing-module.md` |
| `e2e-tests` | missing | First e2e test against the lesson database, same setup as `main.ts` | M | `supertest`, app setup shared by `main.ts` and tests | `test-e2e-supertest.md` |

A practice lesson is one rule. Never "fix all security".
When two hints touch the same file (`validation-pipe` and `security-headers` both in `main.ts`), still offer them as two lessons, unless both are size S and the owner asks to join them.

## Scaffold lesson

Only when the scan says `no_nest_app`. Lesson `01`, `kind: scaffold`.

| In | Out (later lessons) |
|---|---|
| `nest new` with the owner's package manager, in `appPath` | Auth |
| Strict TypeScript (`strict: true`) | Any feature endpoint |
| `ConfigModule` with validation; `DATABASE_URL` and `PORT` required | Docker |
| Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) | |
| Database connection with the owner's ORM, no `synchronize` | |
| `enableShutdownHooks()` | |
| `GET /health` that answers 200 | |

Criteria a run can prove:

1. `npm run start:dev` boots and logs `Nest application successfully started`.
2. `GET /health` answers 200.
3. With `DATABASE_URL` unset, the app stops at startup with a clear message.
4. `npm run build` and `npm run lint` pass.

If the owner wants a smaller first lesson, drop rows from "In", in this order: health, shutdown hooks, database.
