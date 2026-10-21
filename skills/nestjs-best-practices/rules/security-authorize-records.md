---
title: Check Permissions per Record, Deny by Default
impact: CRITICAL
impactDescription: Stops users from reading or changing other users' data by changing an id in the URL
tags: security, authorization, policies, idor, access-control
---

## Check Permissions per Record, Deny by Default

**Impact: CRITICAL (stops users from reading or changing other users' data by changing an id in the URL)**

A role guard answers "is this user staff?". It cannot answer "may Alice see order 42?", because that depends on the order. Without a record check, any signed-in user can change the id in the URL and read someone else's data (an IDOR bug, number one in the OWASP API Top 10).

Two rules fix this:

1. **Check the record in the service, after loading it.** Then controllers, GraphQL resolvers and queue workers all share the same check.
2. **Deny by default.** A route with no permission declared should be closed, not open, so a forgotten decorator cannot leak data.

`@nestjs/authorization` does both: permissions live in `@Policy()` classes, `@Can()` checks a route, `authorize()` checks a record, and its global guard denies every handler that declares nothing.

**Incorrect (role check only, any customer can read any order):**

```typescript
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id); // Alice asks for /orders/<bob's id> and gets it
  }

  @Post(':id/refund')
  @Roles('staff')
  refund(@Param('id') id: string) {
    return this.ordersService.refund(id); // a shipped order can be refunded too
  }

  @Get('export') // no guard, no decorator: open to everyone
  export() {
    return this.ordersService.exportAll();
  }
}
```

**Correct (policy class, record checks in the service, deny by default):**

```typescript
// app.module.ts: authentication FIRST (it sets request.user), then authorization.
// AuthorizationModule registers a global guard that denies handlers with no declaration.
@Module({
  imports: [AuthenticationModule.forRootAsync({ /* ... */ }), AuthorizationModule.forRoot(), OrdersModule],
})
export class AppModule {}

// order.policy.ts: one method per permission. Only a literal `true` allows.
@Policy()
export class OrderPolicy {
  viewAll(user: User) {
    return user.roles.includes('staff');
  }

  view(user: User, order: Order) {
    return order.userId === user.id || user.roles.includes('staff');
  }

  refund(user: User, order: Order) {
    return user.roles.includes('staff') && order.status === 'paid';
  }
}

// orders.service.ts: load, then authorize against the record
@Injectable()
export class OrdersService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly orders: OrdersRepository,
  ) {}

  async findAll(user: User): Promise<Order[]> {
    // Filter in the query, not by loading every row and checking each one
    return (await this.authorization.can(OrderPolicy, 'viewAll', user))
      ? this.orders.findAll()
      : this.orders.findByUser(user.id);
  }

  async findOne(user: User, id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException();
    await this.authorization.authorize(OrderPolicy, 'view', user, order); // throws, becomes 403
    return order;
  }

  async refund(user: User, id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException();
    await this.authorization.authorize(OrderPolicy, 'refund', user, order);
    // Re-check state in the write: two parallel refunds could both have seen 'paid'
    const updated = await this.orders.updateStatusIf(id, 'paid', 'refunded');
    if (!updated) throw new ConflictException('Order is no longer paid');
    return updated;
  }
}

// orders.controller.ts: the service decides, so routes declare @Can.Anyone()
// ("anyone authentication lets through"). A route with no declaration is denied.
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @Can.Anyone()
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(user, id);
  }

  @Post(':id/refund')
  @Can.Anyone()
  refund(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.refund(user, id);
  }
}
```

Notes:

- No `@nestjs/authorization`? Keep the same shape: a policy service with one method per permission, called from services after loading the record, plus a global guard that rejects handlers without a permission decorator.
- Do not put `CacheInterceptor` on routes that check records: it answers before the handler runs, so it would serve Bob's order to Alice. Cache below the check, or per user.
- For records whose existence is sensitive, answer 404 instead of 403.
- Keep policies stateless: they are singletons shared by all requests.

Reference: [NestJS Authorization](https://docs.nestjs.com/security/authorization) · [OWASP API1: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
