<!-- Same file in all 3 nestjs-learn-* skills. Change the 3 copies together. -->

# Code quality: which rules the code must follow

The complete solution in the lesson worktree is what the owner learns from. It must be code a senior NestJS dev would merge.
The same rules are used to review the owner's code on "check".

Use the project's package manager, scripts, and test runner throughout. Resolve commands with [project-config.md](project-config.md), "Commands follow the project"; npm and Jest snippets are examples, not required tools.

For a DDD app, keep domain tests plain TypeScript with the project's test runner. Use `Test.createTestingModule()` for Nest providers and wiring, not aggregates or value objects. Keep business rules in the domain and map domain errors at the HTTP boundary. Do not add a database, auth endpoint, or browser CORS just to satisfy a generic example.

## Where the rules come from

Read them in this order. **When two disagree, the higher one wins.**

| # | Source | Where | Example |
|---|---|---|---|
| 1 | Project rules (the team lead's or CTO's) | every file in `qualitySources.rules` | `.claude/rules/architecture.md`: "Controllers call one service method" |
| 2 | What the app already does | sibling files of the layer you write | the current `auth.controller.ts` before a new controller |
| 2b | General review rules | [review-rules.md](review-rules.md) | "A refresh token is stored as a hash, never in plain text" |
| 3 | `nestjs-best-practices` skill | its `rules/` files, path in `qualitySources.bestPractices` | `rules/security-validate-all-input.md`: "global `ValidationPipe` with `whitelist`" |
| 4 | NestJS docs for the installed version | `nestDocsPath` clone (`content/**/*.md`), else https://docs.nestjs.com | "`ConsoleLogger({ json: true })` options" |
| 5 | The installed package itself | `node_modules/@nestjs/*/**/*.d.ts` in the worktree | the real signature of `ThrottlerModule.forRoot()` |

Why this order:

- The project rules are hard-won team decisions. The best choice is often the one the codebase already uses.
- `review-rules.md` holds mistakes reviewers keep finding in real NestJS PRs. They are true in any project.
- `nestjs-best-practices` has the general NestJS defaults, each with a wrong and a right example. It fills the gaps the project rules leave.
- The docs and the `.d.ts` files give the right API for the installed version. Memory can be one version old.

The scan JSON lists what exists under `qualitySources`. Use those paths. Do not guess.
If a source is missing, skip it and say so once. Without `nestjs-best-practices`, say: "The lessons follow project rules and the review rules only. Install it with `npx skills add BothSann/agent-nestjs-skills --skill nestjs-best-practices`."

## Map each piece of work to the best-practice rule files

Read only the rows the lesson touches. Paths are inside the `nestjs-best-practices` skill folder, under `rules/`.

| The lesson writes | Rule files |
|---|---|
| New feature folder, module, imports and exports | `arch-feature-modules.md`, `arch-module-sharing.md`, `arch-avoid-circular-deps.md` |
| Controller, routes, status codes | `error-throw-http-exceptions.md`, `api-versioning.md` |
| DTO, validation, `ValidationPipe` | `security-validate-all-input.md`, `api-use-pipes.md` |
| Response shape, hiding fields | `api-use-dto-serialization.md`, `security-sanitize-output.md` |
| Service | `arch-single-responsibility.md`, `di-prefer-constructor-injection.md`, `error-throw-http-exceptions.md` |
| Provider tokens, interfaces, scopes | `di-use-interfaces-tokens.md`, `di-scope-awareness.md`, `di-avoid-service-locator.md` |
| Repository, queries, paging | `arch-use-repository-pattern.md`, `perf-optimize-database.md`, `db-avoid-n-plus-one.md` |
| Entity, schema, migration | `db-use-migrations.md`, `db-drizzle-prisma-integration.md` |
| Several writes that must all succeed | `db-use-transactions.md` |
| Login, JWT, refresh tokens | `security-auth-jwt.md`, `security-use-guards.md` |
| Roles, "may this user touch this record?" | `security-use-guards.md`, `security-authorize-records.md` |
| Rate limits | `security-rate-limiting.md` |
| CORS, headers, CSRF | `security-headers-cors-csrf.md` |
| Exception filter, error shape | `error-use-exception-filters.md`, `error-handle-async-errors.md` |
| Interceptor (logging, timing, wrapping) | `api-use-interceptors.md` |
| Config, `.env` | `devops-use-config-module.md` |
| Logging | `devops-use-logging.md` |
| Startup and shutdown hooks | `perf-async-hooks.md`, `devops-graceful-shutdown.md` |
| Health checks | `micro-use-health-checks.md` |
| Events between modules | `arch-use-events.md` |
| Queues, background jobs | `micro-use-queues.md` |
| Calls to other APIs | `micro-use-resilience.md`, `test-mock-external-services.md` |
| Safe retries of POST (payments, orders) | `micro-use-idempotency-keys.md` |
| Cache | `perf-use-caching.md` |
| Dockerfile | `devops-docker-and-dependencies.md` |
| Unit tests | `test-use-testing-module.md`, `test-mock-external-services.md` |
| E2E tests | `test-e2e-supertest.md` |
| DDD layers (only when the project uses them) | the `ddd-*.md` files the lesson touches |

