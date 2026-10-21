---
name: nestjs-best-practices
description: NestJS best practices and architecture patterns for building production-ready applications. This skill should be used when writing, reviewing, or refactoring NestJS code to ensure proper patterns for modules, dependency injection, security, and performance.
license: MIT
metadata:
  author: Kadajett
  version: "1.4.0"
---

# NestJS Best Practices

Comprehensive best practices guide for NestJS applications. Contains 54 rules across 11 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:

- Writing new NestJS modules, controllers, or services
- Implementing authentication and authorization
- Reviewing code for architecture and security issues
- Refactoring existing NestJS codebases
- Optimizing performance or database queries
- Building microservices architectures
- Building a modular monolith with DDD (bounded contexts, aggregates, outbox, CQRS)

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Architecture | CRITICAL | `arch-` |
| 2 | Dependency Injection | CRITICAL | `di-` |
| 3 | Error Handling | HIGH | `error-` |
| 4 | Security | HIGH | `security-` |
| 5 | Performance | HIGH | `perf-` |
| 6 | Testing | MEDIUM-HIGH | `test-` |
| 7 | Database & ORM | MEDIUM-HIGH | `db-` |
| 8 | API Design | MEDIUM | `api-` |
| 9 | Microservices | MEDIUM | `micro-` |
| 10 | DevOps & Deployment | LOW-MEDIUM | `devops-` |
| 11 | Domain-Driven Design & Modular Monolith (opt-in) | MEDIUM-HIGH | `ddd-` |

## Quick Reference

### 1. Architecture (CRITICAL)

- `arch-avoid-circular-deps` - Avoid circular module dependencies
- `arch-feature-modules` - Organize by feature, not technical layer
- `arch-module-sharing` - Proper module exports/imports, avoid duplicate providers
- `arch-single-responsibility` - Focused services over "god services"
- `arch-use-repository-pattern` - Abstract database logic for testability
- `arch-use-events` - Event-driven architecture for decoupling

### 2. Dependency Injection (CRITICAL)

- `di-avoid-service-locator` - Avoid service locator anti-pattern
- `di-interface-segregation` - Interface Segregation Principle (ISP)
- `di-liskov-substitution` - Liskov Substitution Principle (LSP)
- `di-prefer-constructor-injection` - Constructor over property injection
- `di-scope-awareness` - Understand singleton/request/transient scopes
- `di-use-interfaces-tokens` - Use injection tokens for interfaces

### 3. Error Handling (HIGH)

- `error-use-exception-filters` - Centralized exception handling
- `error-throw-http-exceptions` - Use NestJS HTTP exceptions
- `error-handle-async-errors` - Handle async errors properly

### 4. Security (HIGH)

- `security-auth-jwt` - Secure JWT authentication
- `security-validate-all-input` - Validate with class-validator
- `security-use-guards` - Authentication and authorization guards
- `security-authorize-records` - Per-record permission checks, deny by default
- `security-headers-cors-csrf` - Security headers, strict CORS, CSRF protection
- `security-sanitize-output` - Prevent XSS attacks
- `security-rate-limiting` - Implement rate limiting

### 5. Performance (HIGH)

- `perf-async-hooks` - Proper async lifecycle hooks
- `perf-use-caching` - Implement caching strategies
- `perf-optimize-database` - Optimize database queries
- `perf-lazy-loading` - Lazy load modules for faster startup
- `perf-use-fastify` - Fastify adapter, platform-agnostic code

### 6. Testing (MEDIUM-HIGH)

- `test-use-testing-module` - Use NestJS testing utilities
- `test-e2e-supertest` - E2E testing with Supertest
- `test-mock-external-services` - Mock external dependencies

### 7. Database & ORM (MEDIUM-HIGH)

- `db-use-transactions` - Transaction management
- `db-avoid-n-plus-one` - Avoid N+1 query problems
- `db-use-migrations` - Use migrations for schema changes
- `db-drizzle-prisma-integration` - Drizzle and Prisma through Nest providers

### 8. API Design (MEDIUM)

- `api-use-dto-serialization` - DTO and response serialization
- `api-use-interceptors` - Cross-cutting concerns
- `api-versioning` - API versioning strategies
- `api-use-pipes` - Input transformation with pipes

### 9. Microservices (MEDIUM)

- `micro-use-patterns` - Message and event patterns
- `micro-use-health-checks` - Health checks for orchestration
- `micro-use-idempotency-keys` - Idempotency keys so retries never run twice
- `micro-use-queues` - Background job processing
- `micro-use-resilience` - Timeouts, retries, circuit breakers

### 10. DevOps & Deployment (LOW-MEDIUM)

- `devops-use-config-module` - Environment configuration
- `devops-docker-and-dependencies` - Small non-root images, dependency audit
- `devops-use-logging` - Structured logging
- `devops-use-tracing` - OpenTelemetry tracing
- `devops-graceful-shutdown` - Zero-downtime deployments

### 11. Domain-Driven Design & Modular Monolith (MEDIUM-HIGH, opt-in)

Apply only when the app has real business rules and is built as a modular monolith. Skip for simple CRUD.

- `ddd-bounded-context-modules` - One module per bounded context with domain/application/infrastructure layers
- `ddd-module-public-api` - Modules talk only through a public facade or integration events
- `ddd-rich-domain-model` - Aggregates and value objects hold the rules; keep them apart from ORM entities
- `ddd-aggregate-repository` - One repository per aggregate, interface in domain
- `ddd-transactional-outbox` - Save events with data in one transaction; consumers dedupe with an inbox
- `ddd-cqrs` - Commands go through aggregates; queries read directly with `@nestjs/cqrs`

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/arch-avoid-circular-deps.md
rules/security-validate-all-input.md
rules/_sections.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Rule Index

For a one-page index of every rule with a one-line reason and a link to its file, see
[AGENTS.md in the repository](https://github.com/Kadajett/agent-nestjs-skills/blob/main/AGENTS.md).
Full explanations and code examples live only in `rules/`.
