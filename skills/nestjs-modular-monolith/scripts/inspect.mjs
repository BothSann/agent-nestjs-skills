#!/usr/bin/env node
// Read-only facts about a NestJS project for the modular monolith skill: toolchain,
// module system, aliases, architecture coverage, and current boundary violations.
// Never installs, writes, or starts the app. JSON on stdout.
//
// Usage: node inspect.mjs [project-root] [--config=.dependency-cruiser.cjs] [--no-cruise]

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const configName = flag('config') ?? '.dependency-cruiser.cjs';
const cruise = !args.includes('--no-cruise');

const DEFAULTS = {
  sourceRoot: 'src',
  modulesDir: 'src/modules',
  sharedDir: 'src/shared',
  rootFiles: ['main.ts', 'app.module.ts'],
  apiMayImportDomain: false,
  domainAllowedPackages: [],
  unresolvedAllowed: ['supertest/types.js'],
  tsConfig: 'tsconfig.json',
};
const MODULE_LAYERS = ['domain', 'application', 'infrastructure', 'api', 'contracts'];
const SHARED_LAYERS = ['domain', 'application', 'infrastructure', 'api'];
const NEST_NEW_FILES = ['app.controller.ts', 'app.controller.spec.ts', 'app.service.ts', 'app.module.ts', 'main.ts'];
// `nest new` starter files (@nestjs/schematics 12, same in CommonJS and ESM apart from `.js`
// suffixes). New mode deletes or resets these, so each must match exactly; any edit means
// the app has real code and stays in existing mode.
const STARTER = {
  'app.service.ts': `import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}`,
  'app.controller.ts': `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}`,
  'app.controller.spec.ts': `import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
describe('AppController', () => {
  let appController: AppController;
  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    appController = app.get<AppController>(AppController);
  });
  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});`,
  'app.module.ts': `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}`,
};
// Ignore formatting only: whitespace, semicolons, quote style, trailing commas, `.js` suffixes.
const normalizeCode = (s) =>
  s
    .replace(/(['"])(\.{1,2}\/[^'"]+)\.js\1/g, '$1$2$1')
    .replace(/"/g, "'")
    .replace(/[\s;]/g, '')
    .replace(/,([}\])])/g, '$1');
const CODE = /\.(ts|tsx|js|mjs|cjs)$/;

const toPosix = (p) => p.replaceAll('\\', '/');
const rel = (p) => toPosix(relative(root, p)) || '.';

// JSON with comments and trailing commas (tsconfig, nest-cli.json).
function readJsonc(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1 || text.length;
    } else out += c;
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return null;
  }
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (CODE.test(entry.name)) files.push(full);
  }
  return files;
}

const pkg = readJsonc(join(root, 'package.json')) ?? {};
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const nestCli = readJsonc(join(root, 'nest-cli.json'));

// Settings: from an existing template-based config, else defaults.
const configPath = join(root, configName);
let configSettings = null;
let configLoadError = null;
if (existsSync(configPath)) {
  try {
    configSettings = createRequire(configPath)(configPath).settings ?? null;
  } catch (error) {
    configLoadError = String(error.message ?? error);
  }
}
const settings = { ...DEFAULTS, ...(configSettings ?? {}) };
if (!configSettings && nestCli?.sourceRoot && !nestCli.monorepo) {
  const src = toPosix(nestCli.sourceRoot).replace(/\/$/, '');
  Object.assign(settings, { sourceRoot: src, modulesDir: `${src}/modules`, sharedDir: `${src}/shared` });
}

function packageManager() {
  const declared = pkg.packageManager?.split('@')[0];
  const locks = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ];
  let found = null;
  for (let dir = root; !found; dir = dirname(dir)) {
    for (const [file, name] of locks) {
      if (existsSync(join(dir, file))) {
        found = { name, source: rel(join(dir, file)) };
        break;
      }
    }
    if (found || existsSync(join(dir, '.git')) || dirname(dir) === dir) break;
  }
  const name = declared ?? found?.name ?? null;
  // Yarn Plug'n'Play has no node_modules, and the scripts find dependency-cruiser there.
  // Yarn 2+ uses PnP unless .yarnrc.yml sets another nodeLinker, so a clean checkout
  // (no .pnp.cjs, no .yarnrc.yml) of a Yarn 2+ project still installs with PnP.
  let yarnPnp = false;
  if (name === 'yarn') {
    const declaredMajor = Number(/^yarn@(\d+)/.exec(pkg.packageManager ?? '')?.[1] ?? 0);
    let modern = declaredMajor >= 2;
    let linker = null;
    for (let dir = root; ; dir = dirname(dir)) {
      if (existsSync(join(dir, '.pnp.cjs')) || existsSync(join(dir, '.pnp.js'))) {
        yarnPnp = true;
        break;
      }
      const rc = join(dir, '.yarnrc.yml'); // Yarn 2+ only; Yarn 1 reads .yarnrc
      if (existsSync(rc)) {
        modern = true;
        linker = /^\s*nodeLinker:\s*["']?([\w-]+)/m.exec(readFileSync(rc, 'utf8'))?.[1] ?? null;
        break;
      }
      const lock = join(dir, 'yarn.lock');
      if (existsSync(lock) && /^__metadata:/m.test(readFileSync(lock, 'utf8'))) modern = true; // Yarn 2+ lockfile
      if (existsSync(join(dir, '.git')) || dirname(dir) === dir) break;
    }
    if (declaredMajor === 1) modern = false;
    yarnPnp ||= modern && (linker === null || linker === 'pnp');
  }
  const commands = {
    npm: { install: 'npm install', addDev: 'npm install -D', run: 'npm run', exec: 'npx' },
    pnpm: { install: 'pnpm install', addDev: 'pnpm add -D', run: 'pnpm run', exec: 'pnpm exec' },
    yarn: { install: 'yarn install', addDev: 'yarn add -D', run: 'yarn run', exec: 'yarn' },
    bun: { install: 'bun install', addDev: 'bun add -d', run: 'bun run', exec: 'bunx' },
  }[name];
  return { name, source: declared ? 'package.json packageManager' : (found?.source ?? null), commands: commands ?? null, yarnPnp };
}

