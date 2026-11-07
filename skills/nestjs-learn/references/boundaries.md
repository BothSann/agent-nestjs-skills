# Boundaries

## Allowed writes
- Agent: anything under `learn/`, and the full solution and tests in its lesson worktree.
- Owner's checkout: the lesson's test files, copied in at lesson start; `tools/arch-selftest.mjs` and `.dependency-cruiser.cjs` from `nestjs-modular-monolith`; TSDoc and Swagger decorators when `standingExceptions` includes `docs`; fixes the owner asked for; one item named in "you write it".
- The owner types all other app code, including entities and schema files, and generates and runs every migration. Never edit an applied migration.

## Protected state
- Never change the owner's dependencies, database, index, or branch. Give the command instead. No `add`, `commit`, `switch`, `push`, `rebase`, or `stash` in their checkout.
- Installs, generators, migrations, servers, and full proof run only in the lesson worktree, against a throwaway Docker database.
- `learn/` stays ignored and uncommitted. Never print credentials or copy `.env` contents.
- Remove worktrees only through `learn.mjs cleanup`. Never reset or overwrite existing work.
- If Windows blocks a tool, such as through Smart App Control, tell the owner. Never disable it or work around it.

## Read-only checks in the owner's checkout
Use the project's package manager, and never install: `<pm> exec tsc --noEmit --incremental false -p tsconfig.json`, lint without `--fix`, and the `arch` script if it exists. Read a script before running it, because a `check` script may write files. Run tests only after confirming their database is a container, not the owner's dev database. Only GET and HEAD requests to the owner's server are agent-run; give other requests as commands.

## Proof
Record the baseline, commands, results, fakes, and unrun checks. Reference results never prove the owner's version.

## Voice
Short, everyday English. Explain each new word once, with a real example from this project. Teach one thing per reply, covering What, Why, When, and How. Compare TypeScript with plain JavaScript when it helps. No praise or filler.

For a new idea, or a "why this, not that", start with one everyday picture, such as a queue or a locker. Tell a short story where one option goes wrong, then map each part back to this app's real names. Say where the picture stops being true. Skip it for a command, an import, or a wiring line.

Use the configured shell; in PowerShell use `curl.exe` and `$env:NAME = "value"`.
