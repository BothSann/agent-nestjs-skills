#!/usr/bin/env node
// Scan a NestJS app and print facts as JSON on stdout.
// Read-only: never writes files, never starts the app, never touches a database.
//
// Usage: node scan-project.mjs <repo-root> [--no-gh] [--merged-prs=<file.json>] [--home=<dir>]
//
// --no-gh          skip `gh pr list` (the merged-lesson check)
// --config=FILE    read config from FILE instead of <repo-root>/learn/learn.config.json
// --merged-prs=F   read merged PRs from a JSON file instead of `gh` (for tests)
// --home=DIR       look for ~/.claude/skills under DIR instead of the real home folder (for tests)
//
// Same input, same output: every list is sorted, no timestamps.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', 'learn', '.turbo', '.next',
  '.idea', '.vscode', '.cache', 'tmp',
]);

// File suffix -> class kind. Order matters: e2e-spec before spec.
const CLASS_KINDS = [
  ['.controller.ts', 'controllers'],
  ['.service.ts', 'services'],
  ['.module.ts', 'modules'],
  ['.repository.ts', 'repositories'],
  ['.entity.ts', 'entities'],
  ['.schema.ts', 'schemas'],
  ['.dto.ts', 'dtos'],
  ['.guard.ts', 'guards'],
  ['.strategy.ts', 'strategies'],
  ['.interceptor.ts', 'interceptors'],
  ['.pipe.ts', 'pipes'],
  ['.filter.ts', 'filters'],
  ['.middleware.ts', 'middleware'],
  ['.decorator.ts', 'decorators'],
  ['.policy.ts', 'policies'],
  ['.gateway.ts', 'gateways'],
  ['.resolver.ts', 'resolvers'],
  ['.processor.ts', 'processors'],
  ['.listener.ts', 'listeners'],
  ['.handler.ts', 'handlers'],
  ['.event.ts', 'events'],
];

