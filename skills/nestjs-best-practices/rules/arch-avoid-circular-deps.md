---
title: Avoid Circular Dependencies
impact: CRITICAL
impactDescription: "Prevents startup crashes from unresolved dependencies"
tags: architecture, modules, dependencies
---

## Avoid Circular Dependencies

Circular dependencies occur when Module A imports Module B, and Module B imports Module A (directly or transitively). NestJS can sometimes resolve these through forward references, but they indicate architectural problems and should be avoided. They are a common cause of startup errors like "Nest can't resolve dependencies of ...", and of providers that are `undefined` at runtime.

**Incorrect (circular module imports):**

```typescript
// users.module.ts
@Module({
  imports: [OrdersModule], // Orders needs Users, Users needs Orders = circular
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

// orders.module.ts
@Module({
  imports: [UsersModule], // Circular dependency!
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

**Correct (extract shared logic or use events):**

```typescript
// Option 1: Extract shared logic to a third module
// shared.module.ts
@Module({
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedModule {}

// users.module.ts
@Module({
  imports: [SharedModule],
  providers: [UsersService],
})
export class UsersModule {}

// orders.module.ts
@Module({
  imports: [SharedModule],
  providers: [OrdersService],
})
export class OrdersModule {}

// Option 2: Use events for decoupled communication
// users.service.ts
@Injectable()
export class UsersService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(data: CreateUserDto) {
    const user = await this.userRepo.save(data);
    this.eventEmitter.emit('user.created', user);
    return user;
  }
}

// orders.service.ts
@Injectable()
export class OrdersService {
  @OnEvent('user.created')
  handleUserCreated(user: User) {
    // React to user creation without direct dependency
  }
}
```

**Watch for barrel files.** A cycle can also come from `index.ts` files that re-export things. Inside a feature or context, import internal files directly instead of its own barrel (`cats/cats.controller.ts` must not import `'./'` or `'../cats'` to get `cats.service`). Across contexts, follow the declared public entry contract and keep its re-exports and dependencies acyclic. A public `index.ts` does not make circular dependencies safe. The symptom is a provider that is `undefined` at startup.

**`forwardRef()` is a last resort.** If you cannot break the cycle yet, `forwardRef(() => OtherModule)` in `imports` and `@Inject(forwardRef(() => OtherService))` in the constructor let Nest start. The order in which the two are created is not fixed, so neither constructor may call the other. Treat it as a TODO, not a fix.

Reference: [NestJS Circular Dependency](https://docs.nestjs.com/fundamentals/circular-dependency)
