---
title: One Repository per Aggregate, Interface in Domain
impact: MEDIUM-HIGH
impactDescription: Aggregates are always loaded and saved whole, so their rules cannot be bypassed
tags: ddd, repository, aggregate, persistence, injection-token
---

## One Repository per Aggregate, Interface in Domain

**Impact: MEDIUM-HIGH (aggregates are always loaded and saved whole, so their rules cannot be bypassed)**

In DDD, a repository is not a wrapper for every table. It is a collection-like store for **one aggregate root**:

- The **interface** lives in `domain/` and speaks in domain terms (`getById`, `save`). It returns domain objects, never ORM entities or query builders.
- The **implementation** lives in `infrastructure/` and uses the ORM plus a mapper.
- Child objects (like `OrderLine`) have **no repository of their own**. You change them only through the root.
- Load and save the **whole aggregate** in one transaction. Use a version column so two users cannot overwrite each other's changes.
- Reads for screens and reports do not go through this repository. They use query handlers (see `ddd-cqrs`).

This is stricter than `arch-use-repository-pattern`, which wraps queries for any table.

**Incorrect (table-shaped repositories, children saved on their own):**

```typescript
@Injectable()
export class OrderLinesRepository {
  constructor(@InjectRepository(OrderLineEntity) private repo: Repository<OrderLineEntity>) {}

  addLine(orderId: string, line: Partial<OrderLineEntity>) {
    return this.repo.save({ ...line, orderId }); // skips Order's rules: status, max qty, total
  }
}

@Injectable()
export class OrdersRepository {
  findForDashboard(filters: DashboardFilters) { /* screen query mixed into write repository */ }
  getQueryBuilder() { return this.repo.createQueryBuilder('o'); } // leaks the ORM out
}
```

**Correct (interface + token in domain):**

```typescript
// modules/ordering/domain/order.repository.ts
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  getById(id: string): Promise<Order>; // throws OrderNotFoundError
  save(order: Order): Promise<void>;
}
```

**Correct (TypeORM implementation in infrastructure):**

```typescript
// modules/ordering/infrastructure/persistence/typeorm-order.repository.ts
@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getById(id: string): Promise<Order> {
    const row = await this.dataSource.getRepository(OrderOrmEntity).findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!row) throw new OrderNotFoundError(id);
    return OrderMapper.toDomain(row);
  }

  async save(order: Order): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Save the whole aggregate (root + lines). See the version note below.
      await manager.save(OrderOrmEntity, OrderMapper.toPersistence(order));

      // Domain events go to the outbox in the SAME transaction (see ddd-transactional-outbox)
      const events = order.pullEvents();
      if (events.length > 0) {
        await manager.insert(OutboxOrmEntity, events.map(OutboxMapper.fromDomainEvent));
      }
    });
  }
}

// order.orm-entity.ts – add a version column for optimistic locking
@Entity({ name: 'orders', schema: 'ordering' })
export class OrderOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @VersionColumn() version: number;
  // ...
}
```

**Correct (wire with a token, use in a command handler):**

```typescript
// ordering.module.ts
providers: [{ provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository }],

// application/commands/place-order.handler.ts
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute({ orderId }: PlaceOrderCommand): Promise<void> {
    const order = await this.orders.getById(orderId);
    order.place();               // rules checked inside the aggregate
    await this.orders.save(order);
  }
}

// Unit test: swap in an in-memory repository, no database needed
class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();
  async getById(id: string) {
    const o = this.store.get(id);
    if (!o) throw new OrderNotFoundError(id);
    return o;
  }
  async save(order: Order) { this.store.set(order.id, order); }
}
```

Note: TypeORM's `@VersionColumn` increments the version on save, but `save()` does not by itself reject a stale version. To truly block lost updates, check the version in the `UPDATE ... WHERE id = :id AND version = :loadedVersion` and throw a concurrency error when 0 rows change.

Reference: [Martin Fowler – Repository](https://martinfowler.com/eaaCatalog/repository.html) · [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers) · [TypeORM Transactions](https://typeorm.io/transactions)
