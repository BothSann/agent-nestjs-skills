<!-- Shared by all three nestjs-learn-* skills; update every copy. -->
# Lesson layout

Personal docs live in the main repo's ignored `learn/`:
- `learn.config.json`: project facts.
- `NN-kebab-slug/TICKET.md`: scope, criteria, decisions, frontmatter.
- `README.md`: goal, new words, step table, "Where you are now", "Solution workspace".
- `GUIDE.md`: complete tested steps/code/proof.
- `check-yourself.md`: questions with answers hidden directly underneath.
- `notes/<idea>.md`: requested explanations, linked from the lesson README.

New number = highest existing NN + 1, padded to at least two digits. Resume existing lessons without allocating another number.

Reference solution: `<lessonWorktreesPath>/NN-slug/<appPath>`, outside the main checkout; default root is sibling `<repo-name>-lessons`. No `ref/` or extra proof copy. Keep it throughout learning; never remove automatically.

README and GUIDE record resolved worktree/app paths, starting commit, copied uncommitted baseline changes, all changed/new files, isolated database name or "not applicable", commands/results, fakes, and proof limits. No credentials. GUIDE code comes from tested files; other valid owner solutions are acceptable.

Ticket frontmatter:
```yaml
---
id: L-04
status: proposed
kind: endpoint
branch: feat/me-endpoint
---
```

| Status | Meaning |
|---|---|
| proposed | Picker wrote the ticket; decisions await confirmation |
| in-progress | Writer prepared/proved the reference and guide; owner is typing |
| done | Criteria proven; PR open or merged |
| dropped | Owner chose to stop |
| unknown | Missing ticket/status; ask before changing it |

Kinds: `scaffold` (first boot in an empty repo), `endpoint` (one endpoint/table), `practice` (one quality improvement). Update README progress after verified steps.
