#!/usr/bin/env node
// Tests for inspect.mjs, add-module.mjs, and arch-selftest.mjs.
// Run: node --test skills/nestjs-modular-monolith/scripts/modular-monolith.test.mjs
// Builds fake projects in temp folders. Tests that run dependency-cruiser need it in
// scripts/node_modules (cd scripts && npm install) or DEPCRUISE_BIN; otherwise they skip.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const skill = dirname(here);
const template = readFileSync(join(skill, 'assets', 'dependency-cruiser.cjs'), 'utf8');
const temp = mkdtempSync(join(tmpdir(), 'nest-mm-'));
after(() => rmSync(temp, { recursive: true, force: true }));

function findDepcruise() {
  if (process.env.DEPCRUISE_BIN) return process.env.DEPCRUISE_BIN;
  const pkgPath = join(skill, '..', '..', 'scripts', 'node_modules', 'dependency-cruiser', 'package.json');
  if (!existsSync(pkgPath)) return null;
  return join(dirname(pkgPath), JSON.parse(readFileSync(pkgPath, 'utf8')).bin.depcruise);
}
const depcruise = findDepcruise();
const needsDepcruise = depcruise ? {} : { skip: 'dependency-cruiser not installed in scripts/' };

let count = 0;
function project(files) {
  const dir = join(temp, `p${count++}`);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}
const node = (script, ...args) => spawnSync(process.execPath, [join(here, script), ...args], { encoding: 'utf8' });
const json = (r) => JSON.parse(r.stdout);

const ESM_APP = {
  'package.json': JSON.stringify({ type: 'module', dependencies: { '@nestjs/core': '^12.0.0' }, devDependencies: { vitest: '^4.0.0' } }),
  'package-lock.json': '{}',
  'nest-cli.json': '{ "sourceRoot": "src" }',
  'tsconfig.json': '{ "compilerOptions": { "module": "nodenext" } }',
  'src/main.ts': "import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module.js';\n",
  'src/app.module.ts': "import { Module } from '@nestjs/common';\n\n@Module({\n  imports: [],\n})\nexport class AppModule {}\n",
};

// ---------- add-module ----------

test('add-module creates layers, module, index, and registers with .js suffix', () => {
  const dir = project(ESM_APP);
  const r = node('add-module.mjs', dir, 'order-history');
  assert.equal(r.status, 0, r.stderr);
  const out = json(r);
  assert.equal(out.manual, null);
  for (const layer of ['domain', 'application', 'infrastructure', 'api', 'contracts']) {
    assert.ok(existsSync(join(dir, `src/modules/order-history/${layer}/.gitkeep`)));
  }
  assert.match(readFileSync(join(dir, 'src/modules/order-history/order-history.module.ts'), 'utf8'), /export class OrderHistoryModule \{\}/);
  assert.equal(
    readFileSync(join(dir, 'src/modules/order-history/index.ts'), 'utf8'),
    "export { OrderHistoryModule } from './order-history.module.js';\n",
  );
  const app = readFileSync(join(dir, 'src/app.module.ts'), 'utf8');
  assert.match(app, /import \{ OrderHistoryModule \} from '\.\/modules\/order-history\/index\.js';/);
  assert.match(app, /imports: \[OrderHistoryModule\]/);
});

test('add-module follows CommonJS style, double quotes, and multi-line imports', () => {
  const dir = project({
    'package.json': '{}',
    'src/main.ts': 'import { AppModule } from "./app.module";\n',
    'src/app.module.ts':
      'import { Module } from "@nestjs/common";\nimport { ConfigModule } from "@nestjs/config";\n\n@Module({\n  imports: [\n    ConfigModule.forRoot({ isGlobal: true }),\n  ],\n  providers: [],\n})\nexport class AppModule {}\n',
  });
  assert.equal(node('add-module.mjs', dir, 'billing').status, 0);
  const app = readFileSync(join(dir, 'src/app.module.ts'), 'utf8');
  assert.match(app, /import \{ BillingModule \} from "\.\/modules\/billing";\n\n@Module/);
  assert.match(app, /imports: \[\n {4}ConfigModule\.forRoot\(\{ isGlobal: true \}\),\n {4}BillingModule,\n {2}\],/);
  assert.equal(readFileSync(join(dir, 'src/modules/billing/index.ts'), 'utf8'), 'export { BillingModule } from "./billing.module";\n');
});

