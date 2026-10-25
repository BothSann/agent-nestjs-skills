#!/usr/bin/env node
// Proves a project's dependency-cruiser config enforces the modular monolith rules.
// Builds a throwaway project in a temp folder with imports that must pass and imports
// that must fail, runs the project's own dependency-cruiser on it, and checks each one.
// The real source tree is never cruised or changed.
//
// Usage: node arch-selftest.mjs [project-root] [--config=.dependency-cruiser.cjs]
//                               [--depcruise=path/to/bin] [--keep]
// Self-contained on purpose: a project may copy it (for example to tools/).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const configName = flag('config') ?? '.dependency-cruiser.cjs';
const keep = args.includes('--keep');

function fail(message) {
  console.error(`arch-selftest: ${message}`);
  process.exit(2);
}

const configPath = join(root, configName);
if (!existsSync(configPath)) fail(`no config at ${configPath}`);
const config = createRequire(configPath)(configPath);
const settings = config.settings;
if (!settings) fail(`${configName} has no hidden \`settings\`; it was not made from the skill template`);

function findDepcruise() {
  const given = flag('depcruise') ?? process.env.DEPCRUISE_BIN;
  if (given) return resolve(given);
  // The package's `exports` hides package.json from require.resolve, so walk up instead.
  let pnp = false;
  for (let dir = root; ; dir = dirname(dir)) {
    const pkgPath = join(dir, 'node_modules', 'dependency-cruiser', 'package.json');
    if (existsSync(pkgPath)) {
      const bin = JSON.parse(readFileSync(pkgPath, 'utf8')).bin;
      return join(dirname(pkgPath), typeof bin === 'string' ? bin : bin.depcruise);
    }
    pnp ||= existsSync(join(dir, '.pnp.cjs'));
    if (dirname(dir) === dir) break;
  }
  if (pnp) fail("Yarn Plug'n'Play is not supported: set `nodeLinker: node-modules` in .yarnrc.yml and run `yarn install`");
  return fail('dependency-cruiser is not installed in the project (add it as a dev dependency)');
}
const depcruise = findDepcruise();

const norm = (p) => posix.normalize(p.replaceAll('\\', '/')).replace(/\/$/, '');
const SRC = norm(settings.sourceRoot);
const MODS = norm(settings.modulesDir);
const SHARED = norm(settings.sharedDir);
const rootFile = settings.rootFiles[0] && `${SRC}/${settings.rootFiles[0]}`;

const A = `${MODS}/alpha`;
const B = `${MODS}/beta`;
const target = (dir) => `${dir}/target.ts`;
const FAKE_PKG = 'fake-orm';

