#!/usr/bin/env node
// Make and check the lesson database. Never prints passwords or full URLs.
// Works the same from PowerShell and bash.
//
// Usage:
//   node lesson-db.mjs prepare --main-app <dir> --worktree-app <dir> --lesson <NN> [--env DATABASE_URL] [--shadow]
//     Copies <main-app>/.env to <worktree-app>/.env (only if the worktree has none), then sets
//     <env> to the same URL with the database renamed to <name>_lesson_<NN>.
//     --shadow also sets SHADOW_DATABASE_URL to <name>_lesson_<NN>_shadow (for Prisma).
//   node lesson-db.mjs create --worktree-app <dir> [--env DATABASE_URL] [--shadow]
//     Creates the lesson database (and the shadow one) on the same server. Already there: fine.
//   node lesson-db.mjs check --worktree-app <dir> [--env DATABASE_URL]
//     Prints the database name the worktree .env points at, and exits 1 if it is not a lesson database.
//
// Only names ending in _lesson_<NN> or _lesson_<NN>_shadow are ever created. This script never drops.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

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
function readEnv(path) {
  if (!existsSync(path)) return { lines: [], values: {} };
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const m = line.match(/^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*)$/);
    if (m) values[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
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
  writeFileSync(path, `${out.join('\n').replace(/\n*$/, '')}\n`);
}

function dbName(url) {
  return decodeURIComponent(new URL(url).pathname.slice(1));
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

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function prepare(args) {
  const mainApp = resolve(option(args, 'main-app') ?? fail('--main-app is required'));
  const worktreeApp = resolve(option(args, 'worktree-app') ?? fail('--worktree-app is required'));
  const lesson = option(args, 'lesson') ?? fail('--lesson is required');
  const key = option(args, 'env', 'DATABASE_URL');
  if (!/^\d{2,}$/.test(lesson)) fail(`--lesson must be the two-digit lesson number, got "${lesson}"`);

  const mainUrl = readEnv(join(mainApp, '.env')).values[key];
  if (!mainUrl) fail(`${key} not found in ${join(mainApp, '.env')}`);
  const base = dbName(mainUrl).replace(/_lesson_\d+(?:_shadow)?$/, '');
  const name = `${base}_lesson_${lesson}`;

  const target = join(worktreeApp, '.env');
  if (!existsSync(target) && existsSync(join(mainApp, '.env'))) {
    writeFileSync(target, readFileSync(join(mainApp, '.env')));
    log(`copied .env into the worktree (contents not shown)`);
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