test('add-module handles @Module({}) and a decorator without imports', () => {
  const empty = project({ ...ESM_APP, 'src/app.module.ts': "import { Module } from '@nestjs/common';\n\n@Module({})\nexport class AppModule {}\n" });
  node('add-module.mjs', empty, 'billing');
  assert.match(readFileSync(join(empty, 'src/app.module.ts'), 'utf8'), /@Module\(\{ imports: \[BillingModule\] \}\)/);

  const noKey = project({
    ...ESM_APP,
    'src/app.module.ts': "import { Module } from '@nestjs/common';\n\n@Module({\n  providers: [],\n})\nexport class AppModule {}\n",
  });
  node('add-module.mjs', noKey, 'billing');
  const app = readFileSync(join(noKey, 'src/app.module.ts'), 'utf8');
  assert.match(app, /@Module\(\{\n {2}imports: \[BillingModule\],\n {2}providers: \[\],/);
  // An `imports` key in a later decorator or object must not be touched.
  const later = project({
    ...ESM_APP,
    'src/app.module.ts': "import { Module } from '@nestjs/common';\n\n@Module({ providers: [] })\nexport class AppModule {}\nexport const other = { imports: [] };\n",
  });
  node('add-module.mjs', later, 'billing');
  const text = readFileSync(join(later, 'src/app.module.ts'), 'utf8');
  assert.match(text, /@Module\(\{ imports: \[BillingModule\], providers: \[\] \}\)/);
  assert.match(text, /other = \{ imports: \[\] \}/);
});

test('add-module uses an existing module path alias', () => {
  const dir = project({
    ...ESM_APP,
    'tsconfig.json': '{\n  // aliases\n  "compilerOptions": { "paths": { "@modules/*": ["./src/modules/*"], }, },\n}\n',
  });
  node('add-module.mjs', dir, 'billing');
  assert.match(readFileSync(join(dir, 'src/app.module.ts'), 'utf8'), /from '@modules\/billing\/index\.js'/);
});

test('add-module refuses bad names and existing modules; dry run writes nothing', () => {
  const dir = project(ESM_APP);
  assert.equal(node('add-module.mjs', dir, 'Billing').status, 2);
  assert.equal(node('add-module.mjs', dir, 'billing_x').status, 2);
  const dry = node('add-module.mjs', dir, 'billing', '--dry-run');
  assert.equal(json(dry).dryRun, true);
  assert.ok(!existsSync(join(dir, 'src/modules/billing')));
  assert.equal(readFileSync(join(dir, 'src/app.module.ts'), 'utf8'), ESM_APP['src/app.module.ts']);
  node('add-module.mjs', dir, 'billing');
  assert.equal(node('add-module.mjs', dir, 'billing').status, 2);
});

test('add-module reports manual registration when no root module exists', () => {
  const dir = project({ 'package.json': '{}', 'src/main.ts': '' });
  const out = json(node('add-module.mjs', dir, 'billing'));
  assert.match(out.manual, /Add BillingModule/);
  assert.deepEqual(out.updated, []);
});

test('add-module leaves metadata it cannot read for sure untouched', () => {
  const unsafe = {
    variable: '@Module({ imports: ROOT_IMPORTS })',
    shorthand: '@Module({ imports })',
    spread: '@Module({ ...base, providers: [] })',
    duplicate: '@Module({ imports: [], imports: [] })',
    notLiteral: '@Module(metadata)',
  };
  for (const [label, deco] of Object.entries(unsafe)) {
    const body = `import { Module } from '@nestjs/common';\n\n${deco}\nexport class AppModule {}\n`;
    const dir = project({ ...ESM_APP, 'src/app.module.ts': body });
    const out = json(node('add-module.mjs', dir, 'billing'));
    assert.match(out.manual ?? '', /Could not edit src\/app\.module\.ts safely/, label);
    assert.deepEqual(out.updated, [], label);
    assert.equal(readFileSync(join(dir, 'src/app.module.ts'), 'utf8'), body, label);
  }
});

test('add-module ignores imports keys nested inside other metadata and comments', () => {
  const dir = project({
    ...ESM_APP,
    'src/app.module.ts':
      "import { Module } from '@nestjs/common';\n\n@Module({\n  // imports: [Old],\n  providers: [Db.forRootAsync({ imports: [ConfigModule] })],\n  controllers: ['a, b'],\n})\nexport class AppModule {}\n",
  });
  assert.equal(json(node('add-module.mjs', dir, 'billing')).manual, null);
  const app = readFileSync(join(dir, 'src/app.module.ts'), 'utf8');
  assert.match(app, /@Module\(\{\n {2}imports: \[BillingModule\],\n {2}\/\/ imports: \[Old\],/);
  assert.match(app, /forRootAsync\(\{ imports: \[ConfigModule\] \}\)/);
});

test('add-module keeps comments inside the imports array out of the way', () => {
  const add = (deco) => {
    const dir = project({ ...ESM_APP, 'src/app.module.ts': `import { Module } from '@nestjs/common';\n\n${deco}\nexport class AppModule {}\n` });
    assert.equal(json(node('add-module.mjs', dir, 'billing')).manual, null, deco);
    return readFileSync(join(dir, 'src/app.module.ts'), 'utf8');
  };
  // Only a comment: no array hole like `[/* c */, BillingModule]`.
  assert.match(add('@Module({ imports: [/* add modules here */] })'), /imports: \[BillingModule \/\* add modules here \*\/\]/);
  // Last item has a line comment: the comma goes before the comment, not inside it.
  const lineComment = add('@Module({\n  imports: [\n    ConfigModule // global config\n  ],\n})');
  assert.match(lineComment, /imports: \[\n {4}ConfigModule, \/\/ global config\n {4}BillingModule,\n {2}\]/);
  // Trailing comma and a comment after it.
  const trailing = add('@Module({\n  imports: [\n    ConfigModule, // global config\n  ],\n})');
  assert.match(trailing, /ConfigModule, \/\/ global config\n {4}BillingModule,\n {2}\]/);
  // Comment-only multi-line array.
  assert.match(add('@Module({\n  imports: [\n    // add modules here\n  ],\n})'), /imports: \[\n {4}BillingModule,\n {4}\/\/ add modules here\n {2}\]/);
  // Same-line block comment after the last item.
  assert.match(add('@Module({ imports: [ConfigModule /* global */] })'), /imports: \[ConfigModule, BillingModule \/\* global \*\/\]/);
});

// ---------- inspect ----------

test('inspect reports toolchain and coverage; starter names alone are not a fresh project', () => {
  const dir = project({ ...ESM_APP, 'src/app.controller.ts': "import { x } from './app.service.js';\n", 'src/app.service.ts': '' });
  const r = json(node('inspect.mjs', dir, '--no-cruise'));
  assert.equal(r.nest.found, true);
  assert.equal(r.packageManager.name, 'npm');
  assert.equal(r.packageManager.commands.addDev, 'npm install -D');
  assert.equal(r.packageManager.yarnPnp, false);
  assert.deepEqual(r.blockers, []);
  assert.equal(r.moduleSystem.importSuffix, '.js');
  assert.equal(r.testRunner, 'vitest');
  assert.equal(r.layout.freshNestProject, false);
  assert.equal(r.layout.starterFiles['app.service.ts'], 'changed');
  assert.deepEqual(r.layout.outsideSample, ['src/app.controller.ts', 'src/app.service.ts']);
  assert.equal(r.settingsSource, 'defaults');
});

// The `nest new` output (@nestjs/schematics 12, observe off), CommonJS style.
const STARTER_APP = {
  'package.json': JSON.stringify({ dependencies: { '@nestjs/core': '^12.0.0' } }),
  'src/main.ts': "import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\n\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(process.env.PORT ?? 3000);\n}\nvoid bootstrap();\n",
  'src/app.module.ts': "import { Module } from '@nestjs/common';\nimport { AppController } from './app.controller';\nimport { AppService } from './app.service';\n\n@Module({\n  imports: [],\n  controllers: [AppController],\n  providers: [AppService],\n})\nexport class AppModule {}\n",
  'src/app.service.ts': "import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class AppService {\n  getHello(): string {\n    return 'Hello World!';\n  }\n}\n",
  'src/app.controller.ts': "import { Controller, Get } from '@nestjs/common';\nimport { AppService } from './app.service';\n\n@Controller()\nexport class AppController {\n  constructor(private readonly appService: AppService) {}\n\n  @Get()\n  getHello(): string {\n    return this.appService.getHello();\n  }\n}\n",
};
const esm = (files) =>
  Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replace(/from '(\.\/[^']+)'/g, "from '$1.js'")]));

test('inspect marks untouched nest new starters as fresh, in CommonJS and ESM', () => {
  for (const files of [STARTER_APP, esm(STARTER_APP)]) {
    const r = json(node('inspect.mjs', project(files), '--no-cruise'));
    assert.equal(r.layout.freshNestProject, true);
    assert.ok(Object.values(r.layout.starterFiles).every((s) => s === 'untouched'));
  }
  // Formatting differences (double quotes, no semicolons) are still the starter.
  const formatted = { ...STARTER_APP, 'src/app.service.ts': STARTER_APP['src/app.service.ts'].replaceAll("'", '"').replaceAll(';', '') };
  assert.equal(json(node('inspect.mjs', project(formatted), '--no-cruise')).layout.freshNestProject, true);
});

test('inspect keeps an app with real code in starter files out of new mode', () => {
  const cases = {
    'src/app.service.ts': STARTER_APP['src/app.service.ts'].replace("return 'Hello World!';", 'return charge(4200);'),
    'src/app.controller.ts': STARTER_APP['src/app.controller.ts'].replace("@Get()", "@Get('status')"),
    'src/app.module.ts': STARTER_APP['src/app.module.ts'].replace('imports: []', 'imports: [ConfigModule.forRoot()]'),
  };
  for (const [file, body] of Object.entries(cases)) {
    const r = json(node('inspect.mjs', project({ ...STARTER_APP, [file]: body }), '--no-cruise'));
    assert.equal(r.layout.freshNestProject, false, file);
    assert.equal(r.layout.starterFiles[file.slice(4)], 'changed', file);
  }
  const extraFile = json(node('inspect.mjs', project({ ...STARTER_APP, 'src/users.ts': '' }), '--no-cruise'));
  assert.equal(extraFile.layout.freshNestProject, false);
});

test("inspect reports Yarn Plug'n'Play as a blocker", () => {
  const yarn = { ...ESM_APP, 'package.json': JSON.stringify({ packageManager: 'yarn@4.5.0' }) };
  const pnpFile = json(node('inspect.mjs', project({ ...yarn, '.pnp.cjs': '' }), '--no-cruise'));
  assert.equal(pnpFile.packageManager.yarnPnp, true);
  assert.match(pnpFile.blockers[0], /nodeLinker: node-modules/);
  const pnpDefault = json(node('inspect.mjs', project({ ...yarn, '.yarnrc.yml': 'enableTelemetry: false\n' }), '--no-cruise'));
  assert.equal(pnpDefault.packageManager.yarnPnp, true);
  const linker = json(node('inspect.mjs', project({ ...yarn, '.yarnrc.yml': 'nodeLinker: node-modules\n' }), '--no-cruise'));
  assert.equal(linker.packageManager.yarnPnp, false);
  assert.deepEqual(linker.blockers, []);
  const classic = json(node('inspect.mjs', project({ ...ESM_APP, 'package.json': '{}', 'yarn.lock': '' }), '--no-cruise'));
  assert.equal(classic.packageManager.yarnPnp, false);
  // A clean checkout: no install yet, so no .pnp.cjs, and no .yarnrc.yml. Yarn 2+ still defaults to PnP.
  const cleanCheckout = json(node('inspect.mjs', project({ ...yarn, 'yarn.lock': '' }), '--no-cruise'));
  assert.equal(cleanCheckout.packageManager.yarnPnp, true);
  const berryLock = json(node('inspect.mjs', project({ ...ESM_APP, 'package.json': '{}', 'yarn.lock': '__metadata:\n  version: 8\n' }), '--no-cruise'));
  assert.equal(berryLock.packageManager.yarnPnp, true);
  const yarn1 = { ...ESM_APP, 'package.json': JSON.stringify({ packageManager: 'yarn@1.22.22' }), 'yarn.lock': '' };
  assert.equal(json(node('inspect.mjs', project(yarn1), '--no-cruise')).packageManager.yarnPnp, false);
});

test("self-test explains Yarn Plug'n'Play instead of a missing install", () => {
  const dir = project({ 'package.json': '{}', '.pnp.cjs': '', '.dependency-cruiser.cjs': template });
  const r = node('arch-selftest.mjs', dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Plug'n'Play is not supported/);
});

test('inspect finds legacy code, module candidates, and broken modules', () => {
  const dir = project({
    ...ESM_APP,
    'pnpm-lock.yaml': '',
    'src/users/users.module.ts': '',
    'src/users/users.service.ts': '',
    'src/modules/billing/domain/invoice.ts': '',
    'src/modules/billing/services/stray.ts': '',
    'src/modules/billing/billing.service.ts': '',
    'src/shared/domain/id.ts': '',
    'src/shared/misc.ts': '',
  });
  const r = json(node('inspect.mjs', dir, '--no-cruise'));
  assert.equal(r.packageManager.name, 'pnpm');
  assert.deepEqual(r.layout.featureModuleCandidates, ['src/users']);
  assert.equal(r.layout.outsideByFolder['src/users'], 2);
  assert.equal(r.layout.outsideByFolder['src/modules/billing'], 2);
  assert.equal(r.layout.outsideByFolder['src/shared'], 1);
  const billing = r.layout.modules.find((m) => m.name === 'billing');
  assert.equal(billing.hasIndex, false);
  assert.equal(billing.hasModuleFile, false);
  assert.deepEqual(billing.layers, ['domain']);
  assert.equal(r.layout.freshNestProject, false);
});

test('inspect reads settings from a template config', () => {
  const dir = project({
    ...ESM_APP,
    '.dependency-cruiser.cjs': template.replace("rootFiles: ['main.ts', 'app.module.ts']", "rootFiles: ['main.ts', 'app.module.ts', 'worker.ts']"),
    'src/worker.ts': '',
  });
  const r = json(node('inspect.mjs', dir, '--no-cruise'));
  assert.equal(r.settingsSource, '.dependency-cruiser.cjs');
  assert.equal(r.dependencyCruiser.configFromTemplate, true);
  assert.equal(r.layout.outsideFiles, 0);
});

// ---------- arch-selftest and the template rules ----------

function selftest(config, extra = {}) {
  const dir = project({ 'package.json': '{}', '.dependency-cruiser.cjs': config, ...extra });
  return node('arch-selftest.mjs', dir, `--depcruise=${depcruise}`);
}

test('self-test passes on the template config', needsDepcruise, () => {
  const r = selftest(template);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /(\d+)\/\1 cases passed/);
});

test('self-test follows the settings', needsDepcruise, () => {
  const config = template
    .replace('apiMayImportDomain: false', 'apiMayImportDomain: true')
    .replace('domainAllowedPackages: []', "domainAllowedPackages: ['decimal.js', 'crypto']")
    .replace("sourceRoot: 'src'", "sourceRoot: 'apps/api/src'")
    .replace("modulesDir: 'src/modules'", "modulesDir: 'apps/api/src/contexts'")
    .replace("sharedDir: 'src/shared'", "sharedDir: 'apps/api/src/kernel'");
  const r = selftest(config);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ok {4}api → own domain \(setting on\): allowed/);
  assert.match(r.stdout, /ok {4}domain → allowed package decimal\.js: allowed/);
  assert.match(r.stdout, /ok {4}domain → allowed package crypto: allowed/);
  assert.match(r.stdout, /ok {4}domain → Node built-in fs: blocked/);
});

