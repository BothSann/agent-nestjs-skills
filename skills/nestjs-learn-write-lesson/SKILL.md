---
name: nestjs-learn-write-lesson
description: Build and prove a selected NestJS learning ticket in an isolated Git worktree, then write the lesson and give its first step. Use for "write the lesson" or a confirmed proposed ticket. Never writes the owner's app solution.
license: MIT
metadata:
  author: thannsopheakboth
  version: "1.1.0"
---

# Build a proven lesson

Reference code belongs in a separate worktree; lesson docs in the main repo's ignored `learn/NN-slug/`. Keep the project's stack, layout, and architecture.

Read the shared references once per session, reusing unchanged content:
- [hard-rules.md](references/hard-rules.md): editing and execution boundaries.
- [layout.md](references/layout.md), [voice.md](references/voice.md): artifacts and teaching.
- [project-config.md](references/project-config.md): project-native commands and isolation.
- [code-quality.md](references/code-quality.md), [review-rules.md](references/review-rules.md): sources, relevant rules, evidence.

## Workflow
1. Read TICKET. Expected status: proposed; clarify other states. Confirm unresolved decisions; retain already-confirmed answers rather than asking again.
2. Load quality sources with code-quality.md: scanner JSON from this session, or the sibling picker scanner `node <skills-dir>/nestjs-learn-pick-task/scripts/scan-project.mjs <repo> --no-gh`. If unavailable, discover configured/default sources manually and disclose the limit. Read project rules, touched-layer siblings, and only relevant best-practice files. Verify version-sensitive APIs against installed types/docs.
3. Follow [worktree-run.md](references/worktree-run.md): record baseline and necessary uncommitted changes, create/reuse an isolated detached worktree, isolate services, install there, and run baseline checks. Persistence only when needed; PostgreSQL helper versus native tools for other engines.
4. Build the complete solution at normal app paths, using the same generators/commands taught in the guide. Add only this ticket's files. Strict types, runtime input validation, explicit safe response shapes, and project-appropriate error handling.
5. Test each acceptance criterion/refusal and implemented decision. Nest providers use TestingModule/fakes; domain classes use plain tests. E2E shares real bootstrap setup and isolated persistence when used. Prove concurrency with concurrent requests when required.
6. Review against loaded rules, fix, and rerun affected tests and configured gates. Baseline regressions cannot be presented as success. Record real outputs, fakes, and anything unproven.
7. Write [README](references/readme-template.md), [GUIDE](references/guide-template.md), and [quiz](references/check-yourself-template.md) from the tested solution. Include rule sources/clashes and the complete solution-workspace proof record.
8. Mark in-progress when the reference and guide are ready; disclose incomplete proof before the first step. Give **one step only**, then wait for done/stuck/check.

## Teaching constraints
- Steps take about 5–15 minutes: one file, command, or wiring change; each says who types/runs/writes, explains What, Why, When, and How concretely (guide-template.md), and ends with a check that passes at that point. No curl before a route is wired.
- Show tested code in GUIDE, not the whole solution in chat. Use the owner's shell, manager, scripts, runner, and generator.
- Tests in the reference worktree are agent-written; owner-app tests require a request. Owner types schema changes. Configured/confirmed migration exceptions allow TypeORM/Prisma migration files only; Drizzle owner runs generation to preserve metadata. Owner runs all migrations.
- Add reference TSDoc/Swagger; owner-file annotations only under configured exceptions after working code.

Completion reply: ticket and reference paths, baseline, changed-file count, criterion/test/gate results, rules/clashes, limits, then the first guide step and its check. Never claim a run that did not occur.
