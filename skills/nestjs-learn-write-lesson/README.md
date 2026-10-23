# nestjs-learn-write-lesson

Turns a picked ticket into a lesson you can follow. The agent builds and tests the complete solution in a separate Git worktree, against its own Postgres database, keeps the docs in your main repo's `learn/`, then gives you one step at a time.

## What it covers

- Confirm the ticket's decisions with you
- Complete runnable app in `<lessonWorktreesPath>/NN-slug`, at normal app paths. No `ref/` folder or scratch app.
- A lesson database next to yours, like `shop_lesson_04`. Your database is never touched.
- Unit and e2e tests and your gates, run in the worktree
- Code that follows your project rules first, then the `nestjs-best-practices` skill
- `README.md`, `GUIDE.md`, `check-yourself.md` (quiz, answer under each question)
- Step 1 only, then wait

## Skill structure

```
nestjs-learn-write-lesson/
├── SKILL.md
├── scripts/lesson-db.mjs       make and check the lesson database; never prints secrets, never drops
└── references/
    ├── worktree-run.md         worktree, lesson database, build, prove
    ├── readme-template.md
    ├── guide-template.md
    ├── check-yourself-template.md
    └── hard-rules.md ...       same 6 files in every nestjs-learn-* skill
```
