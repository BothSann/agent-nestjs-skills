# "stuck": the help ladder

Go up **one rung at a time**. Stop as soon as the owner can move.
The goal is that they find it. Not that you fix it.

| Rung | Do | Example |
|---|---|---|
| 1 | Ask what they tried. Read the error with them. | "What did you run? Paste the full error." |
| 2 | Explain the error in plain words. Name the idea behind it. | "`Nest can't resolve dependencies of the UsersService (?)` means Nest does not know how to make the thing in the first constructor slot." |
| 3 | Take the worktree path from the lesson README and point to the solution file and line range. Do not paste it. | "Compare with `<lesson-worktree>/src/users/users.module.ts` lines 8–12." |
| 4 | Show the small piece they need. | The one `imports: [TypeOrmModule.forFeature([User])]` line. |
| 5 | Show the whole file. **Only if the owner asks.** | |

## Reading an error with the owner

1. Find the first line of the stack that is the owner's code, not `node_modules/`.
2. Say what the error means in one sentence.
3. Say which idea it is about: module imports, providers, DTO validation, decorators, async, config, database.

Common ones:

| Error | Plain meaning | Usual cause |
|---|---|---|
| `Nest can't resolve dependencies of the UsersService (?). Please make sure that the argument UserRepository at index [0] is available in the UsersModule context.` | Nest cannot make one of the constructor's arguments | Missing `TypeOrmModule.forFeature([User])`, or the provider's module is not imported, or it is not exported |
| `Nest cannot create the UsersModule instance ... index [0] is undefined` | An import is `undefined` when Nest reads it | Circular import between files. Look for a barrel `index.ts`, or two modules that import each other. |
| `Cannot GET /users` (404) | No route matches | Global prefix or version missing in the URL (`/api/v1/users`), or the module is not in `AppModule` `imports` |
| `400` with `property x should not exist` | A field the DTO does not list | `whitelist` and `forbidNonWhitelisted` refuse it. Add it to the DTO, or stop sending it. |
| `400` with an empty `message` list, or no validation at all | The DTO is not a class with decorators | `interface` or `type` used for `@Body()`, or no global `ValidationPipe` |
| `500` with `QueryFailedError: duplicate key value violates unique constraint` | Postgres refused a second row with the same unique value | Catch code `23505` and throw `ConflictException` |
| `QueryFailedError: relation "users" does not exist` | The table is not in the database | Migration not run |
| `TypeError: Cannot read properties of undefined (reading 'findOne')` | `this.x` is `undefined` | Constructor param without `private readonly`, or a method passed as a callback without its `this` |
| `Config validation error: "DATABASE_URL" is required` | Config check stopped the app at startup | `.env` missing the key, or the wrong `envFilePath` |
| `EADDRINUSE: address already in use :::3000` | Another process holds the port | An old server still running. Stop it, or set `PORT`. |
| Jest: `A worker process has failed to exit gracefully` | Something is still open after the tests | Missing `await app.close()` in `afterAll` |

## Do not

- Do not jump to rung 4 because it is faster.
- Do not fix their file. Hard rule.
- Do not run commands that change their app to "try something".