// One case = one import edge. `expect` is 'allow' or the rule that must report it.
// `from` ending in a folder means "a new case file in that folder".
const cases = [
  // Allowed: proves the rules do not just block everything.
  ['domain → own domain', `${A}/domain/`, target(`${A}/domain`), 'allow'],
  ['domain → shared domain', `${A}/domain/`, target(`${SHARED}/domain`), 'allow'],
  ['application → own domain', `${A}/application/`, target(`${A}/domain`), 'allow'],
  ['application → shared application', `${A}/application/`, target(`${SHARED}/application`), 'allow'],
  ['application → own contracts', `${A}/application/`, target(`${A}/contracts`), 'allow'],
  ['application → other module index.ts', `${A}/application/`, `${B}/index.ts`, 'allow'],
  ['infrastructure → own application', `${A}/infrastructure/`, target(`${A}/application`), 'allow'],
  ['infrastructure → own domain', `${A}/infrastructure/`, target(`${A}/domain`), 'allow'],
  ['infrastructure → npm package', `${A}/infrastructure/`, `npm:${FAKE_PKG}`, 'allow'],
  ['api → own application', `${A}/api/`, target(`${A}/application`), 'allow'],
  ['api → own contracts', `${A}/api/`, target(`${A}/contracts`), 'allow'],
  ['api → shared infrastructure', `${A}/api/`, target(`${SHARED}/infrastructure`), 'allow'],
  ['contracts → shared domain', `${A}/contracts/`, target(`${SHARED}/domain`), 'allow'],
  ['contracts → npm package', `${A}/contracts/`, `npm:${FAKE_PKG}`, 'allow'],
  ['index.ts → own Nest module', `${A}/index.ts`, `${A}/alpha.module.ts`, 'allow'],
  ['index.ts → own contracts', `${A}/index.ts`, target(`${A}/contracts`), 'allow'],
  ['Nest module → own infrastructure', `${A}/alpha.module.ts`, target(`${A}/infrastructure`), 'allow'],
  ['Nest module → own api', `${A}/alpha.module.ts`, target(`${A}/api`), 'allow'],
  ['shared infrastructure → shared domain', `${SHARED}/infrastructure/`, target(`${SHARED}/domain`), 'allow'],
  ['domain test → own infrastructure', `${A}/domain/case.spec.ts`, target(`${A}/infrastructure`), 'allow'],
  ...settings.domainAllowedPackages.map((name) => [`domain → allowed package ${name}`, `${A}/domain/`, `pkg:${name}`, 'allow']),
  ...(settings.apiMayImportDomain ? [['api → own domain (setting on)', `${A}/api/`, target(`${A}/domain`), 'allow']] : []),
  ...(rootFile ? [['root file → module index.ts', rootFile, `${A}/index.ts`, 'allow']] : []),
  ...(settings.unresolvedAllowed ?? []).map((s) => [`listed unresolved import ${s}`, `${A}/api/`, `missing:${s}`, 'allow']),

  // Forbidden.
  ['domain → own application', `${A}/domain/`, target(`${A}/application`), 'domain-isolated'],
  ['domain → own infrastructure (type only)', `${A}/domain/`, `type:${target(`${A}/infrastructure`)}`, 'domain-isolated'],
  ['domain → npm package', `${A}/domain/`, `npm:${FAKE_PKG}`, 'domain-isolated'],
  ...(settings.domainAllowedPackages.includes('fs') ? [] : [['domain → Node built-in fs', `${A}/domain/`, 'core:fs', 'domain-isolated']]),
  ['shared domain → shared infrastructure', `${SHARED}/domain/`, target(`${SHARED}/infrastructure`), 'domain-isolated'],
  ['application → own infrastructure', `${A}/application/`, target(`${A}/infrastructure`), 'application-inward'],
  ['application → own api', `${A}/application/`, target(`${A}/api`), 'application-inward'],
  ['application → shared infrastructure', `${A}/application/`, target(`${SHARED}/infrastructure`), 'application-inward'],
  ['infrastructure → own api', `${A}/infrastructure/`, target(`${A}/api`), 'infrastructure-not-api'],
  ['api → own infrastructure', `${A}/api/`, target(`${A}/infrastructure`), 'api-uses-application'],
  ...(settings.apiMayImportDomain ? [] : [['api → own domain', `${A}/api/`, target(`${A}/domain`), 'api-uses-application']]),
  ['contracts → own domain', `${A}/contracts/`, target(`${A}/domain`), 'contracts-isolated'],
  ['index.ts → own application', `${A}/index.ts`, target(`${A}/application`), 'index-exposes-public-surface'],
  ['application → other module domain', `${A}/application/`, target(`${B}/domain`), 'cross-module-via-index'],
  ['application → other module contracts (deep)', `${A}/application/`, target(`${B}/contracts`), 'cross-module-via-index'],
  ['shared → module index.ts', `${SHARED}/infrastructure/`, `${A}/index.ts`, 'shared-not-to-modules'],
  ...(rootFile ? [['root file → module internals', rootFile, target(`${A}/domain`), 'outside-via-index']] : []),
  ['loose file → module index.ts', `${SRC}/legacy/helper.ts`, `${A}/index.ts`, 'outside-architecture-from'],
  ['loose file in a module root', `${A}/alpha.service.ts`, target(`${A}/domain`), 'outside-architecture-from'],
  ['unknown folder in a module', `${A}/services/thing.ts`, target(`${A}/domain`), 'outside-architecture-from'],
  ['application → loose file', `${A}/application/`, `${SRC}/legacy/util.ts`, 'outside-architecture-to'],
  ['loose file with no imports', `${SRC}/legacy/lonely.ts`, 'orphan', 'outside-architecture-orphan'],
  ['circular import', `${A}/domain/cycle-a.ts`, `${A}/domain/cycle-b.ts`, 'no-circular'],
  ['unresolvable import', `${A}/api/`, 'missing:./does-not-exist', 'not-to-unresolvable'],
];

// Build the throwaway project.
const temp = mkdtempSync(join(tmpdir(), 'arch-selftest-'));
const files = new Map(); // path -> import lines
const write = (path, body) => {
  mkdirSync(join(temp, dirname(path)), { recursive: true });
  writeFileSync(join(temp, path), body);
};
const addImport = (from, line) => {
  if (!files.has(from)) files.set(from, []);
  if (line) files.get(from).push(line);
};
const rel = (from, to) => {
  let r = posix.relative(posix.dirname(from), to).replace(/\.ts$/, '');
  return r.startsWith('.') ? r : `./${r}`;
};

