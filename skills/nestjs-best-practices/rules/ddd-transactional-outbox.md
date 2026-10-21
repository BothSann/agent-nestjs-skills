---
title: Publish Integration Events with a Transactional Outbox
impact: HIGH
impactDescription: No lost or phantom events when the app crashes between saving data and publishing
tags: ddd, outbox, inbox, integration-events, reliability, idempotency
---

## Publish Integration Events with a Transactional Outbox

**Impact: HIGH (no lost or phantom events when the app crashes between saving data and publishing)**

Saving data and publishing an event are two separate actions. If the app crashes between them, you get one of two bugs:

- Data saved, event never sent: other modules never hear about it.
- Event sent, data save rolled back: other modules react to something that did not happen.

The outbox fixes this. Write the event as a row in an `outbox` table **in the same database transaction** as the aggregate. A separate relay reads unsent rows, publishes them, and marks them sent. Delivery becomes "at least once", so every consumer must be safe to run twice: record handled event ids in an **inbox** table and skip repeats.

**Use the official package first.** `@nestjs/outbox` does all of this for you: `Outbox.add()` in your transaction, a relay with retry and backoff, a dead-letter table, an inbox for consumers, and safe work-sharing across instances. It has stores for Drizzle, TypeORM, Prisma and MySQL (see the docs link below). The code below shows what it does, for when you cannot use it.

**Incorrect (publish after commit, no retry, no dedupe):**

```typescript
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  async execute(cmd: PlaceOrderCommand) {
    const order = await this.orders.getById(cmd.orderId);
    order.place();
    await this.orders.save(order);

    // Crash here = order placed, payments never told
    this.eventEmitter.emit('ordering.order-placed', { orderId: order.id });
  }
}

@OnEvent('ordering.order-placed')
async onOrderPlaced(e: { orderId: string }) {
  await this.payments.charge(e.orderId); // runs twice on redelivery = double charge
}
```

**Correct (outbox table, written in the same transaction):**

```typescript
// shared/infrastructure/outbox/outbox.orm-entity.ts
@Entity({ name: 'outbox' })
@Index(['processedAt', 'occurredAt'])
export class OutboxOrmEntity {
  @PrimaryColumn('uuid') id: string;          // also the event id consumers dedupe on
  @Column() type: string;                     // e.g. 'ordering.order-placed.v1'
  @Column('jsonb') payload: Record<string, unknown>;
  @Column('timestamptz') occurredAt: Date;
  @Column('timestamptz', { nullable: true }) processedAt: Date | null;
  @Column('int', { default: 0 }) attempts: number;
  @Column('text', { nullable: true }) lastError: string | null;
}

// Inside the aggregate repository's save() – see ddd-aggregate-repository
await this.dataSource.transaction(async (manager) => {
  await manager.save(OrderOrmEntity, OrderMapper.toPersistence(order));
  await manager.insert(OutboxOrmEntity, order.pullEvents().map(OutboxMapper.fromDomainEvent));
});
// Either both rows commit, or neither does.
```

**Correct (relay publishes unsent rows):**

```typescript
// shared/infrastructure/outbox/outbox-relay.service.ts
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Interval(1000) // from @nestjs/schedule
  async tick(): Promise<void> {
    if (this.running) return; // never overlap runs
    this.running = true;
    try {
      await this.publishBatch();
    } catch (error) {
      this.logger.error('Outbox relay failed', error instanceof Error ? error.stack : error);
    } finally {
      this.running = false;
    }
  }

  private async publishBatch(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // SKIP LOCKED lets several app instances run the relay without sending a row twice (PostgreSQL/MySQL 8)
      const rows = await manager
        .createQueryBuilder(OutboxOrmEntity, 'o')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('o.processedAt IS NULL')
        .andWhere('o.attempts < :max', { max: 10 })
        .orderBy('o.occurredAt', 'ASC')
        .limit(50)
        .getMany();

      for (const row of rows) {
        try {
          // In-process modular monolith: EventEmitter2. Swap for a broker (RabbitMQ, Kafka, BullMQ) later.
          await this.eventEmitter.emitAsync(row.type, { eventId: row.id, ...row.payload });
          await manager.update(OutboxOrmEntity, row.id, { processedAt: new Date() });
        } catch (error) {
          await manager.update(OutboxOrmEntity, row.id, {
            attempts: row.attempts + 1,
            lastError: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }
}
```

**Correct (consumer is safe to run twice, using an inbox table):**

```typescript
// modules/payments/infrastructure/handlers/order-placed.handler.ts
@Injectable()
export class OrderPlacedHandler {
  constructor(private readonly dataSource: DataSource) {}

  // suppressErrors: false lets a failure reach the relay, so the row is retried.
  // With the default (true), the error is only logged and the event is marked sent.
  @OnEvent('ordering.order-placed.v1', { suppressErrors: false })
  async handle(event: { eventId: string; orderId: string; amountCents: number; currency: string }) {
    await this.dataSource.transaction(async (manager) => {
      // Primary key (message_id, handler) blocks a second run of the same event
      const inserted: unknown[] = await manager.query(
        `INSERT INTO payments.inbox (message_id, handler, processed_at)
         VALUES ($1, $2, now())
         ON CONFLICT DO NOTHING
         RETURNING message_id`,
        [event.eventId, OrderPlacedHandler.name],
      );
      if (inserted.length === 0) return; // already handled

      await manager.insert(PaymentOrmEntity, {
        id: randomUUID(),
        orderId: event.orderId,
        amountCents: event.amountCents,
        currency: event.currency,
        status: 'pending',
      });
    });
  }
}
```

Example: the relay sends event `e-42`, the payment row is saved, then the relay crashes before it marks `e-42` as sent. On restart it sends `e-42` again. The inbox already has `e-42`, so the handler returns early and no second payment is created.

Keep the payload small and versioned (`.v1`). Clean old processed rows with a scheduled job. Watch rows with `attempts >= 10`: they are stuck and need a person to look.

Reference: [Transactional Outbox (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html) · [Modular Monolith with DDD (kgrzybek)](https://github.com/kgrzybek/modular-monolith-with-ddd) · [NestJS Outbox](https://docs.nestjs.com/reliability/outbox) · [NestJS Task Scheduling](https://docs.nestjs.com/application/task-scheduling)
