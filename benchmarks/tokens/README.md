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

## Reproduce

From the repository root, after installing the development dependencies in `scripts/`:

```text
node scripts/benchmark-tokens.mjs --compare benchmarks/tokens/before.json --output benchmarks/tokens/after.json
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
