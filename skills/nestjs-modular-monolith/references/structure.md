# Structure

Examples are from a NestJS 12 ESM app that passes the rules (`.js` suffixes; drop them in CommonJS). `billing`/`catalog` are examples only.

```
src/
├── main.ts, app.module.ts      root files; AppModule imports each module from its index.ts
├── app.module.spec.ts          compiles AppModule: proves the wiring
├── shared/{domain,application,infrastructure,api}/   technical only, empty until needed
└── modules/<module>/
    ├── domain/                 entities, value objects, rules, domain errors, repository interfaces + tokens; plain TS
    ├── application/commands/   use cases that change state
    ├── application/queries/    use cases that read state; may query directly, return view objects
    ├── infrastructure/         repository implementations, ORM entities, mappers, clients, integration event handlers
    ├── api/                    controllers, DTOs, guards, pipes
    ├── contracts/              types, interfaces, tokens, event shapes other modules may use; no logic
    ├── <module>.module.ts      providers, token bindings, exports (contract tokens only)
    └── index.ts                exports the Nest module and contracts/ only
```

Integration event handlers live in infrastructure/ (inbox, transactions), then call a use case.

## Use cases: CQRS shape, no bus

Plain injectable classes; controllers inject them, so a missing provider fails at startup. A command loads an aggregate, calls one method, saves.

```ts
// modules/billing/application/commands/create-invoice.handler.ts
@Injectable()
export class CreateInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(PRODUCT_PRICES) private readonly prices: ProductPrices,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<string> {
    const lines: InvoiceLine[] = [];
    for (const item of input.items) {
      const price = await this.prices.findPrice(item.productId);
      if (price) lines.push({ ...item, unitPriceCents: price.amountCents });
    }
    const invoice = Invoice.create(randomUUID(), lines); // the rule lives in the domain
    await this.invoices.save(invoice);
    return invoice.id;
  }
}

// modules/billing/api/invoices.controller.ts
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly createInvoice: CreateInvoiceHandler) {}

  @Post()
  async create(@Body() body: CreateInvoiceDto): Promise<{ id: string }> {
    return { id: await this.createInvoice.execute(body) };
  }
}
```

## Calling another module

The provider puts an interface and token in contracts/, binds it, and exports only the token:

```ts
// modules/catalog/contracts/product-prices.ts
export interface ProductPrice { productId: string; amountCents: number }
export interface ProductPrices { findPrice(productId: string): Promise<ProductPrice | null> }
export const PRODUCT_PRICES = Symbol('PRODUCT_PRICES');

// modules/catalog/catalog.module.ts
@Module({
  providers: [
    ProductPricesService, // application/ class implementing ProductPrices
    { provide: PRODUCT_PRICES, useExisting: ProductPricesService },
    { provide: PRODUCT_REPOSITORY, useClass: InMemoryProductRepository },
  ],
  exports: [PRODUCT_PRICES],
})
export class CatalogModule {}

// modules/catalog/index.ts
export { CatalogModule } from './catalog.module.js';
export * from './contracts/product-prices.js';
```

The consumer imports from index.ts only: `imports: [CatalogModule]` in `billing.module.ts`, and `import { PRODUCT_PRICES, type ProductPrices } from '../../../catalog/index.js'` in the handler. To react to something instead of asking, use integration events (options.md).

## Shared kernel

Add a file only when two modules need the same technical piece; never business concepts. No base classes by default (DDD needs no `AggregateRoot` superclass); add one when several aggregates repeat code.

Common first need: domain errors → HTTP, since api/ cannot import domain classes:

```ts
// shared/domain/domain-error.ts
export type DomainErrorKind = 'not-found' | 'conflict' | 'invalid';
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;
}

// shared/api/domain-error.filter.ts: app.useGlobalFilters(new DomainErrorFilter()) in main.ts and e2e tests
const STATUS: Record<DomainErrorKind, HttpStatus> = {
  'not-found': HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  invalid: HttpStatus.UNPROCESSABLE_ENTITY,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = STATUS[error.kind];
    host.switchToHttp().getResponse<Response>().status(status) // Express; Fastify: reply.status().send()
      .json({ statusCode: status, code: error.code, message: error.message });
  }
}
// domain: class EmptyInvoiceError extends DomainError { readonly code = 'billing.empty-invoice'; readonly kind = 'invalid'; }
```

## Tests

Unit tests sit next to code and may cross layers inside a module (an application test with an in-memory repository); module boundaries still apply. Domain tests need no Nest testing module or database.
