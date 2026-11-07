# Lesson templates

## README.md
Keep it short. `learn.mjs cleanup` reads the Worktree line, so keep its exact form.

```markdown
# Lesson NN: <task>

## Goal
<Observable behavior and safeguards.>

## New words
| Word | Plain meaning |
|---|---|

## Steps
| Step | Work | Who |
|---|---|---|

## Solution workspace
- Worktree: <absolute path>
- Starting commit: <sha and copied changes>
- Database: <throwaway container and image, or not applicable>
- Changed files: <list>
- Proof: <tests, gates, criteria, fakes, unrun checks>

## Where you are now
- Verified: none yet
- Next: step 1
```

## GUIDE.md
At most 6 steps of 5–15 minutes, about 4,000 tokens including code. Show only code the owner types; tests stay in their files. Each check must pass using only earlier steps, usually the test script with one file name. No curl before the route is wired.

```markdown
# Guide: <task>

## The big idea
<Everyday picture, then before and after behavior, and the request flow.>

## Rules this lesson follows
| Choice | Rule |
|---|---|

## Step N: <one file, command, or wiring change>
Who: you type | you run | agent writes

What: <the thing and its exact path>
Why: <the problem here, and what breaks without it>
When: <when it runs, and when you'd write one again>
How: <command or tested code, then one line per new idea>
Check: <command and expected output>

## Finish
<Gates, criteria proof, and PR base.>
```

Use this app's names in every part. "It is best practice" and "when needed" are too vague. For a first-seen TypeScript or Nest idea, write one line and point to its `concepts.md` heading. Explain Nest magic once, when it first matters.

## check-yourself.md
Write 4–6 questions about this lesson's real code, including one "what breaks if" and one trick question. Answers are 1–3 sentences with a bold short label.

```markdown
1. <Question>

   <details><summary>Answer</summary>

   **<Short answer>.** <Explanation.>

   </details>
```
