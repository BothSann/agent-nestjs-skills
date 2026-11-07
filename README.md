# agent-nestjs-skills

Agent skills for NestJS. Works with Claude Code, Cursor, Codex, OpenCode, and [other agents](https://github.com/vercel-labs/skills).

| Skill | What it does |
|---|---|
| `nestjs-best-practices` | 54 rules in 11 sections, ranked by impact. Each rule has a wrong and a right example, checked against the NestJS 12 docs. |
| `nestjs-learn` | Pick a task, get a proven lesson, and be coached while you type it yourself. |
| `nestjs-modular-monolith` | Sets up module layers and public contracts, plus dependency-cruiser rules that fail the build when an import crosses a module boundary. |

## Install

```bash
npx skills add BothSann/agent-nestjs-skills                                # all skills, this project
npx skills add BothSann/agent-nestjs-skills --global                       # all skills, every project
npx skills add BothSann/agent-nestjs-skills --skill nestjs-best-practices  # one skill
```

Upgrading from 1.x: `nestjs-learn-pick-task`, `nestjs-learn-write-lesson`, and `nestjs-learn-coach` are now one `nestjs-learn` skill. Delete the old three folders from your skills directory, such as `~/.claude/skills` or `~/.agents/skills`.

## How a lesson works

1. **"What next?"** The agent scans your project, offers up to three tasks, and writes a ticket for the one you pick.
2. **"Write the lesson."** In a separate Git worktree, the agent builds the whole solution and proves it against a throwaway Postgres in Docker. It then writes the guide and copies the failing tests into your project.
3. **You type.** Each step takes 5–15 minutes and explains What, Why, When, and How, with a command that checks it.
4. **"Ship it."** You run the gates, commit, and open the PR. After the merge, the agent deletes the lesson's worktree.

| You say | The agent |
|---|---|
| `done` | Checks the step, then gives the next one |
| `check` | Reviews your code without changing it |
| `check and fix` | Reviews, fixes what it found, and shows what changed |
| `you write it: <item>` | Writes that one item and explains it |
| `ship it` | Walks you through proof, gates, commits, and the PR |

Paste an error or ask a question at any time, and you'll get the root cause and the smallest fix.

You type all app code, including entities and schema, and run every migration and commit. The agent writes the tests and, if you turn on `docs`, TSDoc and Swagger decorators. TypeScript, Node, and Nest ideas go into `learn/concepts.md` the first time they appear, in plain words with a JavaScript comparison.

The agent uses your project's package manager, test runner, and ORM. A new project starts with pnpm, Nest 12, Prisma 7, Vitest, Postgres, and the `nestjs-modular-monolith` layout. You need Node, Git, and Docker; the GitHub CLI, `gh`, is optional and lets the agent see merged PRs.

## Token use

Limits are in `benchmarks/budgets.json` and checked by `scripts/check-tokens.mjs`, counted with `o200k_base`.

| Loaded for | Limit | 1.x | Now |
|---|---|---|---|
| `nestjs-learn` description | 50 | 39–47 each | 39 |
| Picking a task | 2,000 | 3,419 | 1,747 |
| Writing a lesson | 5,000 | 9,168 | 3,499 |
| `done` | 1,800 | 3,770 | 1,569 |
| `check` | 3,000 | 5,430 | 1,928 |
| Shipping | 2,000 | not measured | 1,543 |

These count the instructions an agent reads, not a whole session. During coaching, `learn.mjs step` prints one guide step, so the rest stays unread.

## What's been tested

Before 2.0.0, a script played the learner on a throwaway app: lesson 1 scaffolded it, and lesson 2 added `POST /api/v1/notes` with Prisma and Postgres. It typed each guide exactly as written. All 12 step checks passed, its code matched the agent's tested solution, and every gate passed in its checkout. Gates caught 15 of 16 mistakes planted on purpose. The one miss, a controller calling Prisma directly with the same behavior, is left to the `check` review. Details, fixes, and limits are in [benchmarks/full-lesson-trial/2026-11-07.md](benchmarks/full-lesson-trial/2026-11-07.md). It ran on Windows only, and a script isn't a person, so it shows the guides are correct, not that they're easy to learn from.

## Layout

```
skills/<name>/SKILL.md               entry point of each skill
skills/nestjs-best-practices/rules/  one file per rule
skills/nestjs-learn/scripts/         learn.mjs and its tests
AGENTS.md                            generated rule index, do not edit
scripts/                             builds AGENTS.md, checks token budgets
benchmarks/                          budgets, token history, lesson trials
```

## Development

```bash
cd scripts && npm install
npm test                # learn.mjs and modular-monolith tests
npm run check:tokens    # token budgets
npm run build           # regenerate AGENTS.md
```

To add a rule, copy `skills/nestjs-best-practices/rules/_template.md` to `<prefix>-<name>.md` in the same folder (the prefix picks the section; see `_sections.md`), fill in the frontmatter, an **Incorrect** and a **Correct** example, and a reference link, then add it to `skills/nestjs-learn/references/check.md` and run `npm run build`.

## Credits

Forked from [Kadajett/agent-nestjs-skills](https://github.com/Kadajett/agent-nestjs-skills). Structure inspired by [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills).

## License

[MIT](LICENSE)
