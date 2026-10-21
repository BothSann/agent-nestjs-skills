# NestJS Best Practices

An agent skill with 54 NestJS rules in 11 sections, ranked by impact. Each rule has a wrong and a right code example, checked against the NestJS 12 docs.

## Install

```bash
npx skills add BothSann/agent-nestjs-skills            # this project
npx skills add BothSann/agent-nestjs-skills --global   # all projects
```

Works with Claude Code, Cursor, Codex, OpenCode, and other agents supported by [skills](https://github.com/vercel-labs/skills).

## Layout

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