Example: a login endpoint touches the controller, DTO, auth, rate limit, and error rows.
Read `error-throw-http-exceptions.md`, `security-validate-all-input.md`, `security-auth-jwt.md`, `security-use-guards.md`, `security-rate-limiting.md`, and `error-use-exception-filters.md`. Skip the rest.

## Check how the app logs users in, before writing tests

The auth setup decides the e2e test helper. Read the auth module first.

| App uses | E2E test gets a user by | Why |
|---|---|---|
| JWT bearer (`@nestjs/jwt`, `passport-jwt`, or `@nestjs/authentication`) | calling the real login endpoint, then sending `Authorization: Bearer <token>` | A faked guard can hide a wrong strategy or a wrong secret |
| Session cookies | `request.agent(app.getHttpServer())`, so the cookie is kept between calls | A plain `request()` drops the cookie |
| No auth yet | nothing | |

Unit tests may override a guard with `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })`. Keep at least one e2e test that goes through the real guard.

## Rule pass: before code counts as done

After the code runs, read the diff again against every rule file you mapped.

1. For each file: does it break a project rule? A line in `review-rules.md`? A best-practice rule?
2. Fix it in the lesson worktree. Run the proof again there.
3. If a best-practice rule and a project rule disagree, keep the project rule. Write the clash down for the owner.

## Show the owner where each choice comes from

The owner learns the **why**, not only the code.
`GUIDE.md` gets a table near the top:

```markdown
## Rules this lesson follows

| Choice in the code | Rule | Source |
|---|---|---|
| `AuthController.login()` only calls `AuthService.login()` | Controllers stay HTTP-only | project: `architecture.md` "Thin controllers" |
| `LoginDto` with `@IsEmail()` and `@IsString()`, global `whitelist: true` | Validate all input with DTOs and pipes | best practice: `security-validate-all-input.md` |
| `AuthService` throws `UnauthorizedException`, not `Error` | Throw HTTP exceptions from services | best practice: `error-throw-http-exceptions.md` |
| `@Throttle({ default: { limit: 5, ttl: 60_000 } })` on login | Rate limit login | best practice: `security-rate-limiting.md` |
```

- Name the real rule file and heading.
- One row per choice the owner might ask "why?" about.

## In a review ("check")

Every finding in "Breaks" and "Style" names its source:

```markdown
| `src/auth/auth.controller.ts:31` | `login(@Body() body: any)` | No DTO, so `ValidationPipe` checks nothing and extra fields get through | best practice: `security-validate-all-input.md` |
```

A source is one of these:

- a rule file: project rule, `review-rules.md`, or a best-practice rule
- a ticket acceptance criterion
- proof you ran that shows wrong behavior: a curl, a test, a `tsc` error, a log line

| Finding | Needs | No source? |
|---|---|---|
| Breaks (bug, wrong status, leak, security hole) | a rule, a criterion, **or** proof | Keep it if you can show it. Write the proof in the row: the input, what came back, what should come back. Never drop a bug you can show because no rule file names it. |
| Style (names, layout, taste) | a rule file | It is taste, not a rule. Say it is optional, or leave it out. |
