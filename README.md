# NestJS Best Practices

An agent skill with 54 NestJS rules in 11 sections, ranked by impact. Each rule has a wrong and a right code example, checked against the NestJS 12 docs.

## Install

```bash
npx skills add BothSann/agent-nestjs-skills            # this project
npx skills add BothSann/agent-nestjs-skills --global   # all projects
```

Works with Claude Code, Cursor, Codex, OpenCode, and other agents supported by [skills](https://github.com/vercel-labs/skills).

## Learn skills (separate)

Three more skills for learning NestJS by building your own app. You type the code; the agent picks tasks, writes lessons, and reviews.

| You say | Skill | What happens |
|---|---|---|
| "what should I learn next?" | `nestjs-learn-pick-task` | Scans your app (or empty repo). Offers 3 tasks: scope-doc endpoints or best-practice gaps. Writes `TICKET.md`. |
| "write the lesson" | `nestjs-learn-write-lesson` | Builds and tests the solution in a Git worktree, with isolated persistence when needed. Writes the lesson in `learn/`. |
| "done" / "stuck" / "check" / "ship it" | `nestjs-learn-coach` | Next step, help, review, or gates and PR. |

```bash
npx skills add BothSann/agent-nestjs-skills --skill nestjs-learn-pick-task --skill nestjs-learn-write-lesson --skill nestjs-learn-coach
```

They use `nestjs-best-practices` for code quality when it is installed. Each learn skill is self-contained: six shared files are copied into each `references/` folder, so change all three copies together.

The skills adapt to the project's stack and rules: npm, pnpm, Yarn, or Bun; root apps or custom monorepo paths; CRUD or DDD; and the existing runner and database engine. Planning filenames and task IDs are configurable or optional. The bundled database helper supports PostgreSQL only; other engines use their native isolation tools. Scanner results are hints, with manual review for patterns it cannot parse.

## Modular monolith skill (separate)

`nestjs-modular-monolith` sets up a new or existing NestJS app as a modular monolith: business modules with `domain/`, `application/`, `infrastructure/`, `api/`, and `contracts/` layers, a public `index.ts` per module, and dependency-cruiser rules that fail the build when an import crosses a boundary. A self-test in a temp project proves each rule blocks what it should and allows what it should. For existing apps it records today's violations as a baseline and suggests a migration order; it does not move code.

```bash
npx skills add BothSann/agent-nestjs-skills --skill nestjs-modular-monolith
```

Works with any database or ORM; npm, pnpm, Yarn (node-modules linker, not Plug'n'Play), or Bun; ESM or CommonJS. Import rules cannot prove good business boundaries or stop cross-module table access; the skill says so in its report.

## Layout

Instruction-token measurements and reproduction commands: [token benchmark](benchmarks/tokens/README.md). Counts measure explicitly selected instruction files, not full agent usage.

- `skills/nestjs-best-practices/SKILL.md`: entry point and quick reference
- `skills/nestjs-best-practices/rules/`: one file per rule
- `AGENTS.md`: generated index, one line per rule (do not edit by hand)

## Add or change a rule

1. Copy `rules/_template.md` to `rules/<prefix>-<name>.md`. The prefix sets the section: `arch-`, `di-`, `error-`, `security-`, `perf-`, `test-`, `db-`, `api-`, `micro-`, `devops-`, `ddd-`.
2. Fill in the frontmatter (`title`, `impact`, `impactDescription`, `tags`), an **Incorrect** and a **Correct** example, and a reference link.
3. Rebuild the index:

   ```bash
   cd scripts && npm install && npm run build
   ```

Impact levels: `CRITICAL`, `HIGH`, `MEDIUM-HIGH`, `MEDIUM`, `LOW-MEDIUM`.

## Credits

Forked from [Kadajett/agent-nestjs-skills](https://github.com/Kadajett/agent-nestjs-skills). Structure inspired by [Vercel's agent skills](https://github.com/vercel-labs/agent-skills).
