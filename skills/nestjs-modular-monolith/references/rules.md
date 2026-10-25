# Boundary rules

All rules in [the template](../assets/dependency-cruiser.cjs) are `error`. "Owner" = one module folder or the shared kernel.

| Rule | Blocks |
|---|---|
| `domain-isolated` | domain/ importing anything but its own domain/, `shared/domain`, and `domainAllowedPackages` (npm and Node built-ins included) |
| `application-inward` | application/ importing infrastructure/ or api/ (own or shared) |
| `infrastructure-not-api` | infrastructure/ importing api/ |
| `api-uses-application` | a module's api/ importing its infrastructure/, or its domain/ unless `apiMayImportDomain` |
| `contracts-isolated` | contracts/ importing local code other than its own contracts/ and `shared/domain` |
| `index-exposes-public-surface` | index.ts re-exporting anything but the Nest module and contracts/ |
| `cross-module-via-index` | a module importing another module's files other than its index.ts |
| `outside-via-index` | root files, shared, tests, tools importing module files other than index.ts |
| `shared-not-to-modules` | the shared kernel importing a module |
| `outside-architecture` (`-from`, `-to`, `-orphan`) | a source file outside the layout (not in a layer, not `index.ts`/`*.module.ts`/`*.module.spec.ts` at a module root, not in `rootFiles`), whether it imports, is imported, or neither |
| `no-circular` | import cycles |
| `not-to-unresolvable` | imports that do not resolve (a broken alias would skip every rule); exceptions in `unresolvedAllowed` |

Test files (`*.spec.*`, `*.test.*`) skip the first five rules, not the boundary rules. `import type` counts.

## Settings

| Setting | Default | Notes |
|---|---|---|
| `sourceRoot`, `modulesDir`, `sharedDir` | `src`, `src/modules`, `src/shared` | Relative to project root; Nest monorepo: `apps/<app>/src`... |
| `rootFiles` | `main.ts`, `app.module.ts` | Add other entry points (`worker.ts`). Global `*.d.ts` go here or in `shared/infrastructure/`. |
| `apiMayImportDomain` | `false` | This skill's convention, not a DDD law |
| `domainAllowedPackages` | `[]` | Pure packages only (`decimal.js`, `crypto`) |
| `unresolvedAllowed` | `['supertest/types.js']` | Exact imports TypeScript resolves but dependency-cruiser cannot (subpaths served only by `@types`); `tsc` still checks them |
| `tsConfig` | `tsconfig.json` | Must hold the project's `paths` so aliases resolve |

Layer folder names are fixed; renaming them breaks the self-test on purpose.

## Self-test

`arch-selftest.mjs` builds a temp project (two modules, shared kernel, root and loose files, a fake npm package) and runs the project's dependency-cruiser on it, never on real source. Each allowed import must pass (catches a rule that blocks everything); each forbidden one must fail with the expected rule; each import must be seen (type-only as type-only); relied-on rules must be `error`. Cases follow `settings`. Exit 0 pass, 1 case failed, 2 could not run. Run it after any config change and in CI. Custom rules are not covered.

## What these checks cannot prove

They catch forbidden imports, not bad design:

- **Business boundaries**: whether modules match the business, or one module is really two.
- **Data ownership**: a module can still query another's tables through a shared connection or raw SQL. Use review, one schema or database user per module.
- **Runtime coupling**: DI tokens, string event names, HTTP calls to yourself, `process.env`, computed `import()`/`require()`.
- **Domain quality**: anemic models, rules in handlers, a fat shared kernel.
- Only JavaScript/TypeScript files are checked.
