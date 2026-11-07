# Pick a task

1. Run `node <skill-dir>/scripts/learn.mjs scan <repo>`, with `--no-gh` if `gh` isn't available. Blockers: `no_config` and `old_config` need [config.md](config.md). `no_git`: the owner initialises Git. `git_unavailable`: fix access and never recreate the repo. `several_apps`: ask, then set `appRoot`. `router_module`: paths may lack RouterModule prefixes, so confirm them in source.
2. A lesson marked merged but still in-progress: confirm with the owner and set it to done. Then run `learn.mjs cleanup <repo>` to remove merged worktrees, and report what it removed.
3. Read the plan and confirm scan results in source, because they are static heuristics.
4. Offer up to three feasible slices, mark one **next**, and say why. Name the Nest and TypeScript ideas each one teaches. Wait for the choice.

## Ranking
The project plan and prerequisites beat scores. An in-progress lesson is always first. An empty repo offers the scaffold only.

| Signal | Score |
|---|---|
| Earliest unfinished plan step | +3 |
| Security hint | +3 |
| Stub route, other hint | +2 |
| New Nest or TypeScript concept (check `grep "^## " learn/concepts.md`) | +2 |
| New package needed | -1 |

Split anything over one endpoint, table, or practice, because lessons allow 6 steps. If core TypeScript hasn't come up in several lessons, such as generics, union narrowing, or async pitfalls, offer a small practice task that uses it in this app.

Scaffold scope: `nest new . --package-manager pnpm --skip-git --strict`, Vitest as the runner, the `nestjs-modular-monolith` layout and its `arch` checks, `ConfigModule` with validation, a global `ValidationPipe`, shutdown hooks, one route, and the gates. Add Prisma only if the task needs a database.

## After the choice
In-progress: give the current step. Proposed: show decisions, then wait for "write the lesson". New: write only `learn/NN-slug/TICKET.md`:

```markdown
---
id: L-NN
status: proposed
kind: scaffold | endpoint | practice
branch: feat/short-name
---
# Ticket L-NN: <small task>

## Story
As <actor>, I want <behavior>, so that <reason>.

## Why now
<Plan step and evidence.>

## Scope
<In and out. One teachable slice.>

## Request and answer
<Real method, path, input, and every status code.>

## Acceptance criteria
1. <Observable outcome with concrete values, including refusals.>
2. <Configured gates pass.>

## Decisions
| Question | Proposal | Why |
|---|---|---|
```

Statuses: proposed, in-progress, done, dropped. End with: "Read the ticket, change decisions if needed, then say **write the lesson**."
