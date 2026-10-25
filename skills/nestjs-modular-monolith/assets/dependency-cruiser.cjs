// NestJS modular monolith boundaries (nestjs-modular-monolith skill).
// Edit only `settings`; arch-selftest.mjs reads it. Each setting: the skill's references/rules.md.
const settings = {
  sourceRoot: 'src', // paths are relative to the project root
  modulesDir: 'src/modules',
  sharedDir: 'src/shared',
  rootFiles: ['main.ts', 'app.module.ts'], // a matching .spec.ts is allowed too
  apiMayImportDomain: false, // false: controllers call use cases, never domain code
  domainAllowedPackages: [], // npm names ('decimal.js') or Node built-ins ('crypto')
  unresolvedAllowed: ['supertest/types.js'], // exact imports tsc resolves but depcruise cannot
  tsConfig: 'tsconfig.json',
};
// ---- Rules below are built from `settings`. Do not edit them. ----

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SRC = esc(settings.sourceRoot);
const MODS = esc(settings.modulesDir);
const SHARED = esc(settings.sharedDir);
// $1 = the owner of a layer: one module folder, or the shared kernel.
const OWNER = `^(${MODS}/[^/]+|${SHARED})/`;
const MODULE = `^(${MODS}/[^/]+)/`;
// Tests may reach across layers (fakes, fixtures). Module boundaries still apply.
const TESTS = '\\.(spec|test)\\.[cm]?[jt]sx?$';
const allowedPackages = settings.domainAllowedPackages.flatMap((name) => [
  `(^|/)node_modules/${esc(name)}/`,
  `^(node:)?${esc(name)}$`,
]);
const covered = [
  `^${MODS}/[^/]+/(domain|application|infrastructure|api|contracts)/`,
  `^${MODS}/[^/]+/(index\\.ts|[^/]+\\.module(\\.spec)?\\.ts)$`,
  `^${SHARED}/(domain|application|infrastructure|api)/`,
  `^${SHARED}/(index\\.ts|[^/]+\\.module(\\.spec)?\\.ts)$`,
  ...settings.rootFiles.map((f) => `^${SRC}/${esc(f.replace(/\.ts$/, ''))}(\\.spec)?\\.ts$`),
];
const outside = { path: `^${SRC}/`, pathNot: covered };

const config = {
  forbidden: [
    {
      name: 'domain-isolated',
      comment: 'domain/ imports only its own domain/, the shared domain/, and allowed packages.',
      severity: 'error',
      from: { path: `${OWNER}domain/`, pathNot: TESTS },
      to: { pathNot: ['^$1/domain/', `^${SHARED}/domain/`, ...allowedPackages] },
    },
    {
      name: 'application-inward',
      comment: 'application/ never imports infrastructure/ or api/, its own or shared.',
      severity: 'error',
      from: { path: `${OWNER}application/`, pathNot: TESTS },
      to: { path: ['^$1/(infrastructure|api)/', `^${SHARED}/(infrastructure|api)/`] },
    },
    {
      name: 'infrastructure-not-api',
      comment: 'infrastructure/ never imports api/.',
      severity: 'error',
      from: { path: `${OWNER}infrastructure/`, pathNot: TESTS },
      to: { path: ['^$1/api/', `^${SHARED}/api/`] },
    },
    {
      name: 'api-uses-application',
      comment: settings.apiMayImportDomain
        ? 'api/ never imports its infrastructure/. Use injection tokens.'
        : 'api/ calls application/ use cases, never domain/ or infrastructure/.',
      severity: 'error',
      from: { path: `${MODULE}api/`, pathNot: TESTS },
      to: { path: settings.apiMayImportDomain ? '^$1/infrastructure/' : '^$1/(infrastructure|domain)/' },
    },
    {
      name: 'contracts-isolated',
      comment: 'contracts/ holds plain types and tokens: only its own contracts/ and the shared domain/.',
      severity: 'error',
      from: { path: `${MODULE}contracts/`, pathNot: TESTS },
      to: { pathNot: ['^$1/contracts/', `^${SHARED}/domain/`, '(^|/)node_modules/'], dependencyTypesNot: ['core'] },
    },
    {
      name: 'index-exposes-public-surface',
      comment: 'A module index.ts re-exports only its Nest module and contracts/.',
      severity: 'error',
      from: { path: `${MODULE}index\\.ts$` },
      to: { path: '^$1/', pathNot: ['^$1/contracts/', '^$1/[^/]+\\.module\\.ts$'] },
    },
    {
      name: 'cross-module-via-index',
      comment: 'A module reaches another module only through its index.ts.',
      severity: 'error',
      from: { path: `^${MODS}/([^/]+)/` },
      to: { path: `^${MODS}/`, pathNot: [`^${MODS}/$1/`, `^${MODS}/[^/]+/index\\.ts$`] },
    },
    {
      name: 'outside-via-index',
      comment: 'Root files, shared code, and tests reach a module only through its index.ts.',
      severity: 'error',
      from: { pathNot: `^${MODS}/` },
      to: { path: `^${MODS}/`, pathNot: `^${MODS}/[^/]+/index\\.ts$` },
    },
    {
      name: 'shared-not-to-modules',
      comment: 'The shared kernel never depends on a module.',
      severity: 'error',
      from: { path: `^${SHARED}/` },
      to: { path: `^${MODS}/` },
    },
    {
      name: 'outside-architecture-from',
      comment: 'Source files live in a module layer, the shared kernel, or settings.rootFiles.',
      severity: 'error',
      from: outside,
      to: {},
    },
    {
      name: 'outside-architecture-to',
      comment: 'Nothing imports a source file that sits outside the architecture.',
      severity: 'error',
      from: {},
      to: outside,
    },
    {
      name: 'outside-architecture-orphan',
      comment: 'A source file with no imports at all must still sit inside the architecture.',
      severity: 'error',
      from: { orphan: true, ...outside },
      to: {},
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Every import must resolve, including path aliases.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: settings.unresolvedAllowed.map((s) => `^${esc(s)}$`) },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // `import type` counts too: a type import across a boundary is still coupling.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: settings.tsConfig },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};

// Hidden from dependency-cruiser's schema check; read by the self-test.
Object.defineProperty(config, 'settings', { value: settings, enumerable: false });

module.exports = config;
