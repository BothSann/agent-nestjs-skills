# GUIDE template

Write the full guide from the tested worktree, using the owner's shell/manager/scripts. Keep chat to one step.
Use this outline:

```markdown
# Guide: <task>

## Proof and solution workspace
<Resolved worktree/app paths, baseline commit, copied owner changes, every changed/new file, isolated storage or not applicable, exact commands, baseline/final outcomes, fakes and unrun criteria. No credentials.>

## The big idea
<Concrete before/after behavior and request/control flow.>

## Rules this lesson follows
| Choice | Rule | Source |
|---|---|---|
| <Implementation choice> | <Reason> | <Real rule file/heading> |

Clashes: <project rule that won, or none>.

## Words
<New technical terms with project examples.>

## Step N: <one file, command, or wiring change>
Who: <you type | you run | agent writes under a valid exception>

What: <exact path/action>
Why: <behavior and relevant rule>
Plain TypeScript first: <small explanation before Nest's added behavior, when useful>
How: <tested code or exact generator/command>
Check: <command and actual expected output>
```

Steps should take 5–15 minutes; a check must pass using only previous steps. No curl before module/controller wiring. Use the installed compiler with `--noEmit --incremental false` for read-only checks. Plain domain tests need no Nest container/database.
Explain Nest metadata/DI or generated SQL once when first relevant. Adapt sibling patterns instead of copying a sample service architecture. Show before/after for baseline-test fixes; tests in the owner app require a request.
Git/package/migration commands in the owner checkout are owner-run. End with configured gates, criterion proof, project commit style, and PR base. Mark any missing proof; never fabricate outputs.
