# nestjs-learn-write-lesson

Turns a picked ticket into a lesson you can follow. The agent builds and tests the complete solution in a separate Git worktree, with isolated persistence only when needed, keeps the docs in your main repo's `learn/`, then gives you one step at a time. It keeps your project's package manager, runner, database engine, and architecture.

## What it covers

- Confirm the ticket's decisions with you
- Complete runnable app in `<lessonWorktreesPath>/NN-slug`, at normal app paths. No `ref/` folder or scratch app.
- When persistence is needed, a separate lesson database or file, like `shop_lesson_04`. Your database is never touched. The bundled helper is PostgreSQL-only; other engines use native tools.
- Unit and e2e tests and your gates, run in the worktree
- Code that follows your project rules first, then the `nestjs-best-practices` skill
- `README.md`, `GUIDE.md`, `check-yourself.md` (quiz, answer under each question)
- Step 1 only, then wait

## Skill structure

```
nestjs-learn-write-lesson/
├── SKILL.md
├── scripts/
│   ├── lesson-db.mjs           make and check the lesson database; never prints secrets, never drops
│   └── lesson-db.test.mjs      tests, no database needed
└── references/
    ├── worktree-run.md         worktree, lesson database, build, prove
    ├── readme-template.md
    ├── guide-template.md
    ├── check-yourself-template.md
    └── hard-rules.md ...       same 6 files in every nestjs-learn-* skill
```

## Test the database helper

```bash
node --test scripts/lesson-db.test.mjs
```

The tests use temp folders and never connect to a database.
