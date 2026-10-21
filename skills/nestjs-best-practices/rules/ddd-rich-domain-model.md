---
title: Keep Business Rules in a Rich Domain Model, Separate from ORM Entities
impact: HIGH
impactDescription: Rules live in one place and cannot be skipped; domain tests run without a database
tags: ddd, aggregate, value-object, domain-model, orm
---

## Keep Business Rules in a Rich Domain Model, Separate from ORM Entities

**Impact: HIGH (rules live in one place and cannot be skipped; domain tests run without a database)**

An anemic model is a class with public fields and no behavior, where every service edits it however it likes. Rules get copied across services and one of them always forgets a check. Instead:

- **Aggregate root** – the only entry point to a group of objects that must stay consistent together. It guards its own rules (invariants) in methods. Fields are private.
- **Value object** – a small immutable type defined by its values, not an id (`Money`, `Email`, `Quantity`). It validates itself on creation.
- **Domain model is plain TypeScript.** ORM decorators (`@Entity`, `@Column`) go on a separate persistence class in `infrastructure/`, with a mapper between the two. This keeps the domain free of the database shape.
- Reference other aggregates **by id only**, never by object.

**Incorrect (anemic ORM entity, rules spread across services):**

```typescript
@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() status: string;          // any string, anyone can set it
  @Column('decimal') total: number;  // can drift from the lines
  @OneToMany(() => OrderLine, (l) => l.order, { cascade: true }) lines: OrderLine[];
  @ManyToOne(() => User) customer: User; // pulls another aggregate in
}

// orders.service.ts
order.lines.push(line);
order.total += line.price * line.qty;

// admin.service.ts – forgot to update total, forgot to check status
order.lines.push(line);
order.status = 'shiped'; // typo, still saved
```

**Correct (value object):**

```typescript
// domain/money.ts
export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isFinite(amount) || amount < 0) throw new InvalidMoneyError(amount);
    return new Money(Math.round(amount * 100), currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new CurrencyMismatchError(this.currency, other.currency);
    return new Money(this.cents + other.cents, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.cents * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }
}
```

**Correct (aggregate root guards its rules):**

```typescript
// shared/domain/aggregate-root.ts – tiny base class, no framework import
export abstract class AggregateRoot {
  private domainEvents: object[] = [];

  protected apply(event: object): void {
    this.domainEvents.push(event);
  }

  // The repository calls this when saving, to write events to the outbox
  pullEvents(): object[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}

// domain/order.ts
export type OrderStatus = 'draft' | 'placed' | 'cancelled';

export class Order extends AggregateRoot {
  private constructor(
    readonly id: string,
    readonly customerId: string, // other aggregate: id only
    private status: OrderStatus,
    private readonly lines: OrderLine[],
  ) {
    super();
  }

  static create(id: string, customerId: string): Order {
    return new Order(id, customerId, 'draft', []);
  }

  // Used by the mapper to rebuild from storage. Does not raise events.
  static restore(id: string, customerId: string, status: OrderStatus, lines: OrderLine[]): Order {
    return new Order(id, customerId, status, lines);
  }

  addItem(productId: string, qty: number, unitPrice: Money): void {
    if (this.status !== 'draft') throw new OrderLockedError(this.id);
    if (qty < 1 || qty > 100) throw new InvalidQuantityError(qty);
    const existing = this.lines.find((l) => l.productId === productId);
    if (existing) existing.increase(qty);
    else this.lines.push(OrderLine.create(productId, qty, unitPrice));
  }

  place(): void {
    if (this.status !== 'draft') throw new OrderLockedError(this.id);
    if (this.lines.length === 0) throw new EmptyOrderError(this.id);
    this.status = 'placed';
    this.apply(new OrderPlacedEvent(this.id, this.customerId, this.total.cents, this.total.currency));
  }

  get total(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.subtotal), Money.zero('USD'));
  }

  get currentStatus(): OrderStatus {
    return this.status;
  }

  get orderLines(): readonly OrderLine[] {
    return this.lines;
  }
}
```

**Correct (persistence model and mapper live in infrastructure):**

```typescript
// infrastructure/persistence/order.orm-entity.ts
@Entity({ name: 'orders', schema: 'ordering' })
export class OrderOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') customerId: string;
  @Column() status: string;
  @OneToMany(() => OrderLineOrmEntity, (l) => l.order, { cascade: true, eager: true })
  lines: OrderLineOrmEntity[];
}

// infrastructure/persistence/order.mapper.ts
export class OrderMapper {
  static toDomain(row: OrderOrmEntity): Order {
    const lines = row.lines.map((l) =>
      OrderLine.restore(l.productId, l.qty, Money.of(l.unitPrice, l.currency)),
    );
    return Order.restore(row.id, row.customerId, row.status as OrderStatus, lines);
  }

  static toPersistence(order: Order): OrderOrmEntity {
    const row = new OrderOrmEntity();
    row.id = order.id;
    row.customerId = order.customerId;
    row.status = order.currentStatus;
    row.lines = order.orderLines.map((l) => OrderLineMapper.toPersistence(l, order.id));
    return row;
  }
}
```

**Domain tests need no NestJS and no database:**

```typescript
it('rejects items after the order is placed', () => {
  const order = Order.create('o-1', 'u-1');
  order.addItem('p-1', 2, Money.of(10, 'USD'));
  order.place();

  expect(() => order.addItem('p-2', 1, Money.of(5, 'USD'))).toThrow(OrderLockedError);
  expect(order.total.cents).toBe(2000);
});
```

Reference: [Martin Fowler – Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html) · [Martin Fowler – DDD Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) · [NestJS CQRS](https://docs.nestjs.com/recipes/cqrs)
