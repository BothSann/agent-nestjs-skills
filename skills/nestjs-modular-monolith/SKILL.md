---
name: nestjs-modular-monolith
description: Set up or prepare a NestJS modular monolith with DDD layers, module contracts, and dependency-cruiser checks proven by a self-test. Use to scaffold, add a module, check boundaries, or assess an existing app.
license: MIT
metadata:
  author: thannsopheakboth
  version: "1.0.0"
---

# NestJS modular monolith

Sets up structure and checks. Never designs business boundaries or moves existing code unasked.

Read [structure.md](references/structure.md) before writing module code, [rules.md](references/rules.md) before choosing settings or reporting, [existing-project.md](references/existing-project.md) for existing apps, [options.md](references/options.md) only for a requested opt-in. For DDD code use the `nestjs-best-practices` `ddd-*` rules if installed.

## Steps
1. `node <skill-dir>/scripts/inspect.mjs <root> --no-cruise` (read only). Stop and report any `blockers`. Use its `packageManager.commands`; never assume a manager. `nest.monorepo`: ask which app, set the paths to it.
2. Mode: **new** only if you ran `nest new <name> --package-manager <pm> --strict` in this session or `layout.freshNestProject` is true (every starter file untouched). Anything else is **existing** (follow existing-project.md; call the result migration preparation).
3. Install `dependency-cruiser` with `addDev`.
4. Copy [assets/dependency-cruiser.cjs](assets/dependency-cruiser.cjs) to `<root>/.dependency-cruiser.cjs`. Read only its first 13 lines; edit only `settings`. Keep the hidden `settings` export.
5. Copy [scripts/arch-selftest.mjs](scripts/arch-selftest.mjs) to `<root>/tools/arch-selftest.mjs`.
6. `package.json` scripts: `arch` = `depcruise <sourceRoot> [test] --config .dependency-cruiser.cjs` (existing mode adds `--ignore-known .dependency-cruiser-known-violations.json`); `arch:selftest` = `node tools/arch-selftest.mjs .`. Add both to an existing check/CI script; create CI files only if asked.
7. New mode: delete `AppController`, `AppService`, and their spec, only if `layout.starterFiles` marks them `untouched`; set `AppModule` to `imports: []`, keeping imports `nest new` added (such as `ObserveModule`); add `src/app.module.spec.ts` that compiles `AppModule`; make the e2e test check the app boots (`GET /` → 404). Match the project's import suffix.
8. For each module the user names: `node <skill-dir>/scripts/add-module.mjs <root> <kebab-name>` (layers, module, `index.ts`, registered in the root module; follows suffix, quotes, alias). Never invent business modules; no example module.
9. Verify with the project's commands: build/typecheck, lint, unit, e2e, `arch`, `arch:selftest`, formatter if any. All must pass.

Defaults: CQRS shape without a bus (plain use-case classes with `execute()`, injected directly); api/ calls application/ only; domain/ uses no packages; relative imports in new projects, existing working aliases kept; no base classes or shared files until code needs them. Change them only through `settings` or options.md.

## Report
Mode and changes; real numbers (`arch` violations and known ones, self-test cases, tests); the limits from rules.md, plainly: a passing `arch` is not a DDD review. Existing mode: files outside the architecture and a suggested first module.

Never weaken or delete a rule, add an ignore, or grow the baseline to pass checks. If a rule seems wrong, explain it and let the user choose the setting.
