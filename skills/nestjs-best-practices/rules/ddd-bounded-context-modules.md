---
title: One Module per Bounded Context with Layers
impact: HIGH
impactDescription: Keeps business areas independent so they can change, scale, or split out on their own
tags: ddd, modular-monolith, bounded-context, architecture, layers
---

## One Module per Bounded Context with Layers

**Impact: HIGH (keeps business areas independent so they can change, scale, or split out on their own)**

In a modular monolith, each top-level NestJS module maps to one bounded context: a part of the business with its own language and rules (for example `ordering`, `payments`, `catalog`). Inside the module, split code into layers so business rules do not depend on frameworks or the database:

- `domain/` – aggregates, value objects, domain events, repository interfaces. Plain TypeScript. No NestJS, no ORM imports.
- `application/` – use cases (commands, queries, handlers). Orchestrates the domain. Depends only on `domain/`.
- `infrastructure/` – ORM entities, repository implementations, outbox, external clients.
- `api/` – HTTP controllers, DTOs, and the module's public contract for other modules.

Dependencies point inward: `api` and `infrastructure` depend on `application` and `domain`, never the other way. Use this when the domain has real business rules and several teams or areas. For a small CRUD app, plain feature modules (`arch-feature-modules`) are enough.

**Incorrect (feature folder with everything mixed, domain tied to ORM and HTTP):**

```typescript
// src/orders/
// ├── order.entity.ts        <- TypeORM entity used as the domain model
// ├── orders.service.ts      <- business rules + queries + HTTP exceptions
// ├── orders.controller.ts
// └── orders.module.ts

// orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity) private repo: Repository<OrderEntity>,
    @InjectRepository(ProductEntity) private products: Repository<ProductEntity>, // reaches into catalog's table
  ) {}

  async addItem(orderId: string, productId: string, qty: number) {
    const order = await this.repo.findOneByOrFail({ id: orderId });
    if (order.status !== 'draft') {
      throw new BadRequestException('Order is locked'); // HTTP concern inside business rule
    }
    const product = await this.products.findOneByOrFail({ id: productId });
    order.items.push({ productId, qty, price: product.price });
    order.total += product.price * qty; // rule lives in service, easy to skip elsewhere
    return this.repo.save(order);
  }
}
```

**Correct (bounded context module with layers):**

```typescript
// src/modules/ordering/
// ├── domain/
// │   ├── order.ts                    // aggregate root (plain TS)
// │   ├── order-line.ts               // entity inside the aggregate
// │   ├── money.ts                    // value object
// │   ├── events/order-placed.event.ts
// │   ├── errors/order-locked.error.ts
// │   └── order.repository.ts         // interface + token only
// ├── application/
// │   ├── commands/add-item/add-item.command.ts
// │   ├── commands/add-item/add-item.handler.ts
// │   └── queries/get-order/get-order.handler.ts
// ├── infrastructure/
// │   ├── persistence/order.orm-entity.ts
// │   ├── persistence/order.mapper.ts
// │   └── persistence/typeorm-order.repository.ts
// ├── api/
// │   ├── orders.controller.ts
// │   └── ordering.facade.ts          // public contract for other modules
// ├── index.ts                        // exports ONLY the public contract
// └── ordering.module.ts

// domain/order.ts – no framework imports
export class Order {
  private constructor(
    readonly id: string,
    private status: 'draft' | 'placed',
    private lines: OrderLine[],
  ) {}

  addItem(productId: string, qty: number, unitPrice: Money): void {
    if (this.status !== 'draft') throw new OrderLockedError(this.id);
    this.lines.push(OrderLine.create(productId, qty, unitPrice));
  }

  get total(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.subtotal), Money.zero('USD'));
  }
}

// ordering.module.ts
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([OrderOrmEntity]), CatalogModule],
  controllers: [OrdersController],
  providers: [
    AddItemHandler,
    GetOrderHandler,
    { provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository },
    OrderingFacade,
  ],
  exports: [OrderingFacade], // nothing else leaves the module
})
export class OrderingModule {}

// index.ts – the only file other modules may import from
export { OrderingModule } from './ordering.module';
export { OrderingFacade } from './api/ordering.facade';
export type { OrderSummaryDto } from './api/order-summary.dto';
```

Map domain errors to HTTP status codes in an exception filter (`error-use-exception-filters`), not inside the domain.

Reference: [Modular Monolith with DDD (kgrzybek)](https://github.com/kgrzybek/modular-monolith-with-ddd) · [NestJS Modules](https://docs.nestjs.com/modules)
