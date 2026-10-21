---
title: Make Unsafe Operations Idempotent with Idempotency Keys
impact: HIGH
impactDescription: Client retries after a lost response no longer charge, create, or send twice
tags: reliability, idempotency, retries, payments, microservices
---

## Make Unsafe Operations Idempotent with Idempotency Keys

**Impact: HIGH (client retries after a lost response no longer charge, create, or send twice)**

A client cannot tell a lost request from a lost response, so it retries. If the first `POST /orders/:id/pay` already went through, the retry charges the card again. A status check ("is the order still pending?") does not help: two requests that arrive together both see `pending`.

The fix: the client makes one unique key per attempt and sends it in an `Idempotency-Key` header on every retry. The server runs the handler once per key, stores the response, and replays it for retries. Use `@nestjs/idempotency` and its `@Idempotent()` decorator. It follows the IETF Idempotency-Key header draft and also works for GraphQL mutations and microservice handlers.

**Incorrect (retry = second charge):**

```typescript
@Post(':id/pay')
@UseGuards(AuthGuard)
async pay(@Param('id') id: string, @Body() dto: PayOrderDto, @CurrentUser() user: User) {
  const order = await this.orders.findOwned(id, user.id);
  if (order.status !== 'pending') throw new ConflictException(); // two parallel calls both pass
  const charge = await this.payments.charge(order.total, dto.paymentMethod);
  await this.orders.markPaid(order.id);
  return { receiptId: charge.id };
}
```

**Correct (one run per key, scoped to the user, stored in a shared store):**

```typescript
// app.module.ts
@Module({
  imports: [
    IdempotencyModule.forRoot({
      // Runs after guards, so req.user is set. One user's key can never replay another's receipt.
      scope: (req: { user?: User }) => req.user?.id,
      // In production, register a PostgreSQL or Redis store (see the docs).
      // The default in-memory store is per process, lost on restart, and refused when NODE_ENV=production.
    }),
    OrdersModule,
  ],
})
export class AppModule {}

// orders.controller.ts
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post(':id/pay')
  @Idempotent({ required: true }) // no key = 400, never an unprotected charge
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayOrderDto, @CurrentUser() user: User) {
    return this.orders.pay(id, user, dto);
  }
}
```

What later requests with the same key get:

- First request still running: `409 IDEMPOTENCY_KEY_IN_USE` with `Retry-After`.
- First request finished: the stored status and body, plus `Idempotent-Replayed: true`. The handler does not run.
- Same key, different body or URL: `422 IDEMPOTENCY_KEY_REUSED`.

Client side: make the key when the user presses "Pay" (for example a UUID), keep it for every retry of that attempt, and make a new one only for a new attempt.

Message consumers need the same idea: brokers deliver at least once, so dedupe on the event id (an inbox table, see `ddd-transactional-outbox`).

Reference: [NestJS Idempotency Keys](https://docs.nestjs.com/reliability/idempotency) · [IETF Idempotency-Key header draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