const HTTP_DECORATORS = { Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Delete: 'DELETE', All: 'ALL' };
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// A handler (or the service method it calls) with one of these is not built yet.
// `This action ...` is the text `nest g resource` writes.
const STUB_MARKERS = /NotImplementedException|This action (?:adds|returns|updates|removes)\b|throw new Error\(\s*['"`]not implemented/i;

// Packages worth knowing about when picking a lesson.
const KNOWN_PACKAGES = [
  '@nestjs/authentication', '@nestjs/authorization', '@nestjs/bullmq', '@nestjs/cache-manager',
  '@nestjs/config', '@nestjs/cqrs', '@nestjs/drizzle', '@nestjs/event-emitter', '@nestjs/idempotency',
  '@nestjs/jwt', '@nestjs/microservices', '@nestjs/mongoose', '@nestjs/outbox', '@nestjs/passport',
  '@nestjs/platform-express', '@nestjs/platform-fastify', '@nestjs/resilience', '@nestjs/schedule',
  '@nestjs/swagger', '@nestjs/terminus', '@nestjs/throttler', '@nestjs/typeorm', '@prisma/client',
  'argon2', 'bcrypt', 'class-transformer', 'class-validator', 'drizzle-orm', 'helmet', 'ioredis',
  'joi', 'nestjs-cls', 'nestjs-pino', 'passport-jwt', 'pg', 'prisma', 'supertest', 'typeorm', 'vitest', 'zod',
];

function log(msg) {
  process.stderr.write(`[scan] ${msg}\n`);
}

function toPosix(p) {
  return p.split(sep).join('/');
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function readJson(path) {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    log(`bad JSON in ${path}: ${error.message}`);
    return null;
  }
}

function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function sortedObject(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((key) => [key, obj[key]]));
}

function snakeCase(name) {
  return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ---------- config and app ----------

function loadConfig(root, configPath) {
  const path = configPath ?? join(root, 'learn', 'learn.config.json');
  if (configPath) {
    const config = readJson(path);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      log(`cannot read config object: ${path}`);
      process.exit(2);
    }
    return config;
  }
  if (!existsSync(path)) return null;
  return readJson(path);
}

function allDeps(pkg) {
  return { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
}

function isNestPackage(pkg) {
  return Boolean(allDeps(pkg)['@nestjs/core']);
}

// The folder with a NestJS package.json. Config wins; else try common places.
function findAppPath(root, config) {
  if (config?.appPath) return config.appPath;
  for (const candidate of ['.', 'apps/api', 'api', 'backend', 'server']) {
    if (isNestPackage(readJson(join(root, candidate, 'package.json')))) return candidate;
  }
  return '.';
}

function detectStack(root, appDir, config, pkg) {
  const deps = allDeps(pkg);
  const workspace = readJson(join(root, 'package.json'));
  const tooling = { ...allDeps(workspace), ...deps };
  const lockAt = (name) => existsSync(join(appDir, name)) || existsSync(join(root, name));
  let packageManager = config?.packageManager ?? null;
  const declared = pkg?.packageManager ?? workspace?.packageManager;
  if (!packageManager && typeof declared === 'string') {
    packageManager = declared.match(/^(npm|pnpm|yarn|bun)(?:@|$)/)?.[1] ?? null;
  }
  if (!packageManager) {
    if (lockAt('bun.lock') || lockAt('bun.lockb')) packageManager = 'bun';
    else if (lockAt('pnpm-lock.yaml')) packageManager = 'pnpm';
    else if (lockAt('yarn.lock')) packageManager = 'yarn';
    else if (lockAt('package-lock.json')) packageManager = 'npm';
  }
  let orm = config?.orm ?? null;
  if (!orm) {
    if (deps['@prisma/client'] || deps.prisma) orm = 'prisma';
    else if (deps['drizzle-orm']) orm = 'drizzle';
    else if (deps['@mikro-orm/core']) orm = 'mikro-orm';
    else if (deps.typeorm || deps['@nestjs/typeorm']) orm = 'typeorm';
    else if (deps.mongoose || deps['@nestjs/mongoose']) orm = 'mongoose';
    else orm = 'none';
  }
  const installed = readJson(join(appDir, 'node_modules', '@nestjs', 'core', 'package.json'))?.version ?? null;
  const testScript = pkg?.scripts?.test ?? workspace?.scripts?.test ?? '';
  const testRunner = config?.testRunner
    ?? (/\bvitest\b/.test(testScript) ? 'vitest'
      : /\bjest\b/.test(testScript) ? 'jest'
        : /\bbun\s+test\b/.test(testScript) ? 'bun'
          : /\bnode\s+--test\b/.test(testScript) ? 'node'
            : tooling.vitest ? 'vitest' : tooling.jest ? 'jest' : null);
  return {
    nestVersion: deps['@nestjs/core'] ?? null,
    nestInstalled: installed,
    packageManager,
    orm,
    platform: deps['@nestjs/platform-fastify'] ? 'fastify' : 'express',
    testRunner,
    nodeModulesInstalled: isDir(join(appDir, 'node_modules')),
    packages: KNOWN_PACKAGES.filter((name) => deps[name]),
    scripts: Object.keys(pkg?.scripts ?? {}).sort(),
  };
}

// ---------- small TypeScript reader ----------

// Index just after the bracket that closes the one at `start`. Skips strings and comments.
function matchClose(text, start) {
  const open = text[start];
  const close = { '(': ')', '{': '}', '[': ']' }[open];
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i);
      if (i === -1) return text.length;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) return text.length;
      i += 1;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      for (i += 1; i < text.length && text[i] !== ch; i += 1) if (text[i] === '\\') i += 1;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

// From the start of a method's parameter list `(`, find its body `{ ... }`.
function methodBody(text, parenStart) {
  let i = matchClose(text, parenStart);
  while (/\s/.test(text[i] ?? '')) i += 1;
  if (text[i] === ':') {
    i += 1;
    let angle = 0;
    let typeStarted = false;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '<') angle += 1;
      else if (ch === '>' && text[i - 1] !== '=') angle -= 1;
      else if (ch === '{' && angle === 0) {
        if (!typeStarted) {
          i = matchClose(text, i) - 1;
          typeStarted = true;
          continue;
        }
        break;
      } else if (ch === ';') return null;
      if (!/\s/.test(ch)) typeStarted = true;
    }
  }
  if (text[i] !== '{') return null;
  return text.slice(i, matchClose(text, i));
}

// First string literal in an argument text, or null.
function firstString(args) {
  return args?.match(/^\s*['"`]([^'"`]*)['"`]/)?.[1] ?? null;
}

function propString(args, key) {
  return args?.match(new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]*)['"\`]`))?.[1] ?? null;
}

