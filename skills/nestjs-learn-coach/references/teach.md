# How to teach

## Plain TypeScript first, then Nest

Show the idea with no framework. Then show what Nest adds.

Example: a controller and a service.

```typescript
// Plain TypeScript: you make every object yourself, in the right order.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const users = new UsersService(new UsersRepository(pool));
server.post('/users', async (req, res) => res.status(201).json(await users.create(req.body)));
```

```typescript
// Nest: you say what each class needs. Nest makes them, once, in the right order.
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }
}
```

## Open the magic once

The first time a magic part shows up, show what it really does.

| Magic | Show it with |
|---|---|
| Dependency injection | Log in a service constructor. The log prints once at startup, not once per request. |
| Decorators | A decorator is a function that runs when the class loads. `@Get(':id')` saves "GET, :id" as metadata on the method. |
| `ValidationPipe` | Send a bad body with curl. The 400 comes before the controller runs: a log line in the controller never prints. |
| ORM queries | In the lesson worktree, turn on query logs (TypeORM `logging: true`, Prisma `log: ['query']`). Show the SQL one call runs. |
| Request order | Middleware, then guards, then interceptors (before), then pipes, then the handler, then interceptors (after), then filters on error. |

## One small check per step

Use the project's package manager and runner (`project-config.md`, "Commands follow the project"). For Bun/Vitest, use `bun run test`, not `bun test`. Pure domain checks need neither Nest DI nor a database.

Best checks, in order:

1. The installed compiler with `--noEmit --incremental false` — the code compiles without writing incremental files.
2. The startup log: `Mapped {/api/v1/users, POST} route` — the route is wired.
3. One curl — the behavior is right.
4. One test — `npm test -- users.service`.

## Layers: explain each the first time

| Layer | One line |
|---|---|
| Module | A box of related classes. It says what it needs (`imports`) and what it shares (`exports`). |
| Controller | Which URL runs which method. Thin: reads the request, calls a service, returns. |
| Provider / Service | A class Nest makes for you and passes to whoever needs it. Holds the business steps. |
| DTO | A class that says what the request body or the answer looks like. |
| Pipe | Checks or changes input before the handler. Bad input: 400. |
| Guard | Says yes or no to a request before the handler. No: 401 or 403. |
| Interceptor | Wraps the handler: code before and after it, like timing or changing the answer. |
| Exception filter | Turns a thrown error into the HTTP answer. |
| Entity / schema | One table, as a TypeScript class or schema. |
| Repository | The only place that talks to the database for one table. |
| Middleware | Runs first, before Nest picks the route. Raw request and response. |

## Real names and numbers

Use this project's names. Not `Foo`, not `example.com/users`.

## Notes: "explain in the learn folder"

- Write `learn/notes/<idea>.md`. One idea. Example: `learn/notes/providers-and-di.md`.
- Shape: the question, plain answer, small code, one "try it" command.
- Link it from the current lesson's `README.md`.
