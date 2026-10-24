<!-- Shared by all three nestjs-learn-* skills; update every copy. -->
# Review checklist

Apply only relevant rows, after project rules. Detailed Nest examples live in the mapped best-practice files; do not load every rule. DDD is opt-in: domain invariants stay in pure domain classes; HTTP error mapping stays at the boundary.

| Area | Check |
|---|---|
| Boundaries | Thin controllers; constructor DI; minimal exports; avoid circular dependencies and unjustified shared providers. Follow the project's layer contracts. |
| Input | Runtime DTO validation, whitelist, unknown-field policy, nested validation, parsed params; never mass-assign protected entity fields. |
| Output | Explicit response allowlist: DTO `@Expose()` plus `excludeExtraneousValues: true`, including interceptor `type` when returning entities. Entity `@Exclude()` is defense in depth. No unintended secret fields. |
| Auth | Deny by default; explicit public routes; check each record's ownership. Password hashing, hashed/rotated refresh tokens with reuse handling, no account-enumeration leaks. Follow intended token-issuing contracts. |
| Network | Correct trusted-proxy configuration for limits; server-side upload limits/type checks; no hardcoded secrets or sensitive logs. |
| Database | Migrations, not production synchronize; never edit applied migrations. Bounded paging, useful indexes, no N+1. Unique constraints handle races; map conflicts (Postgres 23505) correctly. |
| Transactions | All dependent writes share one transaction/client. No slow outside calls inside it. PostgreSQL errors abort the transaction: catching alone does not recover; use savepoints or move work. |
| Concurrency | Claim quotas/one-time tokens and update stock/balances conditionally or under locks. Prove simultaneous requests. Side effects need safe retries/idempotency; jobs recheck current state, use bounded retries/backoff and a final failure state. |
| Errors | Domain errors mapped centrally or appropriate Nest exceptions; no swallowed errors, floating promises, or generic 500s for expected refusals. Structured logger with useful IDs. |
| Contract | Stable response keys/nulls/date/paging shape; correct status/body; Swagger matches reachable outcomes when used. |
| Names | Consistent project vocabulary and Nest suffixes; no vague/redundant names, singular/plural-only distinctions, dead methods, or unexplained `any`. |
| Tests | Project runner; Nest providers use TestingModule/fakes, pure domain uses plain tests. E2E shares real bootstrap setup; isolate persistence if used, test each criterion/refusal and relevant actors, close resources. Assertions check behavior, not a value against its own source. |
| Operations | Validate required config at startup, shutdown hooks, liveness/readiness, container bind address, deploy-time migrations. |

## Findings
State head/base and checks run/not run. For change reviews, distinguish pre-existing issues. Each finding: P1 (production/security), P2 (wrong behavior), P3 (quality); file:line, actual versus expected with concrete input, impact, fix, and source (rule, criterion, or reproduced evidence).
Keep style preferences optional unless backed by a project rule. Do not suppress a demonstrable bug merely because no rule names it. Keep questions separate. Rechecks require actual proof; verify version-sensitive behavior in installed code/docs or execution.
