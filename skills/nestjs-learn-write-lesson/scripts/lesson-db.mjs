#!/usr/bin/env node
// Make and check the lesson database. Never prints passwords or full URLs.
// Works the same from PowerShell and bash.
//
// Usage:
//   node lesson-db.mjs prepare --main-app <dir> --worktree-app <dir> --lesson <NN> [--env DATABASE_URL] [--shadow]
//     Copies <main-app>/.env to <worktree-app>/.env (only if the worktree has none), then sets
//     <env> to the same URL with the database renamed to <name>_lesson_<NN>.
//     --shadow also sets SHADOW_DATABASE_URL to <name>_lesson_<NN>_shadow (for Prisma).
//     Refuses unless <worktree-app> is in a linked worktree (git worktree add) of the same
//     repository as <main-app>, outside the main checkout. So it never rewrites the owner's .env.
//     The worktree .env is replaced by rename, so a symlinked or hard-linked .env is swapped for
//     its own file instead of being written through.
//   node lesson-db.mjs create --worktree-app <dir> [--env DATABASE_URL] [--shadow]
//     Creates the lesson database (and the shadow one) on the same server. Already there: fine.
//   node lesson-db.mjs check --worktree-app <dir> [--env DATABASE_URL] [--shadow]
//     Prints the database name(s) the worktree .env points at, and exits 1 if one is not a lesson database.
//
// Only names ending in _lesson_<NN> or _lesson_<NN>_shadow are ever created. This script never drops.

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const LESSON_NAME = /_lesson_\d{2,}(?:_shadow)?$/;

function log(msg) {
  process.stderr.write(`[lesson-db] ${msg}\n`);
}

function fail(msg) {
  log(msg);
  process.exit(1);
}

function option(args, name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

// Minimal .env reader: KEY=value, optional quotes, # comments.
// Like dotenv: a quoted value ends at its closing quote; an unquoted value ends at the first #.
function readEnv(path) {
  if (!existsSync(path)) return { lines: [], values: {} };
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const m = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const quoted = m[2].match(/^(['"`])(.*?)\1/);
    values[m[1]] = quoted ? quoted[2] : m[2].replace(/#.*$/, '').trim();
  }
  return { lines, values };
}

function setEnv(path, updates) {
  const { lines } = readEnv(path);
  const out = [...lines];
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    const i = out.findIndex((l) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(l));
    if (i === -1) out.splice(out.length && out[out.length - 1] === '' ? out.length - 1 : out.length, 0, line);
    else out[i] = line;
  }
  writeFileAtomic(path, `${out.join('\n').replace(/\n*$/, '')}\n`);
}

// Write a new file next to `path`, then rename it over `path`. The rename replaces the
// directory entry, so a symlink or hard link at `path` is swapped out, never written through.
function writeFileAtomic(path, text) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, text, { flag: 'wx' });
  renameSync(temp, path);
}

function linkInfo(path) {
  try {
    const stat = lstatSync(path);
    return { exists: true, linked: stat.isSymbolicLink() || stat.nlink > 1 };
  } catch {
    return { exists: false, linked: false };
  }
}

function dbName(url) {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('lesson-db supports PostgreSQL URLs only. Use the project\'s native tools to isolate another database engine.');
  }
  return decodeURIComponent(parsed.pathname.slice(1));
}

function withDb(url, name) {
  const u = new URL(url);
  u.pathname = `/${encodeURIComponent(name)}`;
  return u.href;
}

// URL for the `postgres` database, for CREATE DATABASE. Drops ORM-only query params
// such as Prisma's `?schema=public`, which psql and pg refuse; keeps SSL settings.
function adminUrl(url) {
  const u = new URL(withDb(url, 'postgres'));
  for (const key of [...u.searchParams.keys()]) {
    if (!/^ssl/i.test(key)) u.searchParams.delete(key);
  }
  return u.href;
}

function realPath(path) {
  const real = realpathSync.native(path);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function git(dir, ...args) {
  const result = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/).map(realPath) : null;
}