test('self-test fails when a rule is removed, weakened, or blocks everything', needsDepcruise, () => {
  const renamed = selftest(template.replace("name: 'domain-isolated'", "name: 'renamed'"));
  assert.equal(renamed.status, 1);
  assert.match(renamed.stdout, /FAIL {2}domain → own application: blocked \(domain-isolated\) — expected domain-isolated, got renamed/);

  const noop = selftest(template.replace("to: { path: ['^$1/api/', `^${SHARED}/api/`] }", () => "to: { path: '^nothing$' }"));
  assert.equal(noop.status, 1);
  assert.match(noop.stdout, /FAIL {2}infrastructure → own api: .* got no violation/);

  const warn = selftest(template.replace(/(name: 'no-circular',\r?\n\s+severity: )'error'/, "$1'warn'"));
  assert.equal(warn.status, 1);
  assert.match(warn.stdout, /FAIL {2}rule no-circular has severity "warn"/);

  const blockAll = selftest(template.replace('  forbidden: [', "  forbidden: [{ name: 'block-all', severity: 'error', from: {}, to: {} },"));
  assert.equal(blockAll.status, 1);
  assert.match(blockAll.stdout, /FAIL {2}domain → own domain: allowed — blocked by block-all/);
});

test('self-test refuses a config without template settings', needsDepcruise, () => {
  const r = selftest("module.exports = { forbidden: [] };\n");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no hidden `settings`/);
});

