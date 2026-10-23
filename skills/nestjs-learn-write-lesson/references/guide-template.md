# GUIDE.md template

The long file. Each step: **what, why, how, the code, the words, a check.**

```markdown
# Guide: create user

You type the code. This guide says what, why, and how for each step.
Full working code is in the lesson worktree listed below. Look at it after you try.

I ran all of this in the lesson worktree against `shop_lesson_04`. 6 criteria passed. Lint and build gave 0 errors.

## Solution workspace

- Worktree: `<resolved lesson worktree path>`
- App: `<worktree>/<appPath>`
- Starting commit: `<commit>`
- Copied baseline changes: `<files and changes, or none>`
- Lesson files: `<all changed and new files>`
- Lesson database: `<name>_lesson_<NN>` (no credentials)
- Proof commands and results: `<baseline tests, final tests, gates, criterion checks and real output>`
- Faked or not run: `<specific items, or none>`

## The big idea

Today:

    create(createUserDto: CreateUserDto) { return 'This action adds a new user'; }

After this ticket:

    async create(dto: CreateUserDto): Promise<UserResponseDto> { ...hash, save, map... }

Request path:

    curl -> ValidationPipe (400 if the body is wrong) -> UsersController.create -> UsersService.create -> Postgres -> UserResponseDto -> JSON

## Rules this lesson follows

| Choice in the code | Rule | Source |
|---|---|---|
| `CreateUserDto` with `@IsEmail()`, `@MinLength(12)` | Validate all input with DTOs and pipes | best practice: `security-validate-all-input.md` |
| Answer through `UserResponseDto`, not the entity | Response DTOs stop field leaks | best practice: `api-use-dto-serialization.md` |
| Postgres `23505` becomes `ConflictException` | A unique rule lives in the database | review rules: "Database" |

Clashes between project rules and best practices: none. (Or: name the clash and say the project rule won.)

## Words used in this guide

- **Provider**: ...

## Step 6: `UsersService.create()`

**What.** One method. It hashes the password, saves the row, and returns the answer shape.

**Why.** The controller stays thin: it only passes the DTO on. The rule about a used email lives here, next to the database call.

**Plain TypeScript first.** Without Nest it would be:

    const users = new UsersService(new UsersRepository(pool));
    const answer = await users.create({ email: 'dara@example.com', password: 'secret-pass-123' });

Nest makes `UsersService` and its repository for you (dependency injection), and calls `create()` from the route.

**How.**

File: `src/users/users.service.ts`

    async create(dto: CreateUserDto): Promise<UserResponseDto> {
      const passwordHash = await bcrypt.hash(dto.password, 12);
      ...
    }

**Check.**

    npx tsc --noEmit

You should see no output. (The route is wired in step 7, so no curl yet.)
```

## Rules

- "Rules this lesson follows" is required. How to fill it: `code-quality.md`, "Show the owner where each choice comes from".
- In each step, the **Why** names the rule when one drove the choice.
- Start from plain TypeScript. Then show what Nest adds.
- Open the magic once. Examples: show the SQL a repository call runs (TypeORM `logging: true`, Prisma `log: ['query']`, in the lesson worktree), or show that Nest makes the service only once.
- One check per step. Best is `npx tsc --noEmit`, a startup log line, a curl, or one test.
- A check must pass using only the steps done so far. Bad: step 6 (service) says curl gives 201, but the controller is step 7.
- Code in this template is shape only. Copy the real shape from the sibling files. Example: if other services throw a custom `AppException`, a new service does the same.
- If proof showed an existing test breaks, explain the fix with the before and after line. The agent writes tests in the owner's app only when asked.
- "You should see" uses the real output from the worktree proof. Code snippets come from the tested worktree files.
- Commands in the owner's `shell`. PowerShell curl: `curl.exe`, double quotes on URL and headers, single quotes on JSON.
- Generator commands exactly as the owner runs them, from `generator` in config.
- Git steps list the exact commands. The owner runs them.
- The last step is ship: gates from config, one commit per small piece in `commitStyle`, PR against `baseBranch`.
