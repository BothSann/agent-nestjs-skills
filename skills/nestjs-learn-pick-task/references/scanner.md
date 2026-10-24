# Scanner reference

Run `node <skill-dir>/scripts/scan-project.mjs <repo-root>`; stdout JSON goes to scratch space, logs to stderr. No target writes, app startup, package installs, or database access.

Flags:
- `--no-gh`: skip merged-PR lookup; stale status is then unknown.
- `--config=FILE`: external JSON config; paths inside it still resolve against target repo. Missing/invalid explicit config fails.
- `--home=DIR` / `--merged-prs=FILE`: isolated discovery/PR fixtures for tests.

## JSON
| Key | Contents |
|---|---|
| app, stack | Paths/prefix/version, Nest version, manager, runner, ORM, platform, packages/scripts |
| routes | Method/path, handler, file:line, stub marker |
| tables, migrations, classes | Detected schema/migration files and feature classes |
| tests | Unit/e2e files/counts; onlyDefault identifies starter app.controller.spec.ts |
| practices | id, rule, status (ok/missing/problem/n/a), evidence, note; confirm before selecting |
| buildOrder, planTasks | Numbered plan or checklists; optional ID, title, done, section |
| endpoints | done/stubs/missing based on static route matching |
| lessons | Folder/status/kind/branch, existing artifacts, mergedPr |
| qualitySources | Project rules, guidelines, discovered best-practice path/version/rule count, Nest docs |
| summary | Counts, missing/problem hints, nextLessonNumber, staleLessons |

"done" endpoints mean statically matched non-stubs, not behavior proof. Stub markers include NotImplementedException and generator "This action..." returns, including directly called services.
Docs: explicit METHOD/path table rows or backticked pairs; duplicate routes removed, fenced examples ignored. No inference from shorthand such as "GET lists webhooks". Check requirements before claiming completeness. Dynamic paths, version/prefix variables, GraphQL, and RouterModule routing may need manual inspection.

## Blockers
| Key | Action |
|---|---|
| no_config | Use first-run.md, or external config for read-only trial |
| no_git | Owner initializes Git; never do this based on git_unavailable |
| git_unavailable | Resolve executable/permission/safe-directory access; do not recreate repo |
| no_commits | Owner creates a baseline commit; give commands |
| no_nest_app | Distinguish empty repo (scaffold) from wrong appPath |
| no_build_order_doc | Endpoint docs/practice hints still usable; order unknown; offer planning help |
| no_endpoint_doc | Fix configured doc path before claiming full endpoint coverage |
| no_best_practices_skill | Continue with project/review rules; disclose missing quality source |
| router_module_prefixes | Prefixes unsupported; tail matching is heuristic, disclose and confirm paths |

Troubleshooting: compare one documented route to main.ts and its controller for prefix/version mismatches; discard hints disproven by source; ask about unknown lesson status before updating frontmatter.
