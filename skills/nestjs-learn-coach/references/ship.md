# "ship it": gates, proofs, commits, PR

The owner runs every command here. You give them in order and read the output.

## 1. Prove each acceptance criterion

One curl (or test, or log line) per criterion from `TICKET.md`.
Owner runs it. Owner pastes the output. You compare with the ticket.

PowerShell example (from `shell` in config):

```powershell
curl.exe -s -i -X POST "http://localhost:3000/api/v1/users" -H "Content-Type: application/json" -d '{"email":"dara@example.com","password":"secret-pass-123"}'
```

Record the result in a table. It goes in the PR body:

```markdown
| # | Criterion | Command | Result |
|---|---|---|---|
| 1 | New email gives 201, no password in the answer | `curl.exe ... POST /users` | 201, keys `id`, `email`, `createdAt` |
| 3 | Bad email gives 400 | `curl.exe ... "email":"abc"` | 400, `email must be an email` |
| 5 | Same email twice gives 409 | second `curl.exe ...` | 409, `Email already in use` |
```

Tests in the owner's app are not required unless the owner asked for them in this lesson.

## 2. Gates

Every command in `gates` from config, from `appPath`. Example:

```bash
npm run lint
npm run build
npm test
```

All must pass. A failure: go to "stuck" or "check" for that file.

## 3. Docs

Update the docs the change touches, in the same PR.
Example: the endpoint moves from "planned" to "done" in the scope doc, or `.env.example` gets the new key.

## 4. Commits

- One commit per small piece. Shape from `commitStyle`. Example: `feat(users): add CreateUserDto and UserResponseDto`.
- Give exact commands. Owner runs them:

```bash
git add src/users/dto/create-user.dto.ts src/users/dto/user-response.dto.ts
git commit -m "feat(users): add CreateUserDto and UserResponseDto"
```

- Never `git add -A` or `git add .`. `learn/` and `.env` must not be staged. Check with `git status` before each commit.

## 5. PR

Owner pushes and opens the PR against `baseBranch`. You write the body:

```markdown
## Summary

- `POST /api/v1/users` saves the user with a bcrypt hash and answers with `UserResponseDto`.
- Unique index on `users.email`; a used email gives 409.

## Scope

In: `POST /api/v1/users`. Out: login (L-05).

## Acceptance criteria

<the table from step 1>

## Gates

Lint: pass. Build: pass. Tests: 14 passed.
```

## 6. Close the lesson

- `TICKET.md` frontmatter: `status: done`.
- README "Where you are now": "Done. PR #N."
- The lesson worktree stays. Tell the owner how to remove it when they want: `git worktree remove <path>`. The lesson database stays too; to drop it: `dropdb <name>_lesson_<NN>`. The owner runs both.
- Offer the next task: say **"what should I learn next"** (runs `nestjs-learn-pick-task`).
