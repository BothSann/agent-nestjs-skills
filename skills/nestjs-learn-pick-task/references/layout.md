<!-- Same file in all 3 nestjs-learn-* skills. Change the 3 copies together. -->

# Lesson layout

Lesson docs live in `learn/` at the main repo root. `learn/` is git-ignored.
The complete runnable solution lives in a separate worktree beside the repo.

```
learn/
  learn.config.json          project facts (see project-config.md)
  01-scaffold-app/
    TICKET.md                the job: story, scope, criteria, decisions
    README.md                goal, new words, step table, where you are now
    GUIDE.md                 each step: what, why, how, code, words, check
    check-yourself.md        quiz: each answer hidden right under its question
  notes/
    providers-and-di.md      one idea per note, written when the owner asks
```

```text
<lessonWorktreesPath>/
  04-me-endpoint/             complete app checkout; agent builds and tests here
    <appPath>/                same app paths as the main repo
```

Resolve `lessonWorktreesPath` from config; its default is the sibling `<repo-name>-lessons` folder. Do not create `ref/` folders or another scratch copy. Keep the worktree available throughout the lesson. Do not delete it automatically when the owner ships.

## Names

- Folder: `NN-kebab-slug`. `NN` is two digits and follows build order. Example: `04-me-endpoint`.
- The next number is the highest `NN` in `learn/` plus 1.
- The lesson database: `<owner's database name>_lesson_<NN>`. Example: `shop_lesson_04`.

## Solution workspace

Each lesson README and GUIDE must record:

- The resolved worktree path and app path inside it.
- The starting commit and any uncommitted changes copied into the baseline.
- The files the lesson changes, including new files.
- The lesson database name, proof commands and results, and anything not run or faked. Never record credentials.

The worktree is the only complete solution. GUIDE snippets come from its tested files. Compare the owner's code with the listed solution files, but accept other code that meets the ticket and the rules.

## Lesson status

`TICKET.md` starts with frontmatter. The scanner reads `status`, `kind`, and `branch`.

```markdown
---
id: L-04
status: in-progress
kind: endpoint
branch: feat/me-endpoint
---
```

| Status | Means | Set by |
|---|---|---|
| `proposed` | task picked, ticket written, decisions not confirmed | `nestjs-learn-pick-task` |
| `in-progress` | worktree solution and guide ready, proof recorded, owner is typing | `nestjs-learn-write-lesson` |
| `done` | criteria proven, PR open or merged | `nestjs-learn-coach` (ship) |
| `dropped` | owner chose to stop it | owner or agent on request |

| Kind | Means |
|---|---|
| `scaffold` | lesson 01 in an empty repo: `nest new` and a first app that boots |
| `endpoint` | one endpoint or one table from the scope doc |
| `practice` | one best-practice rule the app breaks or lacks, like graceful shutdown |

A lesson with no `TICKET.md` or no `status` shows as `unknown` in the scan.

## Notes

- `learn/notes/<idea>.md`. One idea each.
- Write one when the owner says "explain in the learn folder".
- Link it from the lesson README.