const plans = cases.map(([label, from, to, expect], i) => {
  const fromFile = from.endsWith('/') ? `${from}case-${i}.ts` : from;
  const n = `v${i}`;
  let toPath;
  if (to === 'orphan') {
    addImport(fromFile, null);
    toPath = fromFile;
  } else if (to.startsWith('npm:') || to.startsWith('pkg:')) {
    const name = to.slice(4);
    if (builtinModules.includes(name.replace(/^node:/, ''))) {
      addImport(fromFile, `import * as ${n} from '${name}';\nexport const e${n} = ${n};`);
      toPath = name.replace(/^node:/, '');
    } else {
      makePackage(name);
      addImport(fromFile, `import * as ${n} from '${name}';\nexport const e${n} = ${n};`);
      toPath = `node_modules/${name}/index.js`;
    }
  } else if (to.startsWith('core:')) {
    addImport(fromFile, `import * as ${n} from 'node:${to.slice(5)}';\nexport const e${n} = ${n};`);
    toPath = to.slice(5);
  } else if (to.startsWith('missing:')) {
    addImport(fromFile, `import * as ${n} from '${to.slice(8)}';\nexport const e${n} = ${n};`);
    toPath = to.slice(8);
  } else if (to.startsWith('type:')) {
    toPath = to.slice(5);
    addImport(fromFile, `import type { TargetType as T${n} } from '${rel(fromFile, toPath)}';\nexport type E${n} = T${n};`);
    addImport(toPath, null);
  } else {
    toPath = to;
    addImport(fromFile, `import * as ${n} from '${rel(fromFile, toPath)}';\nexport const e${n} = ${n};`);
    addImport(toPath, null);
  }
  return { label, fromFile, toPath, expect, typeOnly: to.startsWith('type:') };
});

function makePackage(name) {
  write(`node_modules/${name}/package.json`, JSON.stringify({ name, version: '1.0.0', main: 'index.js' }));
  write(`node_modules/${name}/index.js`, 'module.exports = {};\n');
}
makePackage(FAKE_PKG);

// Every module needs an index.ts and a module file, or the fixture itself is broken.
for (const mod of [A, B]) {
  addImport(`${mod}/index.ts`, null);
  addImport(`${mod}/${posix.basename(mod)}.module.ts`, null);
}
addImport(`${B}/index.ts`, `export * from './beta.module';`);
addImport(`${A}/domain/cycle-b.ts`, `import * as cyc from './cycle-a';\nexport const back = cyc;`);
if (rootFile) addImport(rootFile, null);

for (const [path, lines] of files) {
  const body = [...lines, 'export const target = 1;', 'export interface TargetType { v: number }', ''];
  write(path, body.join('\n'));
}
const tsConfigName = config.options?.tsConfig?.fileName ?? 'tsconfig.json';
write(
  tsConfigName,
  JSON.stringify({ compilerOptions: { module: 'commonjs', moduleResolution: 'node', strict: true, skipLibCheck: true } }),
);
copyFileSync(configPath, join(temp, 'arch.config.cjs'));

// Run the project's dependency-cruiser on the throwaway project.
const run = spawnSync(process.execPath, [depcruise, SRC, '--config', 'arch.config.cjs', '--output-type', 'json'], {
  cwd: temp,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (!keep) rmSync(temp, { recursive: true, force: true });
if (run.status !== 0 || !run.stdout.trim().startsWith('{')) {
  fail(`dependency-cruiser failed (exit ${run.status}):\n${run.stderr || run.stdout}`);
}
const result = JSON.parse(run.stdout);

const edges = new Map();
for (const m of result.modules) for (const d of m.dependencies) edges.set(`${m.source}|${d.resolved}`, d);
const violations = result.summary.violations;

let failed = 0;
// A rule set to `warn` still reports, but does not fail the build.
for (const name of new Set(plans.map((p) => p.expect).filter((e) => e !== 'allow'))) {
  const rule = config.forbidden?.find((r) => r.name === name);
  if (rule && rule.severity !== 'error') {
    failed += 1;
    console.log(`FAIL  rule ${name} has severity "${rule.severity}"; it must be "error" to fail checks`);
  }
}
for (const p of plans) {
  const isOrphan = p.toPath === p.fromFile;
  const found = violations
    .filter((v) => v.from === p.fromFile && (isOrphan || v.to === p.toPath))
    .map((v) => v.rule.name);
  const edge = edges.get(`${p.fromFile}|${p.toPath}`);
  let problem = null;
  if (!isOrphan && !edge) problem = 'import was not found by dependency-cruiser';
  else if (p.typeOnly && !edge.dependencyTypes.includes('type-only')) problem = 'type-only import not seen (tsPreCompilationDeps off?)';
  else if (p.expect === 'allow' && found.length) problem = `blocked by ${[...new Set(found)].join(', ')}`;
  else if (p.expect !== 'allow' && !found.includes(p.expect)) {
    problem = `expected ${p.expect}, got ${found.length ? [...new Set(found)].join(', ') : 'no violation'}`;
  }
  if (problem) failed += 1;
  const want = p.expect === 'allow' ? 'allowed' : `blocked (${p.expect})`;
  console.log(`${problem ? 'FAIL' : 'ok  '}  ${p.label}: ${want}${problem ? ` — ${problem}` : ''}`);
}

const summary = failed ? `${failed} problem(s) in ${plans.length} cases` : `${plans.length}/${plans.length} cases passed`;
console.log(`\n${summary}${keep ? ` (fixture kept at ${temp})` : ''}`);
process.exit(failed ? 1 : 0);
