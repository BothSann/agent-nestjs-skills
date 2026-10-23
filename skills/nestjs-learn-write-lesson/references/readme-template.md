# README.md template

Short. The owner reads it first.

```markdown
# Lesson 04: create user

Read `TICKET.md` first. It is the job.
`GUIDE.md` has the what, why, and how for each step.
The lesson worktree has the full working code. Look at it after you try.
`check-yourself.md` is the quiz. Each answer is under its question.

## Goal

- Replace the `POST /api/v1/users` stub with real code that saves the user.
- Hash the password. Never send it back.

## New words

| Word | Plain meaning |
|---|---|
| DTO | A class that says what the request body must look like. `ValidationPipe` checks it. |
| Pipe | Code that runs on the input before the controller method. It can change it or refuse it with 400. |
| Hash | A one-way scramble of the password. You can check a password against it, but not get the password back. |

## Steps

| Step | Work | Who |
|---|---|---|
| 0 | Read the ticket. Confirm the decisions. | you |
| 1 | Branch `feat/create-user` from `origin/main` | you run |
| 2 | `npm install bcrypt` and `npm install -D @types/bcrypt` | you run |
| 3 | `CreateUserDto` | you type |
| 4 | `UserResponseDto` | you type |
| 5 | Migration: unique index on `users.email` | agent writes, you run |
| 6 | `UsersService.create()` | you type |
| 7 | `UsersController.create()` | you type |
| 8 | Curl: 201, 400, 409 | you run |
| 9 | Gates and PR | you run |

After each file, the agent reviews on "check". TSDoc and Swagger decorators come from the agent, if your config allows them.

## Solution workspace

- Worktree: `<resolved lesson worktree path>`
- App: `<worktree>/<appPath>`
- Starting commit: `<commit>`
- Copied baseline changes: `<files and changes, or none>`
- Lesson files: `<all changed and new files>`
- Lesson database: `<name>_lesson_<NN>`
- Proof: `<baseline and final test results, gates, criteria, fakes, anything not run>`
- Proof commands and outputs: see GUIDE.md.

## Where you are now

- The solution is done and proven in its worktree against the lesson database. (State any limits.)
- Next: step 0.
```

## Rules

- "New words": only words new to this owner. Check past lessons' README "New words" tables.
- Explain each layer the first time it shows up in any lesson: Module, Controller, Service, Provider, DTO, Pipe, Guard, Interceptor, Filter, Entity, Repository.
- The quiz lives in `check-yourself.md`, not in the README. See `check-yourself-template.md`.
- "Where you are now": update it when the owner finishes a step.
