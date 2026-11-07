# "done": check, then give the next step

For start or resume, skip to step 2.

## 1. Check the finished step
Run its check if it's read-only (see boundaries.md), otherwise ask the owner to paste the output. Use the project's manager in place of `<pm>`.

| Step kind | Quick check |
|---|---|
| Install | Package is in `package.json`, and the lockfile changed |
| Generate | Files exist at the expected paths, and the module is in its parent's `imports` |
| Typed a file | Read it for the step's one idea, then `<pm> exec tsc --noEmit --incremental false -p tsconfig.json`. Mid-lesson, copied tests may import files not typed yet: then run the step's own check |
| Route or wiring | `learn.mjs scan <repo> --no-gh` shows the route without STUB, then read the module's `imports`, `providers`, and `exports` |
| Test turned green | Run the project's test script with the file name, e.g. `pnpm test users.service` |
| Migration | Owner pastes the migrate output; read the generated file |
| Request with a write | Owner pastes the output; compare with the ticket |

Passes: say so in one line. Fails: say what you saw in one or two lines, and don't give the next step. Offer **check** for a full review.

## 2. Give the next step
Run `node <skill-dir>/scripts/learn.mjs step learn/NN-slug/GUIDE.md <N>`. Don't read the whole guide. Give:
- The step number and title.
- What, Why, When, and How, shortened. For code, point to "GUIDE.md, step N" rather than pasting it, and name the one new idea.
- A new TypeScript or Nest idea: one line, plus its `concepts.md` heading.
- The check and its expected output.
- The cue: **done** or **check**.

## 3. Update the README
In "Where you are now", write what's verified and the next step.

No steps left: tell the owner to say **ship it**.
