# Skill instruction-token benchmark

Baseline: commit `c266a3797691e255056666f71f4236548d5af1fa`. Optimized results: the accompanying working-tree skill files. This measures instruction-file context, not end-to-end model usage, billing, latency, or task quality.

## Method

- Tokenizer: pinned `js-tiktoken@1.0.21`, encoding `o200k_base`. This is a reference encoding; a target agent may use a different tokenizer.
- Normalize CRLF to LF before counting, hash normalized contents, and count each distinct file once per scenario. Do not count description tokens twice: they are already inside the entrypoint.
- Fixed file plans model cold successful workflows. Best-practice lookup includes the unchanged validation rule. Other workflows measure local skill instructions; task-selected external rule files, project docs, source, prompts, tool wrappers/results, reasoning/output tokens, retries, and caching are excluded.
- The configured-picker scenario excludes first-run/error-only scanner documentation. The writer loads all shared references and worktree/templates. Coach check retains code-quality/review references; coach done loads only boundary/voice/next-step/command guidance.
- Same-files comparison isolates text compression. Routed comparison also accounts for the coach-done route no longer requiring review-only files. These scenario plans are explicit in the JSON manifests and can be changed for other tasks.

## Entrypoint cost

| Skill | Before | After | Reduction |
|---|---:|---:|---:|
| nestjs-best-practices | 1,561 | 534 | 65.8% |
| nestjs-learn-pick-task | 3,278 | 726 | 77.9% |
| nestjs-learn-write-lesson | 2,438 | 822 | 66.3% |
| nestjs-learn-coach | 1,387 | 534 | 61.5% |

## Representative workflow context

| Scenario | Before | After, same files | After, routed files | Reduction |
|---|---:|---:|---:|---:|
| best-practice-lookup | 2,550 | 1,523 | 1,523 | 40.3% |
| pick-task-configured | 8,990 | 3,008 | 3,008 | 66.5% |
| write-lesson | 16,709 | 8,216 | 8,216 | 50.8% |
| coach-done | 10,652 | 4,709 | 3,266 | 69.3% |
| coach-check | 10,962 | 5,019 | 5,019 | 54.2% |

## Changes

- Shorter discovery descriptions and entrypoints, preserving routing and critical boundaries.
- Compact shared references and artifact templates; no repeated full sign-up walkthroughs in router files.
- Scanner flags/schema/blockers moved to a conditional reference.
- Routine coaching avoids full-review instructions. Unchanged references may be reused within a session; this avoids repeated reads, but is not a claim about how an application bills conversation history.
- All 54 detailed best-practice rule files and the technical worktree/database procedure remain intact. Three installed learning skills remain self-contained with synchronized shared copies.

## nestjs-modular-monolith

Baseline: the first working version of the skill (`modular-monolith-before.json`), compared with the trimmed version (`modular-monolith-after.json`). Same tokenizer and rules as above.

| Metric | Before | After | Reduction |
|---|---:|---:|---:|
| Description (loaded in every session) | 84 | 47 | 44.0% |
| Entrypoint `SKILL.md` | 1,261 | 857 | 32.0% |

| Scenario | Files | Before | After, same files | After, routed | Reduction |
|---|---|---:|---:|---:|---:|
| mm-new-project | SKILL, rules, config template | 4,239 | 3,449 | 1,934 | 54.4% |
| mm-add-module | SKILL | 1,261 | 857 | 857 | 32.0% |
| mm-module-code | SKILL, structure | 2,935 | 2,009 | 2,009 | 31.6% |
| mm-existing-project | SKILL, existing-project, rules, config template | 4,962 | 4,002 | 2,487 | 49.9% |
| mm-option | SKILL, options | 1,888 | 1,320 | 1,320 | 30.1% |

What changed:

- Text compression: duplicated defaults table removed from `SKILL.md` (settings live in `rules.md`); prose around the verified code examples shortened; self-test internals reduced to what the agent acts on.
- Routing: the agent reads only the template's 13-line `settings` block (187 tokens) instead of the whole config (1,702). Scenarios count this as `assets/dependency-cruiser.cjs#L1-13`; the whole file is still recorded for the same-files column.
- Not cut: every rule name, every setting, the safety statements (never weaken rules, migration preparation, baseline is not a clean bill of health and may only shrink), and the limits of import rules. Tests in `modular-monolith.test.mjs` fail if any of these go missing, or if a doc links to a missing file.

After the PR #18 review fixes (+50 entrypoint tokens for the new-mode safety checks): the skill's 23 tests pass, and the full workflow was re-run on a `nest new` NestJS 12 app (build, lint, unit, e2e, `arch` with 0 violations, self-test 46/46). Scripts and the config's rule bodies were not changed by the trim.

## Scaffold folder clarification (issue #19)

