---
title: Split Writes and Reads with CQRS
impact: MEDIUM
impactDescription: Writes stay safe through aggregates while reads stay fast and shaped for the screen
tags: ddd, cqrs, commands, queries, nestjs-cqrs
---

## Split Writes and Reads with CQRS

**Impact: MEDIUM (writes stay safe through aggregates while reads stay fast and shaped for the screen)**

CQRS means Command Query Responsibility Segregation: changing data and reading data take different paths.

- A **command** changes state. Its handler loads an aggregate through its repository, calls a method, and saves. It returns nothing or just an id.
- A **query** reads state. Its handler skips the domain model and reads with plain SQL or a read model, returning a DTO shaped for the caller. It never changes data.

Use `@nestjs/cqrs` for the command, query, and event buses. Controllers stay thin: they turn HTTP into a command or query and nothing more. Use CQRS inside bounded contexts with real business rules. For simple CRUD modules it adds files without adding value.

**Incorrect (one service does both; reads load full aggregates):**

```typescript
@Injectable()
export class OrdersService {
  async place(orderId: string) {
    const order = await this.repo.findOne({ where: { id: orderId }, relations: ['lines'] });
    order.status = 'placed';
    return this.repo.save(order); // returns the whole entity to the client
  }

  async listForCustomer(customerId: string) {
    // Loads every aggregate with all lines, then maps in memory, just to show a list
    const orders = await this.repo.find({ where: { customerId }, relations: ['lines'] });
    return orders.map((o) => ({
      id: o.id,
      total: o.lines.reduce((s, l) => s + l.price * l.qty, 0),
    }));
  }
}
```

**Correct (command and handler):**

```typescript
// application/commands/place-order/place-order.command.ts
export class PlaceOrderCommand extends Command<void> {
  constructor(readonly orderId: string) {
    super();
  }
}

// application/commands/place-order/place-order.handler.ts
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute({ orderId }: PlaceOrderCommand): Promise<void> {
    const order = await this.orders.getById(orderId);
    order.place();                 // rules live in the aggregate
    await this.orders.save(order); // events go to the outbox in the same transaction
  }
}
```

**Correct (query and handler read directly, no aggregate):**

```typescript
// application/queries/list-customer-orders/list-customer-orders.query.ts
export interface OrderSummaryDto {
  id: string;
  status: string;
  totalCents: number;
  itemCount: number;
  placedAt: string | null;
}

export class ListCustomerOrdersQuery extends Query<OrderSummaryDto[]> {
  constructor(readonly customerId: string, readonly limit = 20, readonly offset = 0) {
    super();
  }
}

// application/queries/list-customer-orders/list-customer-orders.handler.ts
@QueryHandler(ListCustomerOrdersQuery)
export class ListCustomerOrdersHandler implements IQueryHandler<ListCustomerOrdersQuery> {
  constructor(private readonly dataSource: DataSource) {}

  async execute({ customerId, limit, offset }: ListCustomerOrdersQuery): Promise<OrderSummaryDto[]> {
    // One SQL query, only the columns the screen needs
    return this.dataSource.query(
      `SELECT o.id,
              o.status,
              COALESCE(SUM(l.unit_price_cents * l.qty), 0)::int AS "totalCents",
              COUNT(l.id)::int                                   AS "itemCount",
              o.placed_at                                        AS "placedAt"
         FROM ordering.orders o
         LEFT JOIN ordering.order_lines l ON l.order_id = o.id
        WHERE o.customer_id = $1
        GROUP BY o.id
        ORDER BY o.placed_at DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
      [customerId, limit, offset],
    );
  }
}
```

**Correct (thin controller and module wiring):**

```typescript
// api/orders.controller.ts
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/place')
  @HttpCode(204)
  place(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.commandBus.execute(new PlaceOrderCommand(id));
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto): Promise<OrderSummaryDto[]> {
    return this.queryBus.execute(new ListCustomerOrdersQuery(user.id, q.limit, q.offset));
  }
}

// app.module.ts
@Module({
  imports: [CqrsModule.forRoot(), OrderingModule /* , other bounded contexts */],
})
export class AppModule {}

// ordering.module.ts
@Module({
  imports: [CqrsModule],
  controllers: [OrdersController],
  providers: [
    PlaceOrderHandler,
    ListCustomerOrdersHandler,
    { provide: ORDER_REPOSITORY, useClass: TypeOrmOrderRepository },
  ],
})
export class OrderingModule {}
```

Start with one database and plain SQL reads like above. Only add a separate read database or projections when reads are truly too slow; that brings eventual consistency (reads can lag a moment behind writes).

Reference: [NestJS CQRS](https://docs.nestjs.com/recipes/cqrs) · [Martin Fowler – CQRS](https://martinfowler.com/bliki/CQRS.html)
