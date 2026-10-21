---
title: Handle Async Errors Properly
impact: HIGH
impactDescription: Prevents process crashes from unhandled rejections
tags: error-handling, async, promises
---

## Handle Async Errors Properly

NestJS automatically catches errors from async route handlers, but errors from background tasks, event handlers, and manually created promises can crash your application. Always handle async errors explicitly and use global handlers as a safety net.

**Incorrect (fire-and-forget without error handling):**

```typescript
// Fire-and-forget without error handling
@Injectable()
export class UsersService {
  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.repo.save(dto);

    // Fire and forget - if this fails, error is unhandled!
    this.emailService.sendWelcome(user.email);

    return user;
  }
}

// Unhandled promise in event handler
@Injectable()
export class OrdersService {
  @OnEvent('order.created')
  handleOrderCreated(event: OrderCreatedEvent) {
    // This returns a promise but it's not awaited!
    this.processOrder(event);
    // Errors will crash the process
  }

  private async processOrder(event: OrderCreatedEvent): Promise<void> {
    await this.inventoryService.reserve(event.items);
    await this.notificationService.send(event.userId);
  }
}

// Missing try-catch in scheduled tasks
@Cron('0 0 * * *')
async dailyCleanup(): Promise<void> {
  await this.cleanupService.run();
  // If this throws, no error handling
}
```

**Correct (explicit async error handling):**

```typescript
// Handle fire-and-forget with explicit catch
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.repo.save(dto);

    // Explicitly catch and log errors
    this.emailService.sendWelcome(user.email).catch((error) => {
      this.logger.error('Failed to send welcome email', error.stack);
      // Optionally queue for retry
    });

    return user;
  }
}

// Properly handle async event handlers
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.processOrder(event);
    } catch (error) {
      this.logger.error(`Failed to process order ${event.orderId}`, error instanceof Error ? error.stack : String(error));
      // @OnEvent swallows errors by default (suppressErrors: true), so without
      // this catch the failure is only logged and the work is lost. Park it for a retry.
      await this.deadLetterQueue.add('order.created', event);
    }
  }
}

// Safe scheduled tasks
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  @Cron('0 0 * * *')
  async dailyCleanup(): Promise<void> {
    try {
      await this.cleanupService.run();
      this.logger.log('Daily cleanup completed');
    } catch (error) {
      this.logger.error('Daily cleanup failed', error.stack);
      // Alert or retry logic
    }
  }
}

// Last safety net in main.ts. An unknown error means the process may be in a bad state,
// so log it, close cleanly, and exit. The orchestrator (Kubernetes, PM2, systemd) restarts it.
// Do not log and keep running.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const logger = new Logger('Process');

  const crash = (kind: string) => (error: unknown) => {
    logger.error(`${kind}, shutting down`, error instanceof Error ? error.stack : String(error));
    // Exit even if close() hangs
    setTimeout(() => process.exit(1), 10_000).unref();
    app.close().finally(() => process.exit(1));
  };
  process.on('unhandledRejection', crash('Unhandled rejection'));
  process.on('uncaughtException', crash('Uncaught exception'));

  await app.listen(3000);
}
```

Reference: [Node.js Unhandled Rejections](https://nodejs.org/api/process.html#event-unhandledrejection) · [Node.js Best Practices: exit the process gracefully on unknown errors](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/shuttingtheprocess.md) · [NestJS Events](https://docs.nestjs.com/application/events)