// The worktree app must sit in a linked worktree of the main app's repository, outside the
// main checkout. Same folder, a path into the main checkout, or a plain folder: refuse.
function checkIsolated(mainApp, worktreeApp) {
  if (!existsSync(worktreeApp)) fail(`--worktree-app does not exist: ${worktreeApp}`);
  if (realPath(mainApp) === realPath(worktreeApp)) fail('refusing: --main-app and --worktree-app are the same folder');
  const args = ['rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir', '--git-dir'];
  const main = git(mainApp, ...args);
  const lesson = git(worktreeApp, ...args);
  if (!main || !lesson) fail('refusing: both folders must be inside Git checkouts');
  const [mainTop, mainCommon] = main;
  const [lessonTop, lessonCommon, lessonGitDir] = lesson;
  // Outside means the first path segment is exactly `..` (a folder named `..lessons` is inside).
  const inside = relative(mainTop, lessonTop);
  const outside = isAbsolute(inside) || inside.split(sep)[0] === '..';
  if (!outside) fail('refusing: --worktree-app is inside the main checkout');
  if (lessonCommon !== mainCommon) fail('refusing: --worktree-app is not a worktree of the main repository');
  if (lessonGitDir === lessonCommon) fail('refusing: --worktree-app is not a linked worktree (make it with git worktree add)');
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function prepare(args) {
  const mainApp = resolve(option(args, 'main-app') ?? fail('--main-app is required'));
  const worktreeApp = resolve(option(args, 'worktree-app') ?? fail('--worktree-app is required'));
  const lesson = option(args, 'lesson') ?? fail('--lesson is required');
  const key = option(args, 'env', 'DATABASE_URL');
  if (!/^\d{2,}$/.test(lesson)) fail(`--lesson must be the two-digit lesson number, got "${lesson}"`);
  checkIsolated(mainApp, worktreeApp);

  const mainUrl = readEnv(join(mainApp, '.env')).values[key];
  if (!mainUrl) fail(`${key} not found in ${join(mainApp, '.env')}`);
  const base = dbName(mainUrl).replace(/_lesson_\d+(?:_shadow)?$/, '');
  const name = `${base}_lesson_${lesson}`;

  const target = join(worktreeApp, '.env');
  const before = linkInfo(target);
  if (!before.exists) {
    writeFileAtomic(target, readFileSync(join(mainApp, '.env')));
    log(`copied .env into the worktree (contents not shown)`);
  } else if (before.linked) {
    log('the worktree .env is a link; replacing it with its own file, so the linked file stays unchanged');
  }
  const updates = { [key]: withDb(mainUrl, name) };
  if (args.includes('--shadow')) updates.SHADOW_DATABASE_URL = withDb(mainUrl, `${name}_shadow`);
  setEnv(target, updates);
  log(`set ${Object.keys(updates).join(', ')} in the worktree .env`);
  process.stdout.write(`${name}\n`);
}

function targets(args) {
  const worktreeApp = resolve(option(args, 'worktree-app') ?? fail('--worktree-app is required'));
  const key = option(args, 'env', 'DATABASE_URL');
  const { values } = readEnv(join(worktreeApp, '.env'));
  const urls = [values[key] ?? fail(`${key} not found in ${join(worktreeApp, '.env')}`)];
  if (args.includes('--shadow')) urls.push(values.SHADOW_DATABASE_URL ?? fail('SHADOW_DATABASE_URL not found. Run prepare with --shadow.'));
  for (const url of urls) {
    if (!LESSON_NAME.test(dbName(url))) fail(`refusing: "${dbName(url)}" is not a lesson database (needs _lesson_<NN>)`);
  }
  return { worktreeApp, urls };
}

function check(args) {
  const { urls } = targets(args);
  for (const url of urls) process.stdout.write(`${dbName(url)}\n`);
}

// Create with the app's own `pg` package; without it, with `psql`.
async function create(args) {
  const { worktreeApp, urls } = targets(args);
  let pg = null;
  try {
    pg = createRequire(join(worktreeApp, 'package.json'))('pg');
  } catch {
    log('pg is not installed in the worktree app; using psql');
  }
  for (const url of urls) {
    const name = dbName(url);
    const admin = adminUrl(url);
    if (pg) {
      const client = new pg.Client({ connectionString: admin });
      try {
        await client.connect();
        await client.query(`CREATE DATABASE ${quoteIdent(name)}`);
        log(`created ${name}`);
      } catch (error) {
        if (error.code === '42P04') log(`${name} already exists`);
        else fail(`could not create ${name}: ${error.code ?? ''} ${error.message}`);
      } finally {
        await client.end().catch(() => {});
      }
    } else {
      const result = spawnSync('psql', [admin, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${quoteIdent(name)}`], { encoding: 'utf8' });
      if (result.error) fail('neither pg nor psql is available. Ask the owner to create the database.');
      if (result.status !== 0) {
        if (/already exists/.test(result.stderr)) log(`${name} already exists`);
        else fail(`could not create ${name}: ${result.stderr.trim().split('\n')[0]}`);
      } else log(`created ${name}`);
    }
    process.stdout.write(`${name}\n`);
  }
}

const [command, ...args] = process.argv.slice(2);
if (command === 'prepare') prepare(args);
else if (command === 'create') await create(args);
else if (command === 'check') check(args);
else fail('usage: lesson-db.mjs prepare|create|check ... (see the top of this file)');
