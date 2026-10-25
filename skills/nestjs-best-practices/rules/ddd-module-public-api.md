---
title: Modules Talk Only Through a Public Contract or Integration Events
impact: HIGH
impactDescription: Stops hidden coupling between modules so one module can change or move out without breaking others
tags: ddd, modular-monolith, boundaries, integration-events, facade
---

## Modules Talk Only Through a Public Contract or Integration Events

**Impact: HIGH (stops hidden coupling between modules so one module can change or move out without breaking others)**

A bounded context module must not reach into another module's internals: no importing its entities, repositories, ORM tables, or services. There are two allowed ways to talk across modules:

1. **Synchronous call through a public contract** when you need an answer right now. The contract is an interface plus an injection token in the module's `contracts/` folder. It returns plain DTOs, never domain objects or ORM entities.
2. **Asynchronous integration events** when another module only needs to react. The receiver keeps its own copy of the data it needs.

Each module's `index.ts` is its public surface: the Nest module and `contracts/`, nothing else. Enforce the boundary with a tool so mistakes fail in CI, not in code review.

**Incorrect (reaching into another module's internals):**

```typescript
// modules/ordering/application/commands/place-order.handler.ts
import { UserOrmEntity } from '../../../identity/infrastructure/user.orm-entity'; // internal file
import { UsersService } from '../../../identity/users.service';                  // internal service

@Injectable()
export class PlaceOrderHandler {
  constructor(
    @InjectRepository(UserOrmEntity) private users: Repository<UserOrmEntity>, // reads identity's table
    private usersService: UsersService,
  ) {}

  async execute(input: PlaceOrderInput) {
    const user = await this.users.findOneByOrFail({ id: input.userId });
    user.lastOrderAt = new Date();       // writes into another module's data
    await this.users.save(user);
    // ...
  }
}
// If identity renames a column or moves to its own service, ordering breaks.
```

**Correct (option 1 – public contract for questions that need an answer now):**

```typescript
// modules/catalog/contracts/product-prices.ts – plain types and a token
export interface ProductPriceDto {
  productId: string;
  amount: number;
  currency: string;
  available: boolean;
}

export interface ProductPrices {
  getPrice(productId: string): Promise<ProductPriceDto>;
}

export const PRODUCT_PRICES = Symbol('PRODUCT_PRICES');

// modules/catalog/application/product-prices.service.ts – the implementation stays inside
@Injectable()
export class ProductPricesService implements ProductPrices {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async getPrice(productId: string): Promise<ProductPriceDto> {
    const product = await this.products.getById(productId);
    return { productId, amount: product.price.amount, currency: product.price.currency, available: product.isAvailable };
  }
}

// modules/catalog/catalog.module.ts
@Module({
  providers: [
    ProductPricesService,
    { provide: PRODUCT_PRICES, useExisting: ProductPricesService },
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
  ],
  exports: [PRODUCT_PRICES], // only the contract token leaves the module
})
export class CatalogModule {}

// modules/catalog/index.ts
export { CatalogModule } from './catalog.module';
export * from './contracts/product-prices';

// modules/ordering/application/commands/add-item.handler.ts
import { PRODUCT_PRICES, type ProductPrices } from '../../../catalog'; // its index.ts only

@Injectable()
export class AddItemHandler {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PRODUCT_PRICES) private readonly prices: ProductPrices,
  ) {}

  async execute(input: AddItemInput): Promise<void> {
    const price = await this.prices.getPrice(input.productId);
    if (!price.available) throw new ProductUnavailableError(input.productId);

    const order = await this.orders.getById(input.orderId);
    order.addItem(input.productId, input.qty, Money.of(price.amount, price.currency));
    await this.orders.save(order);
  }
}
// OrderingModule imports CatalogModule (from '../catalog') so the token can be injected.
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

**Enforce the boundary with dependency-cruiser:**

```javascript
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'cross-module-via-index',
      comment: 'A module reaches another module only through its index.ts.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'] },
    },
    {
      name: 'index-exposes-public-surface',
      comment: 'index.ts re-exports only the Nest module and contracts/.',
      severity: 'error',
      from: { path: '^(src/modules/[^/]+)/index\\.ts$' },
      to: { path: '^$1/', pathNot: ['^$1/contracts/', '^$1/[^/]+\\.module\\.ts$'] },
    },
  ],
  options: { tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' } },
};
// Run: npx depcruise src --config .dependency-cruiser.cjs
// It checks resolved paths, so relative imports ('../../../identity/...') and
// tsconfig aliases are both caught. ESLint's no-restricted-imports only sees the
// written string and misses relative paths into a sibling module.
// The nestjs-modular-monolith skill adds the layer rules and a self-test for the config.
```

Reference: [Modular Monolith with DDD (kgrzybek)](https://github.com/kgrzybek/modular-monolith-with-ddd) · [dependency-cruiser rules](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
