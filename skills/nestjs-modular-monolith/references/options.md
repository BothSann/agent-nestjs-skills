# Options (opt-in)

Add only when asked or clearly needed.

**`@nestjs/cqrs` buses**: for many handlers, in-process event handlers or sagas, or a team that knows it. Costs: no click-through to the handler, a missing handler fails only at runtime, `EventBus` is in memory (not an outbox). Switch: `@CommandHandler`/`@QueryHandler` + `ICommandHandler`/`IQueryHandler`, inputs become `Command<T>`/`Query<T>`, `CqrsModule.forRoot()` in the root module, controllers call `commandBus.execute(...)`. Layer rules stay the same. See `ddd-cqrs`.

**Integration events with an outbox**: when a module must react without a direct call. Versioned shapes (`billing.invoice-issued.v1`) in the producer's contracts/; write the event in the same transaction as the change; dedupe in the consumer. Prefer `@nestjs/outbox` if it supports the database. See `ddd-transactional-outbox`.

**API and worker processes**: split each module into `<m>.module.ts` (use cases, repositories), `<m>-http.module.ts` (controllers), `<m>-jobs.module.ts` (processors), all exported from index.ts. Add `worker.ts`, `worker.module.ts` to `rootFiles`; test that the worker loads no HTTP module.

**Fixed direction between modules** (`no-circular` already blocks cycles). Add after the generated rules, and test it yourself; the self-test does not know custom rules:

```js
{ name: 'catalog-not-to-billing', severity: 'error', from: { path: `^${MODS}/catalog/` }, to: { path: `^${MODS}/billing/` } },
```

**Base classes** (`AggregateRoot`, `Entity`, `ValueObject`): in `shared/domain/` once two real aggregates repeat code. Plain TypeScript; never the `@nestjs/cqrs` `AggregateRoot` in domain/.

**One database schema or user per module**: import rules cannot stop cross-module table access; this makes ownership visible in the database. Database-specific, so outside this skill.
