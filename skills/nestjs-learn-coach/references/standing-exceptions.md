# Standing exceptions: when the agent writes in the app

The owner types app code. These are the **only** times the agent writes in the app.
Check `standingExceptions` in `learn/learn.config.json`. If a value is missing there, that exception is off.

## `tsdoc` — TSDoc comments

When: after the owner's code works (their check passed).

- Add `/** ... */` comments to their public classes and methods. **Comments only. Change nothing else.**
- Say what the method does, what it throws, and when: `@throws ConflictException when the email is already used`.
- Then tell the owner what each one says, in a short table:

```markdown
| Method | Comment says |
|---|---|
| `UsersService.create()` | hashes the password, saves the user, throws `ConflictException` on a used email |
```

## `swagger` — Swagger decorators

When: a DTO or controller method is done, and `@nestjs/swagger` is installed.

- Add only decorators: `@ApiProperty()` on DTO fields, `@ApiTags()`, `@ApiOperation()`, `@ApiCreatedResponse({ type: UserResponseDto })`, `@ApiConflictResponse()`, `@ApiBearerAuth()`.
- Match the ticket's request and answer examples, including every error a client can reach.
- If the app uses the Swagger CLI plugin (`nest-cli.json` `plugins`), skip `@ApiProperty()` the plugin already adds.
- The owner checks it at the Swagger page (`/api/docs` or the path in `main.ts`).

## `migrations` — migration files

When: a step needs a table, column, or index.

- Write the migration the way the app already does:

| ORM | Agent writes | Owner runs |
|---|---|---|
| TypeORM | a migration class in the migrations folder, with `up` and `down` | `npm run migration:run` (or the app's script) |
| Prisma | the `schema.prisma` change **and** the SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`, the same SQL the worktree proof made | `npx prisma migrate dev` |
| Drizzle | the schema change and the SQL file in the migrations folder, from the worktree's `drizzle-kit generate` | `npx drizzle-kit migrate` |

- The schema change in an entity or `schema.prisma` that the lesson teaches is the owner's to type. Write only the migration file, unless the owner asks.
- **Never run the migration.** Give the command. The owner runs it.
- **Never edit a migration that already ran.** Check the applied list (owner pastes `migration:show` or `prisma migrate status` output). If it ran, write a new migration.
- After writing, explain each column, index, and default:

```markdown
| Column | Type | Why |
|---|---|---|
| `email` | `varchar(320)`, unique index `UQ_users_email` | One account per email. The index, not a `findOne`, stops two sign-ups at once. |
| `password_hash` | `varchar(100)` | bcrypt hashes are 60 characters. Room to switch to argon2 later. |
```

## Tests — only when asked

When: the owner says "check, write test" or asks for tests. One ask covers that lesson only.

- Unit tests next to the file (`users.service.spec.ts`) with `Test.createTestingModule` and `useValue` mocks.
- E2E tests in `test/` with `supertest`, using the app's real setup.
- Follow the project's testing rules if present.
- One test per acceptance criterion, plus the rare cases in the ticket.
- Run unit tests: `npm test -- users.service`. Run e2e tests only when their database is not the owner's dev database; otherwise give the command. Report pass or fail with output.

## "you write it" — one named item

When: the owner says "you write it" and names the item. Example: "you write it: the `UserResponseDto`".

- Write that item only. Not the one next to it.
- Then explain it like a lesson step: what, why, the words.
- If the item is unclear, ask which one before writing.
