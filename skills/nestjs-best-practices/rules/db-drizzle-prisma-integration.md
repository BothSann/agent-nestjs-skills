---
title: Register Drizzle or Prisma Once, Through Nest Providers
impact: MEDIUM-HIGH
impactDescription: One connection pool per app, clean shutdown, and transactions that really include every query
tags: database, drizzle, prisma, orm, transactions, lifecycle
---

## Register Drizzle or Prisma Once, Through Nest Providers

**Impact: MEDIUM-HIGH (one connection pool per app, clean shutdown, and transactions that really include every query)**

Drizzle and Prisma are common alternatives to TypeORM. Both go wrong the same ways: a new client (and pool) per service, connections never closed on shutdown, and queries inside a transaction that go through the normal client instead of the transaction, so they are not part of it.

- **Drizzle:** use `@nestjs/drizzle`. Register `DrizzleModule.forRoot()` once, inject with `@InjectDrizzle()`. It closes the client on `app.close()` or on shutdown signals when shutdown hooks are on.
- **Prisma:** there is no Nest package. Make one `PrismaService` that extends `PrismaClient`, export it from a `PrismaModule`, and connect and disconnect in lifecycle hooks. Prisma ORM 7 needs a driver adapter (e.g. `PrismaPg`).

**Incorrect (client per service, no shutdown, query outside the transaction):**

```typescript
@Injectable()
export class UsersService {
  private readonly prisma = new PrismaClient(); // a new pool in every service that does this

  async deleteWithPosts(id: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.prisma.post.deleteMany({ where: { authorId: id } }); // NOT in the transaction
      await tx.user.delete({ where: { id } });
    });
  }
}
```

**Correct (Drizzle):**

```typescript
// app.module.ts
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        drizzle, // from 'drizzle-orm/node-postgres'
        connection: config.getOrThrow<string>('DATABASE_URL'),
      }),
    }),
  ],
})
export class AppModule {}

// users.service.ts
@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  findOne(id: number) {
    return this.db.select().from(users).where(eq(users.id, id)).limit(1);
  }

  async deactivate(id: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      // every query in the transaction goes through tx, not this.db
      await tx.update(users).set({ isActive: false }).where(eq(users.id, id));
      await tx.delete(photos).where(eq(photos.userId, id));
    });
  }
}
```

**Correct (Prisma 7):**

```typescript
// prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL') }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect(); // fail at startup, not on the first request
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect(); // also ends the adapter's pool
  }
}

// prisma/prisma.module.ts: one shared instance for every importing module
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}

// users.service.ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  deleteWithPosts(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.post.deleteMany({ where: { authorId: id } });
      return tx.user.delete({ where: { id } });
    });
  }
}
```

Notes:

- Call `app.enableShutdownHooks()` so pools close on `SIGTERM` (see `devops-graceful-shutdown`).
- Passing `tx` through many services couples them. The `nestjs-cls` transactional plugin has Drizzle and Prisma adapters that give you `@Transactional()` and `TransactionHost` instead.
- Keep queries for a table in a repository provider (see `arch-use-repository-pattern`), so services are easy to unit test.
- Migrations: `drizzle-kit` or `prisma migrate`, run as a deploy step, never at app startup in every instance (see `db-use-migrations`).

Reference: [NestJS Drizzle](https://docs.nestjs.com/data/drizzle) · [NestJS Prisma](https://docs.nestjs.com/data/prisma) · [NestJS Async Local Storage](https://docs.nestjs.com/recipes/async-local-storage)