Baseline: `64bad479f94ae624760f2a2cbab42f5d6194cf5b`, saved in `scaffold-folders-before.json`. `scaffold-folders-after.json` measures the clarified folder instructions and shorter surrounding prose using the same tokenizer and file plans. No code examples, safety checks, scripts, or rules were removed.

| Metric/scenario | Before | After | Tokens saved |
|---|---:|---:|---:|
| Discovery description | 47 | 47 | 0 |
| Entrypoint / mm-add-module | 857 | 842 | 15 |
| mm-new-project | 1,934 | 1,919 | 15 |
| mm-module-code | 2,009 | 2,008 | 1 |
| mm-existing-project | 2,487 | 2,472 | 15 |
| mm-option | 1,320 | 1,305 | 15 |

The untrimmed documentation fix would have raised the entrypoint to 919 tokens and module-code context to 2,191. The final wording saves 77 and 183 tokens respectively versus that draft, while explaining which folders are generated and which are created on first use. Other skills' scenarios are unchanged. These are instruction-context counts, not measured runtime usage or proof of task accuracy; 28 focused skill/benchmark tests passed, and the preserved instructions were reviewed against the original.

Recompute the baseline with the baseline commit checked out separately, then compare the working tree:

```text
node scripts/benchmark-tokens.mjs --root <baseline-checkout> --label issue-19-before --output benchmarks/tokens/scaffold-folders-before.json
node scripts/benchmark-tokens.mjs --compare benchmarks/tokens/scaffold-folders-before.json --label issue-19-after --output benchmarks/tokens/scaffold-folders-after.json
```

## Step explanations: What, Why, When, How (issue #23)

Baseline: `8015f5f10cec92293cd71a120d759a9912459296`, saved in `step-explanations-before.json`. `step-explanations-after.json` measures the four-part step explanations with the same tokenizer and file plans. This change adds teaching text on purpose, so the numbers are a cost, not a saving.

| Metric/scenario | Before | First draft | Final | Added |
|---|---:|---:|---:|---:|
| write-lesson entrypoint | 822 | 838 | 838 | +16 |
| write-lesson | 8,216 | 8,924 | 8,766 | +550 (6.7%) |
| coach-done | 3,266 | 3,516 | 3,407 | +141 (4.3%) |
| coach-check | 5,019 | 5,078 | 5,067 | +48 (1.0%) |
| pick-task-configured | 3,008 | 3,067 | 3,056 | +48 (1.6%) |
| best-practice-lookup, mm-* | unchanged | | | 0 |

Most of the final cost is the filled example step in `guide-template.md` (388 → 874). The trim dropped the table's concrete column, which repeated that example, and shortened the shared `voice.md` line and the coach's step bullets; it saved 158 tokens on write-lesson and 109 on coach-done versus the first draft. Discovery descriptions are unchanged. Instruction-context counts only, not runtime usage or proof of better lessons.

## Reproduce

From the repository root, after installing the development dependencies in `scripts/`:

```text
node scripts/benchmark-tokens.mjs --compare benchmarks/tokens/before.json --output benchmarks/tokens/after.json
node scripts/benchmark-tokens.mjs --compare benchmarks/tokens/modular-monolith-before.json --label mm-after-optimization --output benchmarks/tokens/modular-monolith-after.json
node --test scripts/benchmark-tokens.test.mjs
```

To recompute the baseline rather than trusting the stored snapshot, prepare a separate checkout of the baseline commit, then run the current benchmark tool against it:

```text
node scripts/benchmark-tokens.mjs --root <baseline-checkout> --scenarios benchmarks/tokens/scenarios-before.json --label c266a37 --output <scratch>/recomputed-before.json
```

`before.json` and `after.json` contain per-file token counts/content hashes, entrypoint and discovery-description costs, corpus totals, and scenario file lists. Corpus totals are inventory sizes, not expected loaded context.

## Validation and limits

- Benchmark tests cover line-ending invariance, deduplication, and separation of compression versus routing savings.
- Scanner/database regression tests and shared-reference consistency pass; the Windows symlink test requires privileges not available in this environment.
- An independent qualitative forward test used three scenarios: pnpm DTO coaching without incremental output, SQLite lesson preparation with unsafe inherited test configuration, and an alternative implementation followed by a scoped fix. It did not execute databases or measure agent token usage.
- All four skill entrypoints pass the skill-creator validator with PyYAML loaded from a temporary dependency folder. Local Markdown references and all 54 compact-index rule paths are checked. Full workflow execution and a controlled multi-model runtime token benchmark remain unperformed.
- A runtime comparison should hold task/model/tool permissions/project baseline constant, use multiple isolated runs per variant, collect actual input/cached/output/reasoning usage where exposed, and check identical acceptance criteria. Instruction-context savings alone do not establish runtime cost savings.

Sources: [js-tiktoken](https://github.com/dqbd/tiktoken/tree/main/js), [tiktoken](https://github.com/openai/tiktoken).
