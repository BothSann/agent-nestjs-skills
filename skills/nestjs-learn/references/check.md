# "check" and "check and fix"

## Review
1. Read the owner's changes: `git diff <base>`, plus `git status` for new files.
2. Run read-only checks from boundaries.md. Give write requests to the owner as commands.
3. Compare in order: ticket criteria, project rules, then the checklist and rule files below. The reference is a guide, not the only valid answer.
4. Report **Right**, **Breaks**, then **Style**, with file:line and why. Say what you ran and didn't run. Don't fix anything.

A Breaks finding needs a rule, a criterion, or proof you ran. A Style finding without a rule is optional or dropped.

## Check and fix
Fix only what the review found. Report a `File:line | Was | Now | Why` table, then rerun the checks.

## Rule files
Load only touched areas, from `nestjs-best-practices/rules/<name>.md`.

| Work | Rules |
|---|---|
| Modules | arch-feature-modules, arch-module-sharing, arch-avoid-circular-deps, arch-single-responsibility |
| Controllers | error-throw-http-exceptions, api-use-pipes, api-versioning |
| Input | security-validate-all-input, api-use-pipes |
| Output | api-use-dto-serialization, security-sanitize-output |
| Providers | di-prefer-constructor-injection, di-use-interfaces-tokens, di-scope-awareness, di-avoid-service-locator, di-interface-segregation, di-liskov-substitution |
| Queries | arch-use-repository-pattern, perf-optimize-database, db-avoid-n-plus-one, db-drizzle-prisma-integration |
| Writes | db-use-transactions |
| Schema | db-use-migrations |
| Auth | security-auth-jwt, security-use-guards, security-authorize-records |
| Browser, limits | security-headers-cors-csrf, security-rate-limiting |
| Errors | error-use-exception-filters, error-handle-async-errors |
| Interceptors | api-use-interceptors |
| Startup, config | devops-use-config-module, perf-async-hooks, devops-graceful-shutdown, perf-lazy-loading, perf-use-fastify |
| Logs, tracing | devops-use-logging, devops-use-tracing |
| Events, jobs | arch-use-events, micro-use-queues, micro-use-patterns |
| Outside calls | micro-use-resilience, micro-use-idempotency-keys |
| Cache, health | perf-use-caching, micro-use-health-checks |
| DDD, only when used | ddd-bounded-context-modules, ddd-module-public-api, ddd-rich-domain-model, ddd-aggregate-repository, ddd-cqrs, ddd-transactional-outbox |
| Tests | test-use-testing-module, test-e2e-supertest, test-mock-external-services |

## Checks that have no rule file

| Area | Check |
|---|---|
| Layers | Controllers call one use case or service, never the ORM client. `domain` imports no Nest or ORM. The `arch` script catches only what its rules name. |
| Data | Bounded paging and useful indexes. Unique constraints handle races, with Postgres `23505` mapped to 409. |
| Transactions | Every dependent write uses the same transaction client. No slow outside calls inside one. After a Postgres error the transaction is aborted, so catching isn't recovery. |
| Concurrency | Quotas and one-time tokens claim conditionally or under locks. Jobs recheck state and have a final failure state. |
| Contract | Stable keys, nulls, dates, and paging. Status codes match the ticket. Swagger lists reachable errors when used. |
| TypeScript | No unexplained `any`, `as` casts, or `!`. No floating promises. `Date` and time zones handled on purpose. No vague names. |
