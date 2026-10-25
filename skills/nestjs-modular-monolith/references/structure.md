# Structure

NestJS 12 ESM examples (`.js` suffixes; omit for CommonJS). `billing`/`catalog` are examples only.

```
src/
├── main.ts, app.module.ts      root files; import modules through index.ts
├── app.module.spec.ts          compiles AppModule: proves the wiring
├── shared/{domain,application,infrastructure,api}/   technical only; create on first use
└── modules/<module>/
    ├── domain/                 entities, value objects, rules, domain errors, repository interfaces + tokens; plain TS
    ├── application/
    │   ├── commands/           create with the first write use case
    │   └── queries/            create with the first read use case; may query directly, return view objects
    ├── infrastructure/         repository implementations, ORM entities, mappers, clients, integration event handlers
    ├── api/                    controllers, DTOs, guards, pipes
    ├── contracts/              types, interfaces, tokens, event shapes other modules may use; no logic
    ├── <module>.module.ts      providers, token bindings, exports (contract tokens only)
    └── index.ts                exports the Nest module and contracts/ only
```

`add-module.mjs`: five layers with `.gitkeep` (including `application/.gitkeep`), `<name>.module.ts`, `index.ts`. Commands/queries and shared layers are created on first use; no shared files or base classes by default.

Integration event handlers: infrastructure/ (inbox, transactions), calling a use case.

## Use cases: CQRS shape, no bus

Controllers inject use cases; missing providers fail at startup. Commands load, change, save aggregates.

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

Define contracts/ interface/token; bind and export the token:

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

Consumer: `imports: [CatalogModule]` in `billing.module.ts`; `import { PRODUCT_PRICES, type ProductPrices } from '../../../catalog/index.js'` in the handler. Import only through index.ts. For reactions, use integration events (options.md).

## Shared kernel

Share technical code only when two modules need it; never business concepts. Add base classes only for repeated aggregate code; DDD requires no `AggregateRoot` superclass.

Domain errors → HTTP without importing module domain classes into api/:

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

Colocate unit tests. They may cross layers within a module (e.g. in-memory repositories), but module boundaries still apply. Domain tests need no Nest testing module or database.
