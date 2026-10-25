# nestjs-modular-monolith

Sets up a NestJS app as a modular monolith: business modules with `domain/`, `application/`, `infrastructure/`, `api/`, and `contracts/` layers, a public `index.ts` per module, and dependency-cruiser rules that fail the build when an import crosses a boundary. A self-test proves the rules work.

Works with any business domain, database, and ORM; with npm, pnpm, Yarn (node-modules linker; Plug'n'Play is reported as a blocker), or Bun; and with ESM or CommonJS.

## What it covers

- New projects: config, scripts, a clean `AppModule`, and an "app compiles" test
- Adding a module: five layer folders (`domain/`, `application/`, `infrastructure/`, `api/`, `contracts/`), each with `.gitkeep`, plus `<name>.module.ts` and `index.ts`, registered in the root Nest module
- Existing projects: an inspection report, a known-violations baseline so new violations fail, and a suggested migration order. This prepares a migration; it does not move code.
- Switches: controllers may use domain types, allowed pure packages in `domain/`, custom paths
- Optional, on request: `@nestjs/cqrs`, outbox events, API/worker split, fixed module direction

The initial application layer contains `application/.gitkeep`. Create `application/commands/` or `application/queries/` when adding its first use case. Create each shared layer on first use; an empty scaffold needs no shared folders, files, or base classes.

## What it does not cover

Folder rules catch forbidden imports. They cannot prove that modules match real business boundaries, or that one module never reads another's tables. See "What these checks cannot prove" in `references/rules.md`.

## Skill structure

```
nestjs-modular-monolith/
├── SKILL.md                       the flow
├── assets/
│   └── dependency-cruiser.cjs     config template; edit `settings` only
├── scripts/
│   ├── inspect.mjs                read-only project facts, JSON on stdout
│   ├── add-module.mjs             adds one module and registers it
│   ├── arch-selftest.mjs          proves the config in a temp project (copied into the app)
│   └── modular-monolith.test.mjs  tests for the three scripts
└── references/
    ├── structure.md               layers, use cases, contracts, shared kernel
    ├── rules.md                   each rule, settings, self-test, limits
    ├── existing-project.md        baseline and migration preparation
    └── options.md                 opt-in additions
```

## Try it

```bash
node scripts/inspect.mjs /path/to/app --no-cruise
node scripts/add-module.mjs /path/to/app billing --dry-run
node scripts/arch-selftest.mjs /path/to/app
node --test scripts/modular-monolith.test.mjs
```

The tests that run dependency-cruiser use the copy in this repository's `scripts/node_modules` (`cd scripts && npm install`), or `DEPCRUISE_BIN`. Without it they are skipped.
