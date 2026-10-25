---
name: nestjs-best-practices
description: Write, review, or refactor NestJS code using prioritized architecture, dependency-injection, security, testing, database, and deployment rules. Includes opt-in DDD guidance.
license: MIT
metadata:
  author: Kadajett
  version: "1.5.0"
---

# NestJS rules

54 rules; read only those relevant to the task. Respect project conventions and installed versions. Categories below are ordered by priority; earlier categories win conflicts. DDD applies only to modular monoliths with real business rules, not ordinary CRUD.

Each file has rationale and wrong/right examples. Build its path as `rules/<prefix><name>.md`; e.g. `rules/security-validate-all-input.md`. Do not load the entire directory.

| Category / impact | Prefix | Names |
|---|---|---|
| Architecture / CRITICAL | arch- | avoid-circular-deps, feature-modules, module-sharing, single-responsibility, use-events, use-repository-pattern |
| DI / CRITICAL | di- | avoid-service-locator, interface-segregation, liskov-substitution, prefer-constructor-injection, scope-awareness, use-interfaces-tokens |
| Errors / HIGH | error- | handle-async-errors, throw-http-exceptions, use-exception-filters |
| Security / HIGH | security- | auth-jwt, authorize-records, headers-cors-csrf, rate-limiting, sanitize-output, use-guards, validate-all-input |
| Performance / HIGH | perf- | async-hooks, lazy-loading, optimize-database, use-caching, use-fastify |
| Testing / MEDIUM-HIGH | test- | e2e-supertest, mock-external-services, use-testing-module |
| Database / MEDIUM-HIGH | db- | avoid-n-plus-one, drizzle-prisma-integration, use-migrations, use-transactions |
| API / MEDIUM | api- | use-dto-serialization, use-interceptors, use-pipes, versioning |
| Microservices / MEDIUM | micro- | use-health-checks, use-idempotency-keys, use-patterns, use-queues, use-resilience |
| Deployment / LOW-MEDIUM | devops- | docker-and-dependencies, graceful-shutdown, use-config-module, use-logging, use-tracing |
| DDD / MEDIUM-HIGH, opt-in | ddd- | aggregate-repository, bounded-context-modules, cqrs, module-public-api, rich-domain-model, transactional-outbox |
