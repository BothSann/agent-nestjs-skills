<!-- Shared by all three nestjs-learn-* skills; update every copy. -->
# Boundaries

The owner types app code. The agent teaches, reviews, writes lesson docs, and builds the reference solution in an isolated lesson worktree.

## Allowed writes
- Agent: `learn/NN-slug/{TICKET,README,GUIDE}.md`, `check-yourself.md`, requested notes, and the complete reference solution/tests in its worktree.
- Owner checkout: only configured `standingExceptions` (migration files, TSDoc, Swagger), tests explicitly requested for this lesson, fixes explicitly requested, or one explicitly delegated named item. Check project-config.md and the active skill's exception procedure before using an exception.
- The owner types schema/entity changes and runs migrations. Never edit an applied migration; add a new one.

## Protected state
- Never run commands that modify the owner's app, dependencies, database, index, or branch. Give the command for the owner to run. Exceptions above authorize their specific edits only.
- No `add`, `commit`, `switch`, `push`, `rebase`, `stash` in the owner checkout. Lesson preparation alone may use `git worktree add --detach` at the recorded baseline; never merge/push its solution.
- Run generators, installs, migrations, servers, and full reference-proof gates only in the isolated worktree, against isolated services. The read-only owner-checkout checks below remain allowed. Never reset/drop the owner's database. Before destructive lesson operations verify the actual isolated database name ends in `_lesson_NN` (or its explicit Prisma shadow name); an isolated file may use that basename before its extension, such as `shop_lesson_04.sqlite`. A name alone never authorizes touching the owner's target.
- Preserve existing worktrees and edits; never reset, overwrite, or remove them automatically.
- Keep `learn/` personal and ignored; never commit it or secrets. Use `.git/info/exclude`, not team `.gitignore`, for personal tools. Never print credentials or copy `.env` contents into docs/chat.

## Read-only checks
Use the project's manager/scripts; inspect nested scripts first. Compiler: `--noEmit --incremental false` (otherwise `.tsbuildinfo` may be written). Lint: no fixes. Tests: only with verified isolated targets; when unsure, let the owner run them. Scanner and Git status/diff/log are read-only.
Only GET/HEAD requests to the owner's local server are agent-run checks. Give POST/PUT/PATCH/DELETE commands to the owner.

## Proof
Record baseline, commands, results, fakes, and unrun checks. A reference solution is proven only by running it in its worktree with isolated persistence when needed; otherwise database is "not applicable". Report permitted agent-run owner-checkout checks as such; reference results never prove the owner's version. Behavior requiring writes is proven by the owner's run/output. Never claim an unrun check passed.
