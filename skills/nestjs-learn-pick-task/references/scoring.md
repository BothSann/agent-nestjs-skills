# Candidate ranking

Candidates: unfinished existing lessons, earliest unfinished plan tasks, stub/missing endpoints, and confirmed missing/problem practice hints. Merged/done/dropped lessons are not candidates; confirm stale statuses before updating. Resume proposed tickets instead of duplicating them.

Project plan/prerequisites win over scores. Split a large task into teachable slices; do not skip required foundations. Confirm checklist claims with evidence. Examples: logout/current-user needs authentication; related-list needs its table; e2e needs isolated persistence only if the app uses it; login throttling needs login. Disabled CORS is not a security gap.

| Signal | Score |
|---|---|
| In-progress lesson | Always first |
| Earliest unfinished build step | +3 |
| Stub route | +2 |
| Problem security hint | +3 |
| Other problem hint | +2 |
| Missing practice | +1 |
| New Nest concept | +2 |
| Reuses owner-built class (practice) | +1 |
| New package needed | -1 |
| Bigger than one endpoint/table/practice | Split; do not offer whole |

Check done-lesson titles for previously taught concepts; read their word tables only if needed. Keep related endpoints separate when independently useful.

Offer three feasible, distinct ideas (fewer if fewer exist), mark the highest **next**, explain its evidence/priority. Include endpoint and practice kinds when both fit. S = one file/stub; M = entity+migration+endpoint or cross-cutting filter. Empty repo: scaffold only. Wait for choice.
