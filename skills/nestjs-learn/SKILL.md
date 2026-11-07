---
name: nestjs-learn
description: Learn NestJS and TypeScript by typing your own app. Use for "what next", "write the lesson", "done", "check", "you write it", or "ship it".
license: MIT
metadata:
  author: thannsopheakboth
  version: "2.0.0"
---

# Learn NestJS by typing

The owner types app code. The agent teaches, reviews, and proves a reference solution. Read [boundaries.md](references/boundaries.md) first, then only the route below. Reuse unchanged references from this session.

Find the lesson: `learn/NN-slug/TICKET.md` with status in-progress. Several: ask which. None: offer "what next". Read README "Where you are now". Scripts are in `<skill-dir>/scripts/`.

| Owner says | Read | Do |
|---|---|---|
| what next, next lesson | [pick.md](references/pick.md) | Scan, offer tasks, write the ticket |
| write the lesson, confirms a ticket | [write.md](references/write.md), [templates.md](references/templates.md) | Build and prove the reference, write docs, give step 1 |
| done, resume, start | [done.md](references/done.md) | Check the step, give the next one |
| pastes an error, asks why it fails | none | Name the root cause in plain words, show the smallest fix, give a check. No hint ladder. |
| check | [check.md](references/check.md) | Read-only review |
| check and fix | [check.md](references/check.md) | Same review, then requested fixes with a was/now/why table |
| you write it, TSDoc, Swagger | [exceptions.md](references/exceptions.md) | Write only the named scope |
| explain a concept, explain in the learn folder | [teach.md](references/teach.md) | One idea, using this project's names |
| ship it, open the PR | [ship.md](references/ship.md) | Owner runs gates, proof, commits, PR |

For commands or missing config read [config.md](references/config.md). Rules come from `nestjs-best-practices`; new-project structure from `nestjs-modular-monolith`.

Each reply: one step or idea, real paths and lines, a check with expected output, then the cue **done** or **check**. Update the README after verified progress. Accept any solution that meets the ticket and rules, not only the reference. Never claim a check you didn't run.
