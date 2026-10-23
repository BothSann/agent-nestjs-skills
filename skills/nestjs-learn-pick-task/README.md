# nestjs-learn-pick-task

Finds what is not built yet in your NestJS app, and what it does not do well yet. Offers 3 tasks to learn from. Writes the ticket for the one you pick.

## What it covers

- First run: makes `learn/learn.config.json` with you
- A read-only scanner: routes (with global prefix and version), stubs, tables, migrations, classes, tests, lessons
- Doc endpoints split into done, stub, and missing
- Best-practice hints mapped to `nestjs-best-practices` rule files
- An empty repo: the scaffold lesson first
- `TICKET.md` with story, scope, criteria, decisions

## Skill structure

```
nestjs-learn-pick-task/
├── SKILL.md                    the flow
├── scripts/
│   ├── scan-project.mjs        read-only scanner, JSON on stdout
│   └── scan-project.test.mjs   tests; builds a fake Nest repo in a temp folder
└── references/
    ├── first-run.md            make learn.config.json
    ├── practice-tasks.md       scan hint to lesson, scaffold lesson
    ├── scoring.md              rank the candidates
    ├── ticket-template.md      TICKET.md shape
    └── hard-rules.md ...       same 6 files in every nestjs-learn-* skill
```

## Try the scanner

```bash
node scripts/scan-project.mjs /path/to/repo --no-gh
node --test scripts/scan-project.test.mjs
```

In this repo, the tests also check that the 6 shared reference files are the same in all 3 `nestjs-learn-*` skills.
