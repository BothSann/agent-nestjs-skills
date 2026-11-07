#!/usr/bin/env node
// Read-only lesson tools for nestjs-learn. Node built-ins only.
//
// scan REPO [--no-gh]        Compact project state for choosing a lesson.
// step GUIDE N               Print one guide step, so the rest stays unread.
// guide-size GUIDE           Fail when a guide exceeds the step or token limits.
// cleanup REPO [--abandoned SLUG] [--dry-run] [--no-gh]
//                            Remove reference worktrees of merged or abandoned lessons.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, rmdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'learn', '.turbo', '.next', '.cache', 'tmp']);
const OLD_FIELDS = ['appPath', 'buildOrderDoc', 'endpointDocs', 'sourceRoot', 'rulesDirs', 'skillsDirs', 'guidelines', 'nestDocsPath',
  'packageManager', 'testRunner', 'orm', 'migrationCommand', 'databaseUrlEnv', 'generator', 'ticketPrefix'];
const DECORATORS = { Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Delete: 'DELETE', All: 'ALL' };
// `This action ...` is the text `nest g resource` writes.
const STUB = /NotImplementedException|This action (?:adds|returns|updates|removes)\b|throw new Error\(\s*['"`]not implemented/i;
const DOC_ROUTE = /\b(GET|POST|PUT|PATCH|DELETE)\b[`\s|]+`?(\/[^\s`|]*)/g;
const STEP = /^## Step (\d+)\b/gm;
const MAX_STEPS = 6;
const MAX_GUIDE_TOKENS = 4000;
const CHARS_PER_TOKEN = 3.5; // Conservative estimate; Node has no tokenizer built in.

const defaultIo = { out: (line) => console.log(line), err: (line) => console.error(line) };

export function run(args, cwd) {
  const done = spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8', timeout: 20_000, windowsHide: true });
  if (done.error) return [127, String(done.error.message)];
  return [done.status ?? 1, `${done.stdout ?? ''}${done.stderr ?? ''}`.trim()];
}

const readText = (path) => readFileSync(path, 'utf8').replace(/^﻿/, '');
const toPosix = (path) => path.split(sep).join('/');
const isDir = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };
const isFile = (path) => { try { return statSync(path).isFile(); } catch { return false; } };

function readJson(path) {
  try { return JSON.parse(readText(path)); } catch { return null; }
}

function deps(pkg) {
  return { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
}

function walk(dir, depth = Infinity, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && depth > 0) walk(path, depth - 1, out);
    } else if (entry.isFile()) out.push(path);
  }
  return out;
}

function findApps(repo) {
  return walk(repo, 3)
    .filter((file) => basename(file) === 'package.json' && deps(readJson(file))['@nestjs/core'])
    .map(dirname);
}

// ---------- a small TypeScript reader ----------

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
    } else if (ch === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) return text.length;
      i += 1;
    } else if (ch === '\'' || ch === '"' || ch === '`') {
      for (i += 1; i < text.length && text[i] !== ch; i += 1) if (text[i] === '\\') i += 1;
    } else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

// From a method's parameter list `(`, find its body `{ ... }`, skipping a return type.
function methodBody(text, parenStart) {
  let i = matchClose(text, parenStart);
  while (/\s/.test(text[i] ?? '')) i += 1;
  if (text[i] === ':') {
    let angle = 0;
    let started = false;
    for (i += 1; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '<') angle += 1;
      else if (ch === '>' && text[i - 1] !== '=') angle -= 1;
      else if (ch === ';') return null;
      else if (ch === '{' && angle === 0) {
        if (started) break;
        i = matchClose(text, i) - 1; // An object return type: `{ id: string }`.
        started = true;
        continue;
      }
      if (!/\s/.test(ch)) started = true;
    }
  }
  return text[i] === '{' ? text.slice(i, matchClose(text, i)) : null;
}

const firstString = (args) => args?.match(/^\s*['"`]([^'"`]*)['"`]/)?.[1] ?? null;
const propString = (args, key) => args?.match(new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]*)['"\`]`))?.[1] ?? null;
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const isTest = (file) => /\.(?:e2e-)?(?:spec|test)\.[cm]?ts$/.test(file);

// Class name -> { methods: { name: body }, injected: { field: Type } }.
function indexClasses(files) {
  const index = {};
  for (const { text } of files) {
    for (const cls of text.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)[^{]*\{/g)) {
      const open = cls.index + cls[0].length - 1;
      const body = text.slice(open, matchClose(text, open));
      const methods = {};
      for (const m of body.matchAll(/^\s*(?:(?:public|private|protected|async|static)\s+)*(\w+)\s*\(/gm)) {
        if (['if', 'for', 'while', 'switch', 'catch', 'return', 'constructor'].includes(m[1])) continue;
        const found = methodBody(body, m.index + m[0].length - 1);
        if (found) methods[m[1]] ??= found;
      }
      const injected = {};
      const ctor = body.search(/constructor\s*\(/);
      if (ctor !== -1) {
        const paren = body.indexOf('(', ctor);
        const params = body.slice(paren + 1, matchClose(body, paren) - 1);
        for (const p of params.matchAll(/(?:private|public|protected)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g)) injected[p[1]] = p[2];
      }
      index[cls[1]] = { methods, injected };
    }
  }
  return index;
}

// Prefix and versioning usually sit in main.ts, but may move to a shared setup function.
function readBootstrap(files) {
  const find = (regex) => files.find((f) => f.rel.endsWith('/main.ts') && regex.test(f.text)) ?? files.find((f) => regex.test(f.text));
  const prefixFile = find(/setGlobalPrefix\(/);
  const versionFile = find(/enableVersioning\(/);
  const versioning = versionFile?.text.match(/enableVersioning\(([\s\S]*?)\)\s*;/);
  const args = versioning?.[1] ?? '';
  return {
    prefix: firstString(prefixFile?.text.match(/setGlobalPrefix\(([^)]*)\)/)?.[1]) ?? '',
    uriVersioning: Boolean(versioning) && (!/type\s*:/.test(args) || /VersioningType\.URI/.test(args)),
    defaultVersion: propString(args, 'defaultVersion'),
    versionPrefix: propString(args, 'prefix') ?? 'v',
  };
}

const joinPath = (...parts) => parts.map((p) => (p ?? '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');

function readRoutes(files, classes, boot) {
  const routes = [];
  for (const { rel, text } of files) {
    const ctrl = text.match(/@Controller\(([^)]*)\)\s*(?:@[\s\S]*?)?export\s+class\s+(\w+)/);
    if (!ctrl) continue;
    const base = firstString(ctrl[1]) ?? propString(ctrl[1], 'path') ?? '';
    const ctrlVersion = propString(ctrl[1], 'version');
    const injected = classes[ctrl[2]]?.injected ?? {};
    for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|All)\(([^)]*)\)/g)) {
      if (m.index < ctrl.index) continue;
      const after = text.slice(m.index + m[0].length);
      const head = after.match(/^(?:\s*@[\w.]+(?:\((?:[^()]|\([^()]*\))*\))?)*\s*(?:(?:public|async)\s+)*(\w+)\s*\(/);
      if (!head) continue;
      const before = text.slice(0, m.index);
      const stackStart = Math.max(before.lastIndexOf(';'), before.lastIndexOf('}'), before.lastIndexOf('{')) + 1;
      const stack = text.slice(stackStart, m.index + m[0].length + head.index + head[0].length);
      const version = boot.uriVersioning
        ? (stack.match(/@Version\(\s*['"`]([^'"`]+)/)?.[1] ?? ctrlVersion ?? boot.defaultVersion)
        : null;
      const body = methodBody(after, head.index + head[0].length - 1) ?? '';
      let stub = STUB.test(body);
      const call = body.match(/this\.(\w+)\.(\w+)\(/);
      if (!stub && call) stub = STUB.test(classes[injected[call[1]]]?.methods[call[2]] ?? '');
      const path = `/${joinPath(boot.prefix, version ? `${boot.versionPrefix}${version}` : '', base, firstString(m[2]) ?? '')}`;
      routes.push({ method: DECORATORS[m[1]], path, where: `${rel}:${lineOf(text, m.index)}`, stub });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

// ---------- docs ----------

const stripFences = (text) => text.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, '');
const normalise = (path) => path.toLowerCase().replace(/[?#].*$/, '').replace(/\{[^}]*\}|:\w+/g, '{}').replace(/\/+$/, '') || '/';

function docRoutes(text) {
  const found = [];
  for (const [, method, path] of stripFences(text).matchAll(DOC_ROUTE)) {
    if (!found.some(([m, p]) => m === method && p === path)) found.push([method, path]);
  }
  return found;
}

function planItems(text) {
  const prose = stripFences(text);
  const unchecked = [...prose.matchAll(/^\s*[-*] \[ \] (.+)$/gm)].map((m) => m[1].trim());
  if (unchecked.length) return unchecked;
  const section = prose.match(/^#+ .*build order.*$\r?\n([\s\S]*?)(?=^#|(?![\s\S]))/im);
  return section ? [...section[1].matchAll(/^\s*\d+[.)] (.+)$/gm)].map((m) => m[1].trim()) : [];
}

function frontmatter(path) {
  const match = isFile(path) ? readText(path).match(/^---\r?\n([\s\S]*?)\r?\n---/) : null;
  const data = {};
  for (const [, key, value] of (match?.[1] ?? '').matchAll(/^([\w-]+):\s*(.+?)\s*$/gm)) data[key] = value.replace(/^["']|["']$/g, '');
  return data;
}

// ---------- scan ----------

function scanApp(repo, app, config, io) {
  const pkg = readJson(join(app, 'package.json')) ?? {};
  const workspace = readJson(join(repo, 'package.json')) ?? {};
  const all = { ...deps(workspace), ...deps(pkg) };
  const lock = (name) => isFile(join(app, name)) || isFile(join(repo, name));
  const declared = String(pkg.packageManager ?? workspace.packageManager ?? '').match(/^(npm|pnpm|yarn|bun)\b/)?.[1];
  const pm = declared ?? (lock('bun.lock') || lock('bun.lockb') ? 'bun' : lock('pnpm-lock.yaml') ? 'pnpm'
    : lock('yarn.lock') ? 'yarn' : lock('package-lock.json') ? 'npm' : 'unknown');
  const testScript = pkg.scripts?.test ?? workspace.scripts?.test ?? '';
  const runner = /\bvitest\b/.test(testScript) ? 'vitest' : /\bjest\b/.test(testScript) ? 'jest'
    : all.vitest ? 'vitest' : all.jest ? 'jest' : 'unknown';
  const orm = all.prisma || all['@prisma/client'] ? 'prisma' : all['drizzle-orm'] ? 'drizzle'
    : all['@mikro-orm/core'] ? 'mikro-orm' : all.typeorm ? 'typeorm' : all.mongoose ? 'mongoose' : 'none';
  const platform = all['@nestjs/platform-fastify'] ? 'fastify' : 'express';
  io.out(`app: ${toPosix(relative(repo, app)) || '.'}`);
  io.out(`stack: ${pm}, ${runner}, ${orm}, ${platform}, nest ${all['@nestjs/core']}`);
  io.out(`scripts: ${Object.keys(pkg.scripts ?? {}).sort().join(', ') || 'none'}`);

  const srcDir = join(app, readJson(join(app, 'nest-cli.json'))?.sourceRoot ?? 'src');
  const modules = join(srcDir, 'modules');
  if (isDir(modules)) {
    for (const name of readdirSync(modules).filter((n) => isDir(join(modules, n))).sort()) {
      const layers = readdirSync(join(modules, name)).filter((n) => isDir(join(modules, name, n))).sort();
      io.out(`module ${name}: ${layers.join(', ') || 'no layers'}`);
    }
  }
  const files = walk(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((file) => ({ rel: toPosix(relative(app, file)), text: readText(file) }));
  const code = files.filter((f) => !isTest(f.rel));
  const routes = readRoutes(code, indexClasses(code), readBootstrap(code));
  for (const r of routes) io.out(`route ${r.method} ${r.path} ${r.where}${r.stub ? ' STUB' : ''}`);
  if (code.some((f) => /RouterModule\.register\(/.test(f.text))) {
    io.out('blocker: router_module (route paths may lack RouterModule prefixes)');
  }

  const tests = walk(app).filter((f) => isTest(f)).map((f) => toPosix(relative(app, f)));
  const realTests = tests.filter((f) => !f.endsWith('app.controller.spec.ts'));
  io.out(`test files: ${tests.length} (${tests.filter((f) => f.includes('e2e')).length} e2e)`);
  const hints = [];
  const pipes = code.filter((f) => /new ValidationPipe\(/.test(f.text));
  if (!pipes.length) hints.push('no global ValidationPipe [security-validate-all-input]');
  else if (!pipes.some((f) => /whitelist\s*:\s*true/.test(f.text))) {
    hints.push(`${pipes[0].rel} ValidationPipe without whitelist: true [security-validate-all-input]`);
  }
  if (routes.length && !code.some((f) => /@UseGuards\(|APP_GUARD/.test(f.text))) {
    hints.push('routes but no guard (@UseGuards or APP_GUARD) [security-use-guards]');
  }
  if (!realTests.length) hints.push('no tests beyond the starter [test-use-testing-module]');
  for (const hint of hints) io.out(`hint: ${hint}`);

  const planDoc = config.planDoc ?? config.buildOrderDoc;
  const docPaths = [planDoc, ...(config.docs ?? []), ...(config.endpointDocs ?? [])].filter((p) => typeof p === 'string');
  if (typeof planDoc === 'string') {
    if (isFile(join(repo, planDoc))) for (const item of planItems(readText(join(repo, planDoc))).slice(0, 8)) io.out(`plan: ${item.length > 100 ? `${item.slice(0, 97)}...` : item}`);
    else io.out(`blocker: no_plan_doc ${planDoc}`);
  }
  const wanted = [];
  for (const path of [...new Set(docPaths)]) {
    if (!isFile(join(repo, path))) continue;
    for (const pair of docRoutes(readText(join(repo, path)))) {
      if (!wanted.some(([m, p]) => m === pair[0] && normalise(p) === normalise(pair[1]))) wanted.push(pair);
    }
  }
  if (!wanted.length) return;
  const done = [];
  const stub = [];
  const missing = [];
  for (const [method, path] of wanted) {
    const target = normalise(path);
    const match = (r) => (r.method === method || r.method === 'ALL');
    const found = routes.find((r) => match(r) && normalise(r.path) === target)
      ?? routes.find((r) => match(r) && normalise(r.path) !== '/' && target.endsWith(normalise(r.path)));
    if (!found) missing.push(`${method} ${path}`);
    else if (found.stub) stub.push(`${method} ${path}`);
    else done.push(path);
  }
  io.out(`endpoints: ${done.length} done, ${stub.length} stub, ${missing.length} missing (static match)`);
  for (const row of stub.slice(0, 8)) io.out(`stub: ${row}`);
  for (const row of missing.slice(0, 8)) io.out(`missing: ${row}`);
}

function lessonDirs(repo) {
  const learn = join(repo, 'learn');
  if (!isDir(learn)) return [];
  return readdirSync(learn).filter((n) => /^\d+-/.test(n) && isDir(join(learn, n))).sort().map((n) => join(learn, n));
}

// A PR number, '' when none is merged, or null when unknown.
function mergedPr(repo, branch, useGh, runner) {
  if (!useGh || !branch) return null;
  const [code, output] = runner(['gh', 'pr', 'list', '--head', branch, '--state', 'merged', '--json', 'number', '--limit', '1'], repo);
  if (code !== 0) return null;
  try {
    const rows = JSON.parse(output);
    return rows.length ? String(rows[0].number) : '';
  } catch {
    return null;
  }
}

function scanLessons(repo, useGh, runner, io) {
  let highest = 0;
  let finished = 0;
  for (const lesson of lessonDirs(repo)) {
    const name = basename(lesson);
    highest = Math.max(highest, Number(name.split('-')[0]));
    const meta = frontmatter(join(lesson, 'TICKET.md'));
    const status = meta.status ?? 'unknown';
    if (status === 'done' || status === 'dropped') {
      finished += 1;
      continue;
    }
    const pr = status === 'in-progress' ? mergedPr(repo, meta.branch, useGh, runner) : null;
    io.out(`lesson ${name}: ${status}, ${meta.kind ?? '?'}${pr ? `, merged PR #${pr}` : ''}`);
  }
  io.out(`lessons finished: ${finished}`);
  io.out(`next lesson number: ${String(highest + 1).padStart(2, '0')}`);
}

export function scan(repo, useGh, runner = run, io = defaultIo) {
  const [code, output] = runner(['git', 'rev-parse', '--is-inside-work-tree'], repo);
  if (code === 127) io.out(`blocker: git_unavailable ${output}`);
  else if (code !== 0) io.out(/not a git/i.test(output) ? 'blocker: no_git' : `blocker: git_unavailable ${output.slice(0, 200)}`);
  else if (runner(['git', 'rev-parse', '--verify', 'HEAD'], repo)[0] !== 0) io.out('blocker: no_commits');

  const configPath = join(repo, 'learn', 'learn.config.json');
  let config = {};
  if (isFile(configPath)) {
    try {
      config = JSON.parse(readText(configPath));
    } catch (error) {
      io.err(`error: ${configPath}: ${error.message}`);
      return 2;
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      io.err(`error: ${configPath}: must be a JSON object`);
      return 2;
    }
    const old = OLD_FIELDS.filter((key) => key in config);
    if (old.length) io.out(`blocker: old_config ${old.join(', ')} (rewrite it, see config.md)`);
  } else io.out('blocker: no_config');

  const configured = config.appRoot ?? config.appPath;
  const apps = typeof configured === 'string'
    ? (deps(readJson(join(repo, configured, 'package.json')))['@nestjs/core'] ? [resolve(repo, configured)] : [])
    : findApps(repo);
  if (!apps.length) io.out('blocker: no_nest_app (empty repo: scaffold lesson; otherwise check appRoot)');
  else if (apps.length > 1) io.out(`blocker: several_apps ${apps.map((a) => toPosix(relative(repo, a)) || '.').join(', ')} (ask which, then set appRoot)`);
  else scanApp(repo, apps[0], config, io);

  scanLessons(repo, useGh, runner, io);
  const ledger = join(repo, 'learn', 'concepts.md');
  io.out(`concepts seen: ${isFile(ledger) ? (readText(ledger).match(/^## /gm) ?? []).length : 0}`);
  return 0;
}

// ---------- guide ----------

function splitSteps(text) {
  const matches = [...text.matchAll(STEP)];
  return matches.map((m, i) => {
    const end = matches[i + 1]?.index ?? text.length;
    const rest = text.slice(m.index + m[0].length, end);
    const next = rest.search(/^## /m);
    const stop = next === -1 ? end : m.index + m[0].length + next;
    return [Number(m[1]), text.slice(m.index, stop).trimEnd()];
  });
}

export function showStep(guide, number, io = defaultIo) {
  const steps = splitSteps(readText(guide));
  const found = steps.find(([n]) => n === number);
  if (found) {
    io.out(found[1]);
    return 0;
  }
  io.err(`no step ${number}; the guide has steps up to ${Math.max(0, ...steps.map(([n]) => n))}`);
  return 1;
}

export function guideSize(guide, io = defaultIo) {
  const text = readText(guide);
  const count = splitSteps(text).length;
  const tokens = Math.round(text.length / CHARS_PER_TOKEN);
  io.out(`steps: ${count}/${MAX_STEPS}; estimated tokens: ${tokens}/${MAX_GUIDE_TOKENS}`);
  if (count <= MAX_STEPS && tokens <= MAX_GUIDE_TOKENS) return 0;
  io.out('over limit: split the ticket or shorten the guide');
  return 1;
}

// ---------- cleanup ----------

function canonical(path) {
  let real;
  try { real = realpathSync.native(path); } catch { real = resolve(path); }
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

const samePath = (a, b) => canonical(a) === canonical(b);
const inside = (child, parent) => canonical(child).startsWith(canonical(parent) + sep);

function recordedWorktree(lesson) {
  const readme = join(lesson, 'README.md');
  const match = isFile(readme) ? readText(readme).match(/^- Worktree: (.+?)\s*$/m) : null;
  return match ? match[1] : null;
}

export function cleanup(repo, abandoned, dryRun, useGh, runner = run, io = defaultIo) {
  const lessons = lessonDirs(repo);
  if (abandoned && !lessons.some((l) => basename(l) === abandoned)) {
    io.err(`error: no lesson named ${abandoned}`);
    return 2;
  }
  const [listCode, listed] = runner(['git', 'worktree', 'list', '--porcelain'], repo);
  const worktrees = listCode === 0
    ? listed.split(/\r?\n/).filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9)).slice(1)
    : [];
  let failed = false;
  for (const lesson of lessons) {
    const name = basename(lesson);
    const path = recordedWorktree(lesson);
    if (!path || !existsSync(path)) continue;
    if (samePath(path, repo) || inside(path, repo)) {
      io.out(`keep ${name}: recorded path is inside the repo, not a lesson worktree`);
      continue;
    }
    if (!worktrees.some((w) => samePath(path, w))) {
      io.out(`keep ${name}: ${path} is not a registered worktree of this repo`);
      continue;
    }
    if (name !== abandoned) {
      const pr = mergedPr(repo, frontmatter(join(lesson, 'TICKET.md')).branch, useGh, runner);
      if (pr === null) {
        io.out(`keep ${name}: merge state unknown, ask the owner`);
        continue;
      }
      if (pr === '') {
        io.out(`keep ${name}: no merged PR, ask the owner before removing`);
        continue;
      }
    }
    if (dryRun) {
      io.out(`would remove ${path}`);
      continue;
    }
    const [code, output] = runner(['git', '-c', 'core.longPaths=true', 'worktree', 'remove', '--force', path], repo);
    if (code !== 0) {
      io.out(`failed to remove ${path}: ${output}`);
      failed = true;
      continue;
    }
    io.out(`removed ${path}`);
    const parent = dirname(path);
    if (basename(parent).endsWith('-lessons') && isDir(parent) && !readdirSync(parent).length) {
      rmdirSync(parent);
      io.out(`removed empty ${parent}`);
    }
  }
  if (!dryRun) runner(['git', 'worktree', 'prune'], repo);
  return failed ? 1 : 0;
}

// ---------- main ----------

export function main(argv, io = defaultIo) {
  const [command, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('--') && a !== '--abandoned'));
  const abandonedAt = rest.indexOf('--abandoned');
  const abandoned = abandonedAt === -1 ? null : rest[abandonedAt + 1];
  const positional = rest.filter((a, i) => !a.startsWith('--') && (abandonedAt === -1 || i !== abandonedAt + 1));
  const usage = 'usage: learn.mjs scan REPO [--no-gh] | step GUIDE N | guide-size GUIDE | cleanup REPO [--abandoned SLUG] [--dry-run] [--no-gh]';
  if (command === 'scan' || command === 'cleanup') {
    if (!positional[0] || !isDir(positional[0])) {
      io.err(positional[0] ? `error: ${positional[0]}: not a directory` : usage);
      return 2;
    }
    const repo = resolve(positional[0]);
    if (command === 'scan') return scan(repo, !flags.has('--no-gh'), run, io);
    if (abandonedAt !== -1 && !abandoned) {
      io.err(usage);
      return 2;
    }
    return cleanup(repo, abandoned, flags.has('--dry-run'), !flags.has('--no-gh'), run, io);
  }
  if (command === 'step' || command === 'guide-size') {
    if (!positional[0] || !isFile(positional[0])) {
      io.err(positional[0] ? `error: ${positional[0]}: no such file` : usage);
      return 2;
    }
    if (command === 'guide-size') return guideSize(positional[0], io);
    const number = Number(positional[1]);
    if (!Number.isInteger(number)) {
      io.err(usage);
      return 2;
    }
    return showStep(positional[0], number, io);
  }
  io.err(usage);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
