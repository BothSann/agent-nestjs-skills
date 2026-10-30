# agent-nestjs-skills

Agent skills for NestJS. Works with Claude Code, Cursor, Codex, OpenCode, and [other agents](https://github.com/vercel-labs/skills).

| Skill | What it does |
|---|---|
| `nestjs-best-practices` | 54 rules in 11 sections, ranked by impact. Each rule has a wrong and a right example, checked against the NestJS 12 docs. |
| `nestjs-learn-pick-task` | Scans your app and offers 3 tasks to learn from. |
| `nestjs-learn-write-lesson` | Builds and tests the solution in a Git worktree, then writes the lesson. You type the code. |
| `nestjs-learn-coach` | Handles `done`, `stuck`, `check`, and `ship it` during a lesson. |
| `nestjs-modular-monolith` | Sets up module layers and public contracts, plus dependency-cruiser rules that fail the build when an import crosses a module boundary. |

## Install

```bash
npx skills add BothSann/agent-nestjs-skills                                # all skills, this project
npx skills add BothSann/agent-nestjs-skills --global                       # all skills, every project
npx skills add BothSann/agent-nestjs-skills --skill nestjs-best-practices  # one skill
```

## Layout

```
skills/<name>/SKILL.md               entry point of each skill
skills/nestjs-best-practices/rules/  one file per rule
AGENTS.md                            generated rule index, do not edit
scripts/                             builds AGENTS.md
benchmarks/                          token measurements
```

## Add a rule

1. Copy `skills/nestjs-best-practices/rules/_template.md` to `<prefix>-<name>.md` in the same folder. The prefix picks the section; see `_sections.md`.
2. Fill in the frontmatter, an **Incorrect** and a **Correct** example, and a reference link.
3. Rebuild the index: `cd scripts && npm install && npm run build`.

## Credits

Forked from [Kadajett/agent-nestjs-skills](https://github.com/Kadajett/agent-nestjs-skills). Structure inspired by [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills).

## License

[MIT](LICENSE)
