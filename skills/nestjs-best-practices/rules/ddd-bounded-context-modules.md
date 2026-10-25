---
title: One Module per Bounded Context with Layers
impact: HIGH
impactDescription: Keeps business areas independent so they can change, scale, or split out on their own
tags: ddd, modular-monolith, bounded-context, architecture, layers
---

## One Module per Bounded Context with Layers

**Impact: HIGH (keeps business areas independent so they can change, scale, or split out on their own)**

In a modular monolith, each top-level NestJS module maps to one bounded context: a part of the business with its own language and rules (for example `ordering`, `payments`, `catalog`). Inside the module, split code into layers so business rules do not depend on frameworks or the database:

- `domain/` – aggregates, value objects, domain events, domain errors, repository interfaces and their tokens. Plain TypeScript. No NestJS, no ORM imports.
- `application/` – use cases (commands and queries). Orchestrates the domain. Depends on `domain/`, its own `contracts/`, and other modules' `index.ts`.
- `infrastructure/` – ORM entities, repository implementations, outbox, external clients, integration event handlers.
- `api/` – HTTP controllers and DTOs. Controllers call application use cases.
- `contracts/` – what other modules may use: plain types, interfaces, injection tokens, integration event shapes.

`index.ts` re-exports only the Nest module and `contracts/`. Dependencies point inward: `api` → `application` → `domain`, and `infrastructure` → `application`, `domain`. Use this when the domain has real business rules and several teams or areas. For a small CRUD app, plain feature modules (`arch-feature-modules`) are enough.

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
// │   ├── commands/add-item.handler.ts
// │   ├── queries/get-order.handler.ts
// │   └── order-summaries.service.ts  // implements the contract below
// ├── infrastructure/
// │   ├── persistence/order.orm-entity.ts
// │   ├── persistence/order.mapper.ts
// │   └── persistence/typeorm-order.repository.ts
// ├── api/
// │   ├── orders.controller.ts
// │   └── dto/add-item.dto.ts
// ├── contracts/
// │   └── order-summaries.ts          // interface + token for other modules
// ├── index.ts                        // exports ONLY the Nest module and contracts/
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

// contracts/order-summaries.ts – plain types and a token, no logic
export interface OrderSummaryDto { orderId: string; totalCents: number }
export interface OrderSummaries { forCustomer(customerId: string): Promise<OrderSummaryDto[]> }
export const ORDER_SUMMARIES = Symbol('ORDER_SUMMARIES');

// ordering.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity]), CatalogModule], // CatalogModule from '../catalog' (its index.ts)
  controllers: [OrdersController],
  providers: [
    AddItemHandler,
    GetOrderHandler,
    OrderSummariesService,
    { provide: ORDER_SUMMARIES, useExisting: OrderSummariesService },
    { provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository },
  ],
  exports: [ORDER_SUMMARIES], // nothing else leaves the module
})
export class OrderingModule {}

// index.ts – the only file other modules may import from
export { OrderingModule } from './ordering.module';
export * from './contracts/order-summaries';
```

Map domain errors to HTTP status codes in an exception filter (`error-use-exception-filters`), not inside the domain. Check the layer and module rules with dependency-cruiser in CI; the `nestjs-modular-monolith` skill sets this up.

Reference: [Modular Monolith with DDD (kgrzybek)](https://github.com/kgrzybek/modular-monolith-with-ddd) · [NestJS Modules](https://docs.nestjs.com/modules)