// Class name -> { methodName: body } for every exported class with methods.
function indexClasses(tsFiles) {
  const index = {};
  for (const file of tsFiles) {
    const text = readText(file) ?? '';
    for (const cls of text.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)[^{]*\{/g)) {
      const open = cls.index + cls[0].length - 1;
      const classBody = text.slice(open, matchClose(text, open));
      const methods = {};
      for (const m of classBody.matchAll(/^\s*(?:(?:public|private|protected|async|static)\s+)*(\w+)\s*\(/gm)) {
        if (['if', 'for', 'while', 'switch', 'catch', 'return', 'constructor'].includes(m[1])) continue;
        const paren = m.index + m[0].length - 1;
        const body = methodBody(classBody, paren);
        if (body) methods[m[1]] ??= body;
      }
      index[cls[1]] = { methods, constructorTypes: constructorTypes(classBody) };
    }
  }
  return index;
}

// `constructor(private readonly users: UsersService)` -> { users: 'UsersService' }
function constructorTypes(classBody) {
  const start = classBody.search(/constructor\s*\(/);
  if (start === -1) return {};
  const paren = classBody.indexOf('(', start);
  const params = classBody.slice(paren + 1, matchClose(classBody, paren) - 1);
  const out = {};
  for (const m of params.matchAll(/(?:private|public|protected)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g)) out[m[1]] = m[2];
  return out;
}

// ---------- features and classes ----------

// Which feature owns a file: the first folder under sourceRoot, or the one after `modules/`.
function featureOf(srcDir, file) {
  const parts = toPosix(relative(srcDir, file)).split('/');
  if (parts[0].startsWith('..') || parts.length === 1) return 'app';
  if (['modules', 'features', 'domains', 'contexts'].includes(parts[0]) && parts.length > 2) return parts[1];
  return parts[0];
}

function scanClasses(srcDir, tsFiles) {
  const byFeature = {};
  for (const file of tsFiles) {
    const name = file.split(sep).pop();
    if (testKind(name)) continue;
    const kind = CLASS_KINDS.find(([suffix]) => name.endsWith(suffix));
    if (!kind) continue;
    const feature = featureOf(srcDir, file);
    byFeature[feature] ??= {};
    byFeature[feature][kind[1]] ??= [];
    byFeature[feature][kind[1]].push(name.slice(0, -kind[0].length));
  }
  for (const feature of Object.keys(byFeature)) {
    for (const kind of Object.keys(byFeature[feature])) byFeature[feature][kind].sort();
    byFeature[feature] = sortedObject(byFeature[feature]);
  }
  return sortedObject(byFeature);
}

// ---------- routes ----------

function readBootstrap(srcDir) {
  const text = readText(join(srcDir, 'main.ts')) ?? '';
  const prefixArgs = text.match(/setGlobalPrefix\(([^)]*)\)/)?.[1];
  const versioning = text.match(/enableVersioning\(([\s\S]*?)\)\s*;/);
  const vArgs = versioning?.[1] ?? '';
  const uri = Boolean(versioning) && (!/type\s*:/.test(vArgs) || /VersioningType\.URI/.test(vArgs));
  return {
    globalPrefix: firstString(prefixArgs) ?? '',
    versioning: versioning ? (uri ? 'uri' : 'other') : null,
    defaultVersion: propString(vArgs, 'defaultVersion'),
    versionPrefix: propString(vArgs, 'prefix') ?? 'v',
  };
}

function joinPath(...parts) {
  return parts.map((p) => (p ?? '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

function scanRoutes(root, tsFiles, classIndex, boot) {
  const routes = [];
  for (const file of tsFiles) {
    if (!file.endsWith('.ts') || testKind(file)) continue;
    const text = readText(file) ?? '';
    const ctrl = text.match(/@Controller\(([^)]*)\)\s*(?:@[\s\S]*?)?export\s+class\s+(\w+)/);
    if (!ctrl) continue;
    const ctrlArgs = ctrl[1];
    const ctrlPath = firstString(ctrlArgs) ?? propString(ctrlArgs, 'path') ?? '';
    const ctrlVersion = propString(ctrlArgs, 'version');
    const ctrlName = ctrl[2];
    const deps = classIndex[ctrlName]?.constructorTypes ?? {};

    for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|All)\(([^)]*)\)/g)) {
      if (m.index < ctrl.index) continue;
      const after = text.slice(m.index + m[0].length);
      const head = after.match(/^(?:\s*@[\w.]+(?:\((?:[^()]|\([^()]*\))*\))?)*\s*(?:(?:public|async)\s+)*(\w+)\s*\(/);
      if (!head) continue;
      // Decorators above the route decorator too, back to the end of the last statement.
      const before = text.slice(0, m.index);
      const stackStart = Math.max(before.lastIndexOf(';'), before.lastIndexOf('}'), before.lastIndexOf('{')) + 1;
      const decorators = text.slice(stackStart, m.index + m[0].length + head.index + head[0].length);
      const methodVersion = decorators.match(/@Version\(\s*['"`]([^'"`]+)/)?.[1] ?? null;
      const version = boot.versioning === 'uri' ? (methodVersion ?? ctrlVersion ?? boot.defaultVersion) : null;
      const body = methodBody(after, head.index + head[0].length - 1) ?? '';

      let stub = STUB_MARKERS.test(body);
      const call = body.match(/this\.(\w+)\.(\w+)\(/);
      if (!stub && call) {
        const target = classIndex[deps[call[1]]]?.methods[call[2]];
        if (target && STUB_MARKERS.test(target)) stub = true;
      }

      routes.push({
        method: HTTP_DECORATORS[m[1]],
        path: `/${joinPath(boot.globalPrefix, version ? `${boot.versionPrefix}${version}` : '', ctrlPath, firstString(m[2]) ?? '')}`,
        handler: `${ctrlName}.${head[1]}`,
        file: `${toPosix(relative(root, file))}:${lineOf(text, m.index)}`,
        stub,
      });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

// ---------- scope doc ----------

function parseDoc(text) {
  const endpoints = [];
  const buildOrder = [];
  const planTasks = [];
  let section = null;
  let inBuildOrder = false;
  let fence = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      section = heading[1].trim();
      inBuildOrder = /build order/i.test(section);
      continue;
    }

    const task = line.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (task) {
      const identified = task[2].match(/^(?:\*\*|`)?([A-Za-z][\w]*-\d+|#\d+)(?:\*\*|`)?\s+(.+)$/);
      planTasks.push({ id: identified?.[1] ?? null, title: identified?.[2] ?? task[2], done: task[1].toLowerCase() === 'x', section });
      continue;
    }

    if (inBuildOrder) {
      const item = line.match(/^(\d+)[.)]\s+(.*)$/);
      if (item) buildOrder.push({ step: Number(item[1]), title: item[2].trim() });
      continue;
    }

    // Table row: | GET | `/api/v1/me` | user | Does ... |
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 2 && HTTP_METHODS.includes(cells[0].toUpperCase())) {
        endpoints.push({
          section,
          method: cells[0].toUpperCase(),
          path: cells[1].replace(/`/g, '').trim(),
          auth: cells[2] ?? null,
          does: cells[3] ?? null,
        });
      } else {
        // Requirement tables can put several `METHOD /path` pairs in a prose cell.
        for (const m of line.matchAll(/`(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s`|]*)`/g)) {
          endpoints.push({ section, method: m[1], path: m[2], auth: null, does: cells[1] ?? null });
        }
      }
      continue;
    }

    // Plain line: GET /api/v1/me or - `POST /api/v1/posts`
    const plain = line.match(/^[-*]?\s*`?(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s`]*)`?/);
    if (plain) endpoints.push({ section, method: plain[1], path: plain[2], auth: null, does: null });
  }
  return { endpoints, buildOrder, planTasks };
}

function uniqueEndpoints(endpoints) {
  const seen = new Set();
  return endpoints.filter((endpoint) => {
    const key = `${endpoint.method} ${normalizePath(endpoint.path)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// `/api/v1/users/{id}` and `api/v1/users/:id` are the same path.
function normalizePath(path) {
  return path.toLowerCase().replace(/^\/+|\/+$/g, '').replace(/\{[^}]+\}|:\w+/g, '{}');
}

function matchEndpoints(endpoints, routes, tailMatch) {
  const done = [];
  const stubs = [];
  const missing = [];
  for (const endpoint of endpoints) {
    const docPath = normalizePath(endpoint.path);
    const route = routes.find((r) => {
      if (r.method !== endpoint.method && r.method !== 'ALL') return false;
      const routePath = normalizePath(r.path);
      if (routePath === docPath) return true;
      // RouterModule prefixes are not read, so match on the tail.
      return tailMatch && routePath !== '' && docPath.endsWith(`/${routePath}`);
    });
    const row = { section: endpoint.section, method: endpoint.method, path: endpoint.path };
    if (!route) missing.push(row);
    else if (route.stub) stubs.push({ ...row, handler: route.handler, file: route.file });
    else done.push({ ...row, handler: route.handler });
  }
  return { done, stubs, missing };
}

// ---------- data: tables and migrations ----------

function scanData(root, appDir, tsFiles, allFiles) {
  const rel = (f) => toPosix(relative(root, f));
  const tables = [];

  for (const file of tsFiles) {
    const text = readText(file) ?? '';
    for (const m of text.matchAll(/@Entity\(([^)]*)\)\s*(?:@[\s\S]*?)?export\s+class\s+(\w+)/g)) {
      // No name given: TypeORM and MikroORM default to the class name in snake_case (`UserProfile` -> `user_profile`).
      const named = firstString(m[1]) ?? propString(m[1], 'name');
      tables.push({ name: named ?? snakeCase(m[2]), source: 'entity', file: rel(file) });
    }
    for (const m of text.matchAll(/\b(?:pg|mysql|sqlite)Table\(\s*['"`](\w+)['"`]/g)) {
      tables.push({ name: m[1], source: 'drizzle', file: rel(file) });
    }
  }

  for (const file of allFiles.filter((f) => f.endsWith('.prisma'))) {
    const text = readText(file) ?? '';
    for (const m of text.matchAll(/^model\s+(\w+)\s*\{/gm)) {
      const block = text.slice(m.index, matchClose(text, text.indexOf('{', m.index)));
      tables.push({ name: block.match(/@@map\(\s*"([^"]+)"/)?.[1] ?? m[1], source: 'prisma', file: rel(file) });
    }
  }

  const migrations = [];
  for (const file of tsFiles) {
    if (/implements\s+MigrationInterface/.test(readText(file) ?? '')) migrations.push(rel(file));
  }
  for (const file of allFiles.filter((f) => f.endsWith('.sql'))) {
    if (/(^|\/)(migrations|drizzle)\//.test(toPosix(relative(appDir, file)))) migrations.push(rel(file));
  }

  tables.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
  return { tables, migrations: [...new Set(migrations)].sort() };
}

// ---------- tests ----------

function testKind(file) {
  if (/\.e2e[-.](?:spec|test)\.[cm]?[jt]sx?$/.test(file)) return 'e2e';
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file) ? 'unit' : null;
}

function scanTests(root, srcDir, allFiles) {
  const out = { unit: { files: [], testCalls: 0 }, e2e: { files: [], testCalls: 0 } };
  for (const file of allFiles) {
    const name = file.split(sep).pop();
    const kind = testKind(name);
    if (!kind) continue;
    const text = readText(file) ?? '';
    out[kind].files.push(toPosix(relative(root, file)));
    out[kind].testCalls += (text.match(/(?<![\w.])(?:it|test)(?:\.each\([^)]*\))?\(\s*['"`]/g) ?? []).length;
  }
  out.unit.files.sort();
  out.e2e.files.sort();
  out.unit.onlyDefault = out.unit.files.every((f) => f.endsWith('app.controller.spec.ts'));
  return out;
}

// ---------- best-practice hints ----------

// Each check maps to a nestjs-best-practices rule file. These are hints from text search:
// confirm by reading the file before you offer a lesson.
function scanPractices(root, srcDir, tsFiles, stack, data, tests) {
  const sources = tsFiles
    .filter((f) => !testKind(f))
    .map((f) => ({ file: toPosix(relative(root, f)), text: readText(f) ?? '' }));
  const find = (regex, limit = 3) => {
    const hits = [];
    for (const { file, text } of sources) {
      for (const m of text.matchAll(new RegExp(regex.source, `${regex.flags.replace('g', '')}g`))) {
        hits.push(`${file}:${lineOf(text, m.index)}`);
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  };
  // Every call that matches `callee` (ending in `(`), with the text of its arguments.
  // Arguments passed as a variable (`new ValidationPipe(options)`) use that variable's object
  // from the same file, or the whole file when it is defined elsewhere.
  const calls = (callee) => {
    const out = [];
    for (const { file, text } of sources) {
      for (const m of text.matchAll(new RegExp(callee.source, 'g'))) {
        const paren = m.index + m[0].length - 1;
        let args = text.slice(paren + 1, matchClose(text, paren) - 1);
        const variable = args.match(/^\s*(\w+)\s*$/)?.[1];
        if (variable) {
          const def = text.match(new RegExp(`(?:const|let|var)\\s+${variable}\\b[^=]*=\\s*\\{`));
          args = def ? text.slice(def.index, matchClose(text, def.index + def[0].length - 1)) : text;
        }
        out.push({ at: `${file}:${lineOf(text, m.index)}`, args });
      }
    }
    return out;
  };
  const pkg = (name) => stack.packages.includes(name);
  const checks = [];
  const add = (id, rule, status, evidence = [], note = null) => checks.push({ id, rule, status, evidence, note });

  const pipes = calls(/new ValidationPipe\(/);
  const pipeAt = pipes.map((c) => c.at).slice(0, 3);
  if (!pipes.length) add('validation-pipe', 'security-validate-all-input', 'missing');
  else if (!pipes.some((c) => /whitelist\s*:\s*true/.test(c.args))) add('validation-pipe', 'security-validate-all-input', 'problem', pipeAt, 'ValidationPipe without whitelist: true');
  else add('validation-pipe', 'security-validate-all-input', 'ok', pipeAt);

  const hooks = find(/enableShutdownHooks\(/);
  add('shutdown-hooks', 'devops-graceful-shutdown', hooks.length ? 'ok' : 'missing', hooks);

  const headers = find(/useSecurityHeaders\(|helmet\(/);
  add('security-headers', 'security-headers-cors-csrf', headers.length ? 'ok' : 'missing', headers);

  const openCors = find(/enableCors\(\s*\)|cors\s*:\s*true/);
  const cors = find(/enableCors\(/);
  if (openCors.length) add('cors', 'security-headers-cors-csrf', 'problem', openCors, 'CORS allows every origin');
  else add('cors', 'security-headers-cors-csrf', cors.length ? 'ok' : 'n/a', cors,
    cors.length ? null : 'No CORS setup found. Keep it disabled unless browser clients need cross-origin access; confirm the project policy.');

  const configCalls = calls(/ConfigModule\.forRoot(?:Async)?\(/);
  const configAt = configCalls.map((c) => c.at).slice(0, 3);
  if (!configCalls.length) add('config-validation', 'devops-use-config-module', 'missing');
  else if (!configCalls.some((c) => /\b(?:validate|validationSchema)\b/.test(c.args))) add('config-validation', 'devops-use-config-module', 'problem', configAt, 'ConfigModule without validation');
  else add('config-validation', 'devops-use-config-module', 'ok', configAt);

  const rawEnv = sources
    .filter(({ file }) => !/config|main\.ts$/i.test(file))
    .flatMap(({ file, text }) => [...text.matchAll(/process\.env\.\w+/g)].map((m) => `${file}:${lineOf(text, m.index)}`))
    .slice(0, 3);
  if (rawEnv.length) add('raw-process-env', 'devops-use-config-module', 'problem', rawEnv, 'process.env read outside config');

  const health = find(/HealthCheckService|HealthCheck\(/);
  add('health-checks', 'micro-use-health-checks', health.length || pkg('@nestjs/terminus') ? 'ok' : 'missing', health);

  const throttler = find(/ThrottlerModule\.forRoot/);
  add('rate-limiting', 'security-rate-limiting', throttler.length ? 'ok' : 'missing', throttler);

  const filter = find(/APP_FILTER|useGlobalFilters\(|@Catch\(/);
  add('exception-filter', 'error-use-exception-filters', filter.length ? 'ok' : 'missing', filter);

  const sync = find(/synchronize\s*:\s*true/);
  if (sync.length) add('migrations', 'db-use-migrations', 'problem', sync, 'synchronize: true changes the schema without a migration');
  else if (stack.orm === 'none' || stack.orm === 'mongoose') add('migrations', 'db-use-migrations', 'n/a');
  else add('migrations', 'db-use-migrations', data.migrations.length ? 'ok' : 'missing', data.migrations.slice(0, 3));

  const consoleLog = find(/console\.(?:log|error|warn)\(/);
  add('logger', 'devops-use-logging', consoleLog.length ? 'problem' : 'ok', consoleLog, consoleLog.length ? 'console.* instead of Logger' : null);

  add('unit-tests', 'test-use-testing-module', tests.unit.onlyDefault ? 'missing' : 'ok', tests.unit.files.slice(0, 3));
  add('e2e-tests', 'test-e2e-supertest', tests.e2e.files.length ? 'ok' : 'missing', tests.e2e.files.slice(0, 3));

  return checks.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------- lessons ----------

function frontmatter(text) {
  const match = text?.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) data[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, '');
  }
  return data;
}

function firstHeading(text) {
  return text?.match(/^#\s+(.+)$/m)?.[1].trim() ?? null;
}

function scanLessons(root) {
  const dir = join(root, 'learn');
  if (!isDir(dir)) return [];
  const lessons = [];
  for (const name of readdirSync(dir).sort()) {
    const match = name.match(/^(\d{2,})-(.+)$/);
    if (!match || !isDir(join(dir, name))) continue;
    const ticket = readText(join(dir, name, 'TICKET.md'));
    const readme = readText(join(dir, name, 'README.md'));
    const meta = frontmatter(ticket);
    lessons.push({
      number: Number(match[1]),
      slug: match[2],
      folder: `learn/${name}`,
      id: meta.id ?? null,
      status: meta.status ?? 'unknown',
      kind: meta.kind ?? null,
      branch: meta.branch ?? null,
      title: firstHeading(ticket) ?? firstHeading(readme),
      files: ['TICKET.md', 'README.md', 'GUIDE.md', 'check-yourself.md'].filter((f) => existsSync(join(dir, name, f))),
    });
  }
  return lessons;
}

// ---------- quality sources ----------

function markdownIn(dir) {
  return walk(dir).filter((f) => f.endsWith('.md')).sort();
}

function scanQualitySources(root, appDir, config, home) {
  const show = (path) => {
    const rel = relative(root, path);
    return toPosix(rel.startsWith('..') || isAbsolute(rel) ? path : rel);
  };
  const bases = [...new Set([root, appDir])];
  const existing = (paths) => [...new Set(paths)].filter((p) => existsSync(p));

  const rulesDirs = config?.rulesDirs
    ? config.rulesDirs.map((p) => join(root, p))
    : existing(bases.flatMap((b) => [join(b, '.claude', 'rules'), join(b, '.cursor', 'rules'), join(b, '.ai', 'rules')]));
  const rules = rulesDirs.flatMap((dir) => markdownIn(dir).map((file) => ({ path: show(file), title: firstHeading(readText(file)) })));

  const skillsDirs = config?.skillsDirs
    ? config.skillsDirs.map((p) => (isAbsolute(p) ? p : join(root, p)))
    : [...bases.flatMap((b) => [join(b, '.claude', 'skills'), join(b, '.agents', 'skills')]),
      join(home, '.claude', 'skills'), join(home, '.agents', 'skills')];
  let bestPractices = null;
  for (const dir of [...new Set(skillsDirs)]) {
    const skillDir = join(dir, 'nestjs-best-practices');
    const skillText = readText(join(skillDir, 'SKILL.md'));
    if (!skillText) continue;
    const ruleFiles = isDir(join(skillDir, 'rules'))
      ? readdirSync(join(skillDir, 'rules')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort()
      : [];
    bestPractices = {
      path: show(skillDir),
      version: skillText.match(/version:\s*"?([\d.]+)/)?.[1] ?? null,
      ruleCount: ruleFiles.length,
    };
    break;
  }

  const guidelineFiles = config?.guidelines
    ? config.guidelines.map((p) => join(root, p))
    : bases.flatMap((b) => [join(b, 'CLAUDE.md'), join(b, 'AGENTS.md')]);
  const guidelines = existing(guidelineFiles).map(show).sort();

  const docsPath = config?.nestDocsPath ?? null;
  const nestDocs = docsPath
    ? { path: toPosix(docsPath), exists: isDir(join(isAbsolute(docsPath) ? docsPath : join(root, docsPath), 'content')) }
    : null;

  return { rules, bestPractices, guidelines, nestDocs };
}

// ---------- git ----------

function scanGit(root) {
  const run = (args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 15_000 });
  const inside = run(['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0) {
    if (inside.error || inside.status === null || existsSync(join(root, '.git'))) {
      return { branch: null, hasCommits: null, changedFiles: null, error: 'Git inspection unavailable; check executable access, repository permissions, and safe-directory settings.' };
    }
    return null;
  }
  const head = run(['rev-parse', '--verify', '--quiet', 'HEAD']);
  const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = run(['status', '--porcelain']);
  return {
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    hasCommits: head.status === 0,
    changedFiles: status.stdout.split('\n').filter(Boolean).length,
  };
}

// ---------- merged lessons ----------

// Merged PRs as [{ number, headRefName }], or null when unknown.
// Remote branches are often deleted after merge, so ask GitHub, not git.
function loadMergedPrs(root, args) {
  const file = args.find((a) => a.startsWith('--merged-prs='));
  if (file) return JSON.parse(readFileSync(file.slice('--merged-prs='.length), 'utf8'));
  if (args.includes('--no-gh')) return null;
  const result = spawnSync('gh', ['pr', 'list', '--state', 'merged', '--limit', '200', '--json', 'number,headRefName'], {
    cwd: root, encoding: 'utf8', timeout: 20_000, shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    log('gh pr list failed; merged-lesson check skipped');
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

// A lesson that is not done but whose branch is merged: its status is stale.
// Match the ticket's `branch:` exactly, else a head branch named after the slug.
function markMerged(lessons, mergedPrs) {
  for (const lesson of lessons) {
    lesson.mergedPr = null;
    if (!mergedPrs || lesson.status === 'done' || lesson.status === 'dropped') continue;
    const pr = mergedPrs.find((p) => (lesson.branch
      ? p.headRefName === lesson.branch
      : p.headRefName === lesson.slug || p.headRefName.endsWith(`/${lesson.slug}`)));
    if (pr) lesson.mergedPr = { number: pr.number, branch: pr.headRefName };
  }
}

// ---------- main ----------

function main() {
  const args = process.argv.slice(2);
  const root = resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
  const homeArg = args.find((a) => a.startsWith('--home='));
  const home = homeArg ? resolve(homeArg.slice('--home='.length)) : homedir();
  const blockers = [];

  if (!isDir(root)) {
    log(`not a folder: ${root}`);
    process.exit(2);
  }

  const configArg = args.find((a) => a.startsWith('--config='));
  const config = loadConfig(root, configArg ? resolve(configArg.slice('--config='.length)) : null);
  if (!config) blockers.push('no_config');

  const git = scanGit(root);
  if (!git) blockers.push('no_git');
  else if (git.error) blockers.push('git_unavailable');
  else if (!git.hasCommits) blockers.push('no_commits');

  const appPath = findAppPath(root, config);
  const appDir = join(root, appPath);
  const pkg = readJson(join(appDir, 'package.json'));
  const nestApp = isNestPackage(pkg);
  if (!nestApp) blockers.push('no_nest_app');

  const nestCli = readJson(join(appDir, 'nest-cli.json'));
  const sourceRoot = config?.sourceRoot ?? nestCli?.sourceRoot ?? 'src';
  const srcDir = join(appDir, sourceRoot);
  const stack = nestApp ? detectStack(root, appDir, config, pkg) : null;

  log(`scanning ${appDir}`);
  const allFiles = nestApp ? walk(appDir).sort() : [];
  const tsFiles = allFiles.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  const srcFiles = tsFiles.filter((f) => !relative(srcDir, f).startsWith('..'));

  const classIndex = indexClasses(srcFiles.filter((file) => !testKind(file)));
  const boot = readBootstrap(srcDir);
  const routes = nestApp ? scanRoutes(root, srcFiles, classIndex, boot) : [];
  const routerModule = srcFiles.some((f) => /RouterModule\.register\(/.test(readText(f) ?? ''));
  if (routerModule) blockers.push('router_module_prefixes');

  const docPath = config?.buildOrderDoc ?? null;
  const docText = docPath ? readText(join(root, docPath)) : null;
  if (!docText) blockers.push('no_build_order_doc');
  const doc = docText ? parseDoc(docText) : { endpoints: [], buildOrder: [], planTasks: [] };
  const endpointDocPaths = config?.endpointDocs ?? [];
  for (const path of endpointDocPaths) {
    if (path === docPath) continue;
    const text = readText(join(root, path));
    if (text === null) {
      log(`endpoint doc not readable: ${path}`);
      blockers.push('no_endpoint_doc');
      continue;
    }
    doc.endpoints.push(...parseDoc(text).endpoints);
  }
  doc.endpoints = uniqueEndpoints(doc.endpoints);
  const endpoints = matchEndpoints(doc.endpoints, routes, routerModule);

  const data = scanData(root, appDir, srcFiles, allFiles);
  const tests = scanTests(root, srcDir, allFiles);
  const practices = nestApp ? scanPractices(root, srcDir, srcFiles, stack, data, tests) : [];
  const lessons = scanLessons(root);
  markMerged(lessons, loadMergedPrs(root, args));
  const qualitySources = scanQualitySources(root, appDir, config, home);
  if (!qualitySources.bestPractices) blockers.push('no_best_practices_skill');

  const output = {
    root: toPosix(root),
    config,
    blockers,
    git,
    app: { path: appPath, sourceRoot, nestApp, ...boot },
    stack,
    routes,
    tables: data.tables,
    migrations: data.migrations,
    classes: scanClasses(srcDir, srcFiles),
    tests,
    practices,
    buildOrderDoc: docPath,
    buildOrder: doc.buildOrder,
    planTasks: doc.planTasks,
    endpoints,
    lessons,
    qualitySources,
    summary: {
      routes: routes.length,
      stubRoutes: routes.filter((r) => r.stub).length,
      tables: data.tables.length,
      docEndpoints: doc.endpoints.length,
      endpointsDone: endpoints.done.length,
      endpointsStub: endpoints.stubs.length,
      endpointsMissing: endpoints.missing.length,
      practicesMissing: practices.filter((p) => p.status === 'missing').map((p) => p.id),
      practicesProblems: practices.filter((p) => p.status === 'problem').map((p) => p.id),
      lessons: lessons.length,
      lessonsInProgress: lessons.filter((l) => l.status === 'in-progress').length,
      staleLessons: lessons.filter((l) => l.mergedPr).map((l) => l.number),
      nextLessonNumber: lessons.reduce((max, l) => Math.max(max, l.number), 0) + 1,
    },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  log(`done: ${routes.length} routes, ${output.summary.endpointsMissing} missing, ${output.summary.endpointsStub} stub, ${output.summary.practicesMissing.length + output.summary.practicesProblems.length} practice hints`);
}

main();
