---
title: Modules Talk Only Through a Public Contract or Integration Events
impact: HIGH
impactDescription: Stops hidden coupling between modules so one module can change or move out without breaking others
tags: ddd, modular-monolith, boundaries, integration-events, facade
---

## Modules Talk Only Through a Public Contract or Integration Events

**Impact: HIGH (stops hidden coupling between modules so one module can change or move out without breaking others)**

A bounded context module must not reach into another module's internals: no importing its entities, repositories, ORM tables, or services. There are two allowed ways to talk across modules:

1. **Synchronous call through a public contract** (a facade) when you need an answer right now. The facade returns plain DTOs, never domain objects or ORM entities.
2. **Asynchronous integration events** when another module only needs to react. The receiver keeps its own copy of the data it needs.

Each module's `index.ts` is its public surface. Enforce the boundary with a lint rule so mistakes fail in CI, not in code review.

**Incorrect (reaching into another module's internals):**

```typescript
// modules/ordering/application/commands/place-order.handler.ts
import { UserOrmEntity } from '../../../identity/infrastructure/user.orm-entity'; // internal file
import { UsersService } from '../../../identity/users.service';                  // internal service

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(
    @InjectRepository(UserOrmEntity) private users: Repository<UserOrmEntity>, // reads identity's table
    private usersService: UsersService,
  ) {}

  async execute(cmd: PlaceOrderCommand) {
    const user = await this.users.findOneByOrFail({ id: cmd.userId });
    user.lastOrderAt = new Date();       // writes into another module's data
    await this.users.save(user);
    // ...
  }
}
// If identity renames a column or moves to its own service, ordering breaks.
```

**Correct (option 1 – public facade for questions that need an answer now):**

```typescript
// modules/catalog/api/catalog.facade.ts
export interface ProductPriceDto {
  productId: string;
  amount: number;
  currency: string;
  available: boolean;
}

@Injectable()
export class CatalogFacade {
  constructor(private readonly queryBus: QueryBus) {}

  getPrice(productId: string): Promise<ProductPriceDto> {
    return this.queryBus.execute(new GetProductPriceQuery(productId));
  }
}

// modules/catalog/index.ts
export { CatalogModule } from './catalog.module';
export { CatalogFacade } from './api/catalog.facade';
export type { ProductPriceDto } from './api/catalog.facade';

// modules/ordering/application/commands/add-item.handler.ts
import { CatalogFacade } from '@modules/catalog'; // public entry only

@CommandHandler(AddItemCommand)
export class AddItemHandler implements ICommandHandler<AddItemCommand> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly catalog: CatalogFacade,
  ) {}

  async execute(cmd: AddItemCommand): Promise<void> {
    const price = await this.catalog.getPrice(cmd.productId);
    if (!price.available) throw new ProductUnavailableError(cmd.productId);

    const order = await this.orders.getById(cmd.orderId);
    order.addItem(cmd.productId, cmd.qty, Money.of(price.amount, price.currency));
    await this.orders.save(order);
  }
}
```

**Correct (option 2 – integration events for things that only need to react):**

```typescript
// modules/identity/contracts/user-registered.integration-event.ts
// Contracts are a stable, versioned shape. Never put domain objects in them.
export class UserRegisteredIntegrationEvent {
  static readonly type = 'identity.user-registered.v1';
  constructor(
    readonly eventId: string,
    readonly userId: string,
    readonly email: string,
    readonly occurredAt: string,
  ) {}
}

// modules/ordering/infrastructure/handlers/user-registered.handler.ts
// Ordering keeps its own small copy: { userId, email }. It never reads identity's tables.
@Injectable()
export class UserRegisteredHandler {
  constructor(private readonly customers: CustomerReadModelRepository) {}

  async handle(event: UserRegisteredIntegrationEvent): Promise<void> {
    await this.customers.upsert({ userId: event.userId, email: event.email });
  }
}
// Deliver integration events through the outbox (see ddd-transactional-outbox).
```

**Enforce the boundary with ESLint:**

```javascript
// eslint.config.mjs
export default [
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          // Block deep imports into any module; allow '@modules/<name>' (its index.ts) only
          group: ['@modules/*/*', '**/modules/*/domain/**', '**/modules/*/infrastructure/**', '**/modules/*/application/**'],
          message: 'Import other modules only through their public entry: @modules/<name>',
        }],
      }],
    },
  },
];
// Inside a module, use relative imports (./, ../) for its own files.
// Limit: this pattern cannot see relative paths that climb into a sibling module
// (e.g. '../../../identity/...'). For full checks, use eslint-plugin-boundaries
// or dependency-cruiser, which understand folder-to-folder rules.
```

Reference: [Modular Monolith with DDD (kgrzybek)](https://github.com/kgrzybek/modular-monolith-with-ddd) · [ESLint no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
