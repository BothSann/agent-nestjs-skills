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

Read [structure.md](references/structure.md) for module code, [rules.md](references/rules.md) before settings/reporting, [existing-project.md](references/existing-project.md) for existing apps, [options.md](references/options.md) for requested opt-ins. For DDD code, follow installed `nestjs-best-practices` `ddd-*` rules.

## Steps
1. `node <skill-dir>/scripts/inspect.mjs <root> --no-cruise` (read only). Stop/report `blockers`. Use `packageManager.commands`. For `nest.monorepo`, ask which app and set its paths.
2. **New** only after `nest new <name> --package-manager <pm> --strict` in this session or `layout.freshNestProject: true` (untouched starters). Otherwise **existing**: follow existing-project.md; report migration preparation.
3. Install `dependency-cruiser` with `addDev`.
4. Copy [assets/dependency-cruiser.cjs](assets/dependency-cruiser.cjs) to `<root>/.dependency-cruiser.cjs`. Read only its first 13 lines; edit only `settings`. Keep the hidden `settings` export.
5. Copy [scripts/arch-selftest.mjs](scripts/arch-selftest.mjs) to `<root>/tools/arch-selftest.mjs`.
6. Scripts: `arch` = `depcruise <sourceRoot> [test] --config .dependency-cruiser.cjs` (existing: add `--ignore-known .dependency-cruiser-known-violations.json`); `arch:selftest` = `node tools/arch-selftest.mjs .`. Include both in existing check/CI scripts; create CI files only if asked.
7. New mode: delete `AppController`, `AppService`, and their spec only when `layout.starterFiles` marks them `untouched`. Remove their `AppModule` wiring; preserve CLI-added imports (e.g. `ObserveModule`). Add `src/app.module.spec.ts` compiling `AppModule` and an e2e boot test (`GET /` → 404). Match import suffixes.
8. User-named modules: `node <skill-dir>/scripts/add-module.mjs <root> <kebab-name>` creates `domain/`, `application/`, `infrastructure/`, `api/`, `contracts/` with `.gitkeep`, `<name>.module.ts`, and `index.ts`; registers in the root module, preserving import style. Add `application/commands/`, `application/queries/`, and shared layers on first use. Never invent business modules; no example module.
9. Verify with the project's commands: build/typecheck, lint, unit, e2e, `arch`, `arch:selftest`, formatter if any. All must pass.

Defaults: directly injected use cases with `execute()` (no CQRS bus); api/ calls application/ only; domain/ uses no packages; new projects use relative imports, existing aliases stay; base classes/shared files only when needed. Configure through `settings` or options.md.

## Report
Report mode, changes, counts (`arch` violations/known ones, self-test cases, tests), and rules.md limits: passing `arch` is not a DDD review. Existing mode: outside files and suggested first module.

Never weaken or delete a rule, add an ignore, or grow the baseline to pass checks. If a rule seems wrong, explain it and let the user choose the setting.
