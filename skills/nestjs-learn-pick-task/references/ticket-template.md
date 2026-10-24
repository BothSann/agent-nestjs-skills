# Ticket template

Write only after selection. Use project vocabulary/contracts, real paths and evidence. Fill every relevant section; do not invent a login, database, status code, or dependency from an example.

```markdown
---
id: <ticketPrefix + NN; default L-NN>
status: proposed
kind: <scaffold | endpoint | practice>
branch: <project-conforming branch>
---

# Ticket <id>: <small task>

## Story
As <actor>, I want <behavior>, so that <reason>.

## Why now
<Plan step/prerequisites and current file:line evidence or confirmed practice gap.>

## Scope
<In and out. One teachable slice.>

## Request and answer
<Real method/path, input, success/error shapes and status codes; use equivalent input/output for non-HTTP tasks.>

## Acceptance criteria
1. <Observable outcome with concrete values, including refusal/secret-exclusion cases.>
2. <Relevant race/failure/normal-path cases.>
3. <Configured gates pass.>

## Decisions
| Question | Proposal | Why |
|---|---|---|
| <Unresolved project question> | <Proposed answer> | <Consistent reason> |

## Rare cases
<Normalization, concurrency, dependency failure, or other task-specific cases.>

## Definition of done
<Criteria proven by actual requests/tests/logs, affected docs updated, small commits, PR against configured base.>
```

Owner confirms decisions before lesson construction; reuse prior answers. Read the real exception filter/response conventions. Practice tickets use the same shape with the current wrong behavior and the rule/evidence driving the fix. Criteria must be testable, not "clean code". Record the exact planned branch so merged-PR detection can match it.