test('generated modules pass the real rules; a deep import fails', needsDepcruise, () => {
  const fakePkg = (name) => ({
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, version: '1.0.0', main: 'index.js' }),
    [`node_modules/${name}/index.js`]: 'module.exports = {};\n',
  });
  const dir = project({ ...ESM_APP, ...fakePkg('@nestjs/common'), ...fakePkg('@nestjs/core'), '.dependency-cruiser.cjs': template });
  node('add-module.mjs', dir, 'billing');
  node('add-module.mjs', dir, 'catalog');
  const run = () =>
    spawnSync(process.execPath, [depcruise, 'src', '--config', '.dependency-cruiser.cjs'], { cwd: dir, encoding: 'utf8' });
  const clean = run();
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);

  writeFileSync(join(dir, 'src/modules/catalog/domain/product.ts'), 'export const product = 1;\n');
  writeFileSync(
    join(dir, 'src/modules/billing/application/use-product.ts'),
    "import { product } from '../../catalog/domain/product.js';\nexport const p = product;\n",
  );
  const dirty = run();
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stdout, /cross-module-via-index: src\/modules\/billing\/application\/use-product\.ts → src\/modules\/catalog\/domain\/product\.ts/);
});

// ---------- docs keep the facts the agent needs ----------

const doc = (path) => readFileSync(join(skill, path), 'utf8');

