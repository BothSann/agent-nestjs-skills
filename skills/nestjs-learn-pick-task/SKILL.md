---
name: nestjs-learn-pick-task
description: Scan a NestJS app or empty repo, offer learning tasks, and write the selected TICKET.md. Use for "what should I learn next", "next lesson", or picking a task. Excludes lesson construction and code coaching.
license: MIT
metadata:
  author: thannsopheakboth
  version: "1.0.4"
---

# Pick a learning task

Owner types the app; agent selects evidence-backed learning slices.
Read [hard-rules.md](references/hard-rules.md), [voice.md](references/voice.md), and [layout.md](references/layout.md). Reuse unchanged references already read in this session.

## Workflow
1. Read `learn/learn.config.json`. Missing: follow [first-run.md](references/first-run.md) and confirm facts before writing config. A read-only trial may instead use an external config; it does not authorize target writes.
2. Run the scanner and save JSON in scratch space, not the repo:
   `node <skill-dir>/scripts/scan-project.mjs <repo-root> [--no-gh] [--config=FILE]`.
   It reads files/Git and optionally merged PRs; no app, installs, or database. For flags, output, blockers, or scan failures, read [scanner.md](references/scanner.md).
3. Resolve blockers. Never infer missing Git from denied access. For `summary.staleLessons`, report the merged PR, confirm with the owner, then mark done; never offer it as unfinished.
4. Read scan JSON and the configured plan. Use [scoring.md](references/scoring.md). Sources: existing lessons, earliest unfinished plan tasks, stub/missing endpoints, and practice hints. Project order/prerequisites override generic scores.
5. For practice candidates read [practice-tasks.md](references/practice-tasks.md); confirm each hint in source before offering it. Missing hints require searching alternative implementations. Scanner results are heuristics, not proof that a route works or a feature is complete; manually inspect relevant evidence when parsing is insufficient.
6. Offer exactly three feasible slices, or fewer if fewer exist. Mark one **next** and explain why. In-progress lesson first; no Nest app means scaffold only. Mix endpoint/practice kinds when feasible; never offer a whole milestone. Name concrete Nest features taught. Wait for the choice.

## After selection
| Choice | Action |
|---|---|
| In-progress lesson | Reuse its folder; read README progress, give current step, hand off to nestjs-learn-coach with done/stuck/check |
| Proposed lesson | Reuse its ticket; show decisions, hand off to nestjs-learn-write-lesson with "write the lesson" |
| New task | Write only `learn/NN-slug/TICKET.md` from [ticket-template.md](references/ticket-template.md), status proposed, appropriate kind; propose unresolved decisions for owner confirmation |

Never duplicate an existing lesson, create the reference solution, or write its GUIDE here. For a new ticket end: "Read the ticket; change decisions if needed, then say **write the lesson**."

Report: brief built/stub/missing state with evidence and limits; lesson progress; task table (choice, kind, size, learning goal); next action. Do not paste raw scan JSON.

For command/config details use [project-config.md](references/project-config.md). Do not impose package managers, runners, databases, DDD, or document names from examples.
