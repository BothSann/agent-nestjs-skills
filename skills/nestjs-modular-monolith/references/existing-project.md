# Existing project: migration preparation

Goal: today's code passes, new violations fail, the user gets an honest picture and a first step. Move or rewrite app code only when the user asks for a specific step.

## 1. Inspect

After the config is in place, run `inspect.mjs` without `--no-cruise`:

- `tsconfig.paths` / `moduleAliases`: keep working aliases; point `settings.tsConfig` at the file that has them.
- `layout.outsideFiles`, `outsideByFolder`, `outsideSample`: code the layer rules do not cover yet.
- `layout.featureModuleCandidates`: folders with a `*.module.ts` outside `modules/`; candidates, not decisions.
- `layout.modules`: module folders missing `index.ts`, module file, or layers.
- `violations.byRule`.

Set `rootFiles` to the real entry points before the baseline.

## 2. Self-test, then baseline

1. `arch:selftest` must pass first; it runs on a temp project, so messy source cannot hide a broken rule.
2. `<exec> depcruise <sourceRoot> [test] --config .dependency-cruiser.cjs --output-type baseline --output-to .dependency-cruiser-known-violations.json`, then commit it. The `arch` script uses `--ignore-known` with that file.

A baseline is a migration aid, not a clean bill of health. Say so:

- It records each current violation (from, to, rule). They still exist; they just do not fail.
- Any new violation fails, including a new import in a legacy file outside `modules/`: legacy files can change, but each new import fails until the file moves into a module.
- It may only shrink. Re-record after moving code and check the diff only removes lines; re-recording to hide new violations weakens the checks.

## 3. Report

"N of M source files are inside the architecture", outside folders with counts, baseline violations per rule, self-test result, the limits from rules.md.

## 4. Suggest an order (chat only; a file only if asked)

1. First module: a candidate with few imports from other folders and a clear business name; leaf modules are easiest.
2. One module per pull request: `add-module.mjs`, move files into layers, expose what others need through contracts/ and index.ts, fix imports, re-record the baseline (it shrinks).
3. Move business rules into domain/ only when that code is touched anyway; folder moves and model changes are separate steps.
4. When the baseline is empty, drop `--ignore-known`.