function tsconfigInfo() {
  const file = join(root, settings.tsConfig);
  let paths = {};
  let module = null;
  let baseUrl = null;
  // Follow `extends` so aliases from a base config are seen too.
  for (let current = file, seen = 0; current && seen < 5; seen++) {
    const json = readJsonc(current);
    if (!json) break;
    const opts = json.compilerOptions ?? {};
    paths = { ...opts.paths, ...paths };
    module ??= opts.module ?? null;
    baseUrl ??= opts.baseUrl ?? null;
    current = typeof json.extends === 'string' && json.extends.startsWith('.') ? resolve(dirname(current), json.extends) : null;
    if (current && !current.endsWith('.json')) current += '.json';
  }
  const mods = settings.modulesDir.replace(/\/$/, '');
  const moduleAliases = Object.entries(paths)
    .filter(([key, targets]) => key.endsWith('/*') && targets.some((t) => posix.normalize(toPosix(t)).replace(/^\.\//, '') === `${mods}/*`))
    .map(([key]) => key.slice(0, -2));
  return { file: existsSync(file) ? rel(file) : null, module, baseUrl, paths, moduleAliases };
}

function importSuffix(files) {
  let js = 0;
  let bare = 0;
  for (const file of files.slice(0, 200)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      if (/\.(js|mjs|cjs)$/.test(m[1])) js++;
      else bare++;
    }
  }
  return js > bare ? '.js' : '';
}

function layout(files) {
  const src = settings.sourceRoot.replace(/\/$/, '');
  const mods = settings.modulesDir.replace(/\/$/, '');
  const shared = settings.sharedDir.replace(/\/$/, '');
  const rootNames = settings.rootFiles.map((f) => f.replace(/\.ts$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const rootFile = new RegExp(`^(${rootNames.join('|')})(\\.spec)?\\.ts$`);
  const isCovered = (p) => {
    if (p.startsWith(`${mods}/`)) {
      const parts = p.slice(mods.length + 1).split('/');
      if (parts.length === 2) return /^(index\.ts|[^/]+\.module(\.spec)?\.ts)$/.test(parts[1]);
      return MODULE_LAYERS.includes(parts[1]);
    }
    if (p.startsWith(`${shared}/`)) {
      const parts = p.slice(shared.length + 1).split('/');
      if (parts.length === 1) return /^(index\.ts|[^/]+\.module(\.spec)?\.ts)$/.test(parts[0]);
      return SHARED_LAYERS.includes(parts[0]);
    }
    const inRoot = p.slice(src.length + 1);
    return !inRoot.includes('/') && settings.rootFiles.length > 0 && rootFile.test(inRoot);
  };

  const relFiles = files.map(rel);
  const outside = relFiles.filter((p) => !isCovered(p));
  const outsideByFolder = {};
  for (const p of outside) {
    const top = p.slice(src.length + 1).split('/');
    const key = top.length === 1 ? `${src}/ (root files)` : `${src}/${top[0]}${top[0] === mods.split('/').pop() ? `/${top[1]}` : ''}`;
    outsideByFolder[key] = (outsideByFolder[key] ?? 0) + 1;
  }

  const modulesAbs = join(root, mods);
  const modules = existsSync(modulesAbs)
    ? readdirSync(modulesAbs, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
          const entries = readdirSync(join(modulesAbs, e.name));
          return {
            name: e.name,
            hasIndex: entries.includes('index.ts'),
            hasModuleFile: entries.some((f) => /\.module\.ts$/.test(f)),
            layers: MODULE_LAYERS.filter((l) => entries.includes(l)),
            outsideFiles: outside.filter((p) => p.startsWith(`${mods}/${e.name}/`)).length,
          };
        })
    : [];

  const candidates = [
    ...new Set(
      relFiles
        .filter((p) => /\.module\.ts$/.test(p) && !p.startsWith(`${mods}/`) && !p.startsWith(`${shared}/`))
        .map((p) => posix.dirname(p))
        .filter((d) => d !== src),
    ),
  ];

  const srcEntries = existsSync(join(root, src)) ? readdirSync(join(root, src)) : [];
  const starterFiles = Object.fromEntries(
    Object.keys(STARTER)
      .filter((f) => srcEntries.includes(f))
      .map((f) => [f, normalizeCode(readFileSync(join(root, src, f), 'utf8')) === normalizeCode(STARTER[f]) ? 'untouched' : 'changed']),
  );
  return {
    sourceFiles: relFiles.length,
    coveredFiles: relFiles.length - outside.length,
    outsideFiles: outside.length,
    outsideByFolder,
    outsideSample: outside.slice(0, 100),
    modules,
    sharedExists: existsSync(join(root, shared)),
    featureModuleCandidates: candidates,
    // True only when every file new mode deletes or resets is untouched starter code.
    freshNestProject:
      srcEntries.length > 0 &&
      srcEntries.every((f) => NEST_NEW_FILES.includes(f)) &&
      ['app.module.ts', 'app.service.ts'].every((f) => starterFiles[f]) &&
      Object.values(starterFiles).every((s) => s === 'untouched'),
    starterFiles,
  };
}

function findDepcruise() {
  for (let dir = root; ; dir = dirname(dir)) {
    const pkgPath = join(dir, 'node_modules', 'dependency-cruiser', 'package.json');
    if (existsSync(pkgPath)) {
      const json = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const bin = typeof json.bin === 'string' ? json.bin : json.bin.depcruise;
      return { version: json.version, bin: join(dirname(pkgPath), bin) };
    }
    if (dirname(dir) === dir) return null;
  }
}

function violations(depcruise) {
  if (!cruise) return { ran: false, reason: '--no-cruise' };
  if (!depcruise) return { ran: false, reason: 'dependency-cruiser not installed' };
  if (!existsSync(configPath)) return { ran: false, reason: `no ${configName}` };
  const targets = [settings.sourceRoot, ...(existsSync(join(root, 'test')) ? ['test'] : [])];
  const run = spawnSync(process.execPath, [depcruise.bin, ...targets, '--config', configName, '--output-type', 'json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (!run.stdout?.trim().startsWith('{')) return { ran: false, reason: (run.stderr || run.stdout || 'no output').trim().slice(0, 2000) };
  const list = JSON.parse(run.stdout).summary.violations;
  const byRule = {};
  for (const v of list) byRule[v.rule.name] = (byRule[v.rule.name] ?? 0) + 1;
  return { ran: true, targets, total: list.length, byRule, sample: list.slice(0, 30).map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`) };
}

const srcFiles = walk(join(root, settings.sourceRoot));
const depcruise = findDepcruise();
const scripts = pkg.scripts ?? {};
const archScripts = Object.entries(scripts).filter(([, cmd]) => /depcruise|dependency-cruis/.test(cmd));
const baselinePath = join(root, '.dependency-cruiser-known-violations.json');

const pm = packageManager();
const report = {
  root: toPosix(root),
  blockers: pm.yarnPnp
    ? ["Yarn Plug'n'Play is not supported: set `nodeLinker: node-modules` in .yarnrc.yml and run `yarn install`, or stop."]
    : [],
  nest: {
    found: Boolean(deps['@nestjs/core']),
    version: deps['@nestjs/core'] ?? null,
    monorepo: Boolean(nestCli?.monorepo),
    projects: nestCli?.projects ? Object.fromEntries(Object.entries(nestCli.projects).map(([k, v]) => [k, v.sourceRoot ?? v.root])) : null,
  },
  packageManager: pm,
  moduleSystem: {
    packageType: pkg.type ?? 'commonjs',
    importSuffix: importSuffix(srcFiles),
  },
  testRunner: deps.vitest ? 'vitest' : deps.jest ? 'jest' : null,
  tsconfig: tsconfigInfo(),
  dependencyCruiser: {
    installed: Boolean(depcruise),
    version: depcruise?.version ?? null,
    config: existsSync(configPath) ? configName : null,
    configFromTemplate: Boolean(configSettings),
    configLoadError,
    baseline: existsSync(baselinePath) ? rel(baselinePath) : null,
  },
  scripts: {
    arch: archScripts.map(([name, cmd]) => ({ name, cmd })),
    selftest: Object.entries(scripts).filter(([, cmd]) => cmd.includes('arch-selftest')).map(([name]) => name),
    checksRunningArch: Object.entries(scripts)
      .filter(([name, cmd]) => archScripts.some(([a]) => a !== name && new RegExp(`\\b${a}\\b`).test(cmd)))
      .map(([name]) => name),
  },
  settings,
  settingsSource: configSettings ? configName : 'defaults',
  layout: layout(srcFiles),
  violations: violations(depcruise),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