test('rules.md documents every rule and setting in the template', () => {
  const rules = doc('references/rules.md');
  const names = [...template.matchAll(/name: '([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 14);
  for (const name of names) assert.ok(rules.includes(name.replace(/-(from|to|orphan)$/, '')), `rules.md misses ${name}`);
  const block = template.slice(template.indexOf('const settings = {'), template.indexOf('};'));
  for (const key of [...block.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1])) {
    assert.ok(rules.includes(`\`${key}\``), `rules.md misses setting ${key}`);
  }
});

test('docs link only to files that exist and keep the safety statements', () => {
  for (const file of ['SKILL.md', 'references/structure.md', 'references/rules.md', 'references/existing-project.md', 'references/options.md']) {
    for (const [, target] of doc(file).matchAll(/\]\(((?:\.\.\/|references\/|assets\/|scripts\/)[^)#]+)\)/g)) {
      assert.ok(existsSync(join(skill, dirname(file), target)), `${file} links to missing ${target}`);
    }
  }
  const entry = doc('SKILL.md');
  assert.match(entry, /[Nn]ever weaken/);
  assert.match(entry, /migration preparation/);
  assert.match(entry, /never invent business modules|Never invent business modules/);
  const rules = doc('references/rules.md');
  for (const limit of ['Business boundaries', 'Data ownership', 'Runtime coupling']) assert.ok(rules.includes(limit), limit);
  const existing = doc('references/existing-project.md');
  assert.match(existing, /not a clean bill of health/);
  assert.match(existing, /only shrink/);
});

test('SKILL.md settings-block marker matches the template', () => {
  assert.match(doc('SKILL.md'), /Read it only through the `---- Rules below` line/);
  const lines = template.replace(/\r\n/g, '\n').split('\n');
  const n = lines.findIndex((line) => line.startsWith('// ---- Rules below are built from `settings`')) + 1;
  assert.ok(n > 0, 'template has no `---- Rules below` line');
  assert.ok(lines.slice(0, n).join('\n').includes('tsConfig:'));
  // Only in this repository; an installed copy of the skill has no token benchmark.
  const scenariosPath = join(skill, '..', '..', 'scripts', 'token-scenarios.json');
  if (!existsSync(scenariosPath)) return;
  const scenarios = readFileSync(scenariosPath, 'utf8');
  assert.ok(scenarios.includes(`dependency-cruiser.cjs#L1-${n}`), 'token-scenarios.json uses a different range');
});
