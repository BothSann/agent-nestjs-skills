<!-- Shared by all three nestjs-learn-* skills; update every copy. -->
# Code quality

For lesson solutions and full code reviews. Use project-native tools; see [project-config.md](project-config.md).

## Sources and precedence
1. Project rules/guidelines from scanner `qualitySources`; read all discovered project rule files.
2. Sibling implementations for each touched layer.
3. Relevant checks in [review-rules.md](review-rules.md).
4. Relevant `nestjs-best-practices/rules/` files.
5. Version-specific Nest docs (configured local clone, otherwise docs.nestjs.com) and installed package signatures.

Report missing sources once; do not install other skills automatically. Project conventions win design clashes: record them in GUIDE. Verify actual API availability against installed types/docs rather than copying an incompatible example.

Keep the project's manager, runner, ORM, auth, and architecture. DDD domain code/tests use plain TypeScript, no Nest or I/O; do not add a database, auth endpoint, or CORS for a generic example.

## Select rule files
Paths below are inside the discovered best-practice skill. Read only touched areas; expand filenames as `rules/<name>.md`.

| Work | Rules |
|---|---|
| Modules | arch-feature-modules, arch-module-sharing, arch-avoid-circular-deps |
| Controllers/API | error-throw-http-exceptions, api-versioning, api-use-pipes |
| Input DTOs | security-validate-all-input, api-use-pipes |
| Output | api-use-dto-serialization, security-sanitize-output |
| Services | arch-single-responsibility, di-prefer-constructor-injection, error-handle-async-errors |
| Providers | di-use-interfaces-tokens, di-scope-awareness, di-avoid-service-locator |
| Queries | arch-use-repository-pattern, perf-optimize-database, db-avoid-n-plus-one |
| Schema/migrations | db-use-migrations, db-drizzle-prisma-integration |
| Multi-write operations | db-use-transactions |
| Login/access | security-auth-jwt, security-use-guards, security-authorize-records |
| Browser/limits | security-headers-cors-csrf, security-rate-limiting |
| Errors/interceptors | error-use-exception-filters, api-use-interceptors |
| Config/logging/shutdown | devops-use-config-module, devops-use-logging, perf-async-hooks, devops-graceful-shutdown |
| Health/events/queues | micro-use-health-checks, arch-use-events, micro-use-queues |
| Outside calls/retries | micro-use-resilience, micro-use-idempotency-keys |
| Cache/deploy | perf-use-caching, devops-docker-and-dependencies |
| Tests | test-use-testing-module, test-e2e-supertest, test-mock-external-services |
| DDD, only when used | relevant ddd-* rules |

Before e2e tests inspect real authentication: obtain bearer credentials through the intended flow or use Supertest's agent for cookies. Do not invent login for an API-key app. Unit guard overrides are fine; retain an e2e path through the real guard when relevant.

## Rule pass
After building, review the diff against loaded rules, fix in the worktree, and rerun affected proof. New failures in baseline tests must be fixed, not hidden.
GUIDE includes "Rules this lesson follows": choice, rule, source file/heading; document clashes.
## In a review
Review findings follow `review-rules.md`: concrete evidence or a rule/criterion supports bugs; a rule supports mandatory style findings.
