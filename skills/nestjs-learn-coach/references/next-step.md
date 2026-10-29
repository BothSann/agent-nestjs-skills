# "done": give the next step

## 1. Quick check of the step they finished

Run the step's check yourself (you, the agent), if it is read-only:

Use the package manager and scripts from `project-config.md`, "Commands follow the project"; npm examples are not fixed commands. For Bun, the compiler check is `bun run tsc --noEmit --incremental false -p tsconfig.json`.

| Step kind | Quick check |
|---|---|
| Branch | `git status`, `git log --oneline -1` |
| Install | the package is in `package.json` `dependencies` (or `devDependencies`) |
| Generate | the files exist at the expected paths, and the module is in the parent's `imports` |
| Type a file | read it. Look for the one thing the step is about. Then `npx tsc --noEmit --incremental false -p tsconfig.json`. |
| Wire a module | read `imports`, `providers`, `exports`. Then check the route (see "Check a route" below). |
| Route or controller | "Check a route" below |
| Migration ran | ask the owner to paste the migration command output. Or read the migrations table output they paste. |
| Curl | ask the owner to paste the output. Compare with the ticket. |

- Passes: say so in one line. Go to 2.
- Fails: say what you saw, in one or two lines. Do not give the next step. Offer "check" for a full review.

### Check a route

NestJS has no `route:list` command. Use the read-only scanner from `nestjs-learn-pick-task`, which sits next to this skill when both are installed (`<skills folder>/nestjs-learn-pick-task/scripts/scan-project.mjs`):

```bash
node <skills folder>/nestjs-learn-pick-task/scripts/scan-project.mjs <repo-root> --no-gh > <scratchpad>/scan.json
```

Find the route in `routes`: the full path (global prefix and version included), the handler, and `stub`. Example: `POST /api/v1/users`, `UsersController.create`, `stub: false`.

- The scanner reads `@Controller` and the route decorators. It cannot see whether the module is in `AppModule` `imports`. Read the `imports` yourself.
- Scanner not installed: ask the owner to paste the startup log line, `Mapped {/api/v1/users, POST} route`.

## 2. Give the next step

Take it from `GUIDE.md`. Give only:

- The step number and title
- **What**: the thing in one plain sentence, and its file path or command
- **Why**: the problem it solves in this app, and what breaks without it
- **When**: when it runs (boot, each request, on error, shutdown) and when they would write one again
- **How**: the command, or "GUIDE.md, step N" for the code, plus one line on the new idea in it
- The check to run, and what they should see

Take all four from the guide, shortened. Use this app's names; "best practice" or "when needed" is too vague.

Do not paste the full code from the lesson worktree. The guide has the code to type. Point to it: "GUIDE.md, step 4".

## 3. Update the README

In the lesson `README.md`, "Where you are now":

```markdown
## Where you are now

- Steps 0–3 done. `CreateUserDto` typed and checked.
- Next: step 4, `UserResponseDto`.
```

## Example

Owner: "done"

```markdown
Step 3 checked: `CreateUserDto` has `@IsEmail()` on `email` and `@MinLength(12)` on `password`. `tsc` gives no errors. Good.

## Step 4: `UserResponseDto`

What: `UserResponseDto` is the shape the API sends back for a user: `id`, `email`, `createdAt`. File: `src/users/dto/user-response.dto.ts` (new).

Why: the `User` entity has `passwordHash`. Returning the entity would send it to the client. The DTO lists only the fields the client may see.

When: it runs on every response that returns a user, when `UsersController.create()` converts the saved entity before sending it. You write one for each resource the API returns.

How: type the class from GUIDE.md, step 4. New idea: `@Expose()` marks a field as allowed; `excludeExtraneousValues: true` drops every field without it.

Check:

    npx --no-install tsc --noEmit --incremental false -p tsconfig.json

You should see no output.

Say **done**, **stuck**, or **check**.
```
