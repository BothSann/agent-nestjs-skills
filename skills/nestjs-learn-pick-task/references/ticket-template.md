# TICKET.md template

Copy this shape. Fill every part. Keep words plain.

```markdown
---
id: L-04
status: proposed
kind: endpoint
branch: feat/create-user
---

# Ticket L-04: Create user

## Story

As a visitor, I want to sign up with my email and a password, so that I can log in later.

## Why now

- Build order step 1 is "Users". `POST /api/v1/users` is a stub.
- The stub returns `This action adds a new user` from `UsersService.create()`. Nothing is saved.

## Scope

In:
- `POST /api/v1/users` with `CreateUserDto` (`email`, `password`).
- Save the user with a hashed password. Answer with `UserResponseDto` (no password).

Out (later):
- Login. Ticket L-05.
- Email check by link. Needs mail.

## Request and answer

`POST /api/v1/users`

    { "email": "dara@example.com", "password": "secret-pass-123" }

201:

    { "id": "6f1c...", "email": "dara@example.com", "createdAt": "2026-10-22T09:00:00.000Z" }

400 (bad email):

    { "statusCode": 400, "message": ["email must be an email"], "error": "Bad Request" }

409 (email used):

    { "statusCode": 409, "message": "Email already in use", "error": "Conflict" }

## Acceptance criteria

1. A new email gives 201 and the shape above. The answer has no `password` or `passwordHash`.
2. The `users` row has a `bcrypt` hash, not the plain password (`$2b$` at the start).
3. `email: "abc"` gives 400 with `email must be an email`.
4. An extra field `"role": "admin"` gives 400 `property role should not exist`.
5. The same email twice gives 409, also when the two requests run at the same time (unique index).
6. Gates pass: every command in `gates` from the config.

## Decisions

Proposed by the agent. The owner confirms before the lesson is written.

| Question | Proposal | Why |
|---|---|---|
| `bcrypt` or `argon2`? | `bcrypt`, cost 12 | Ships prebuilt for Windows. Both are fine for passwords. |
| Check the email first, or catch the unique error? | Catch Postgres `23505` and throw `ConflictException` | A check first still lets two requests at once both pass. The index is the real guard. |

## Rare cases to think about

- Email with capitals: `Dara@Example.com`. Proposal: save it lowercased. Confirm.

## Definition of done

- All criteria proven with one curl each. Output pasted in the PR.
- Docs the change touches are updated in the same PR.
- PR open against the base branch. Small commits.
```

## Practice ticket

Same shape. The story says what goes wrong today. The criteria prove the rule.

```markdown
---
id: L-05
status: proposed
kind: practice
branch: fix/validation-whitelist
---

# Ticket L-05: Refuse unknown fields

## Story

As the owner of the API, I want unknown fields refused, so that nobody can set `role` or `isVerified` by adding it to the body.

## Why now

- `src/main.ts:9`: `new ValidationPipe({ transform: true })` has no `whitelist`.
- Rule: `nestjs-best-practices/rules/security-validate-all-input.md`.

## Acceptance criteria

1. `POST /api/v1/users` with `"role": "admin"` gives 400 `property role should not exist`.
2. A normal sign-up still gives 201.
3. Gates pass.
```

## Rules

- `id`: `ticketPrefix` from config + the lesson number. No prefix in config: `L-<NN>`.
- `kind`: `scaffold`, `endpoint`, or `practice`.
- Criteria are things a curl, a test run, or a log line can prove. Not "code is clean".
- Every criterion has a real number or string to check.
- Decisions: only real open questions. Take them from the project docs' open questions when they exist.
- Read each decision row once more before you save. The "Proposal" must agree with its own "Why".
- `branch`: the branch name the guide will use. The scanner matches it against merged PRs to spot a finished lesson.
- Answer shapes follow the app's real error shape. Read its exception filter first. The shapes above are Nest's defaults.
- Example code in a ticket is shape only. The real shape comes from the sibling files in the app.
