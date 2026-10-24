#!/usr/bin/env node
// Tests for lesson-db.mjs. Run: node --test skills/nestjs-learn-write-lesson/scripts/lesson-db.test.mjs
// Uses temp folders only. Never connects to a database: `create` is tested only where it refuses first.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'lesson-db.mjs');
const temp = mkdtempSync(join(tmpdir(), 'lesson-db-'));
after(() => rmSync(temp, { recursive: true, force: true }));

let count = 0;
function apps(mainEnv, worktreeEnv) {
  const root = join(temp, String(++count));
  const main = join(root, 'main');
  const worktree = join(root, 'worktree');
  mkdirSync(main, { recursive: true });
  mkdirSync(worktree, { recursive: true });
  if (mainEnv !== undefined) writeFileSync(join(main, '.env'), mainEnv);
  if (worktreeEnv !== undefined) writeFileSync(join(worktree, '.env'), worktreeEnv);
  return { main, worktree, env: () => readFileSync(join(worktree, '.env'), 'utf8') };
}

function run(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: result.status, out: result.stdout.trim(), err: result.stderr };
}

const URL_MAIN = 'postgresql://shop:s3cret@localhost:5432/shop?schema=public';

test('prepare copies .env and renames only the database', () => {
  const a = apps(`PORT=3000\nDATABASE_URL="${URL_MAIN}"\n`);
  const r = run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04');
  assert.equal(r.status, 0, r.err);
  assert.equal(r.out, 'shop_lesson_04');
  assert.match(a.env(), /^PORT=3000$/m);
  assert.match(a.env(), /^DATABASE_URL="postgresql:\/\/shop:s3cret@localhost:5432\/shop_lesson_04\?schema=public"$/m);
});

test('prepare never prints the password', () => {
  const a = apps(`DATABASE_URL=${URL_MAIN}\n`);
  const r = run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04');
  assert.doesNotMatch(r.out + r.err, /s3cret/);
});

test('prepare drops an inline comment after an unquoted value', () => {
  const a = apps(`DATABASE_URL=${URL_MAIN} # local db\n`);
  run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04');
  assert.match(a.env(), /\/shop_lesson_04\?schema=public"$/m);
});

test('prepare keeps a # inside quotes', () => {
  const a = apps(`DATABASE_URL="postgresql://shop:a%23b@localhost:5432/shop" # a#b password\n`);
  const r = run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04');
  assert.equal(r.out, 'shop_lesson_04');
  assert.match(a.env(), /shop:a%23b@localhost:5432\/shop_lesson_04"$/m);
});

test('prepare keeps an existing worktree .env and only sets the URL', () => {
  const a = apps(`DATABASE_URL=${URL_MAIN}\n`, 'PORT=3004\nDATABASE_URL=postgresql://old@localhost/old\n');
  run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04');
  assert.match(a.env(), /^PORT=3004$/m);
  assert.match(a.env(), /\/shop_lesson_04\?/);
  assert.doesNotMatch(a.env(), /old/);
});

test('prepare --shadow sets SHADOW_DATABASE_URL, and a custom --env works', () => {
  const a = apps(`DB_URL=${URL_MAIN}\n`);
  const r = run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '07', '--env', 'DB_URL', '--shadow');
  assert.equal(r.status, 0, r.err);
  assert.match(a.env(), /^DB_URL=".*\/shop_lesson_07\?schema=public"$/m);
  assert.match(a.env(), /^SHADOW_DATABASE_URL=".*\/shop_lesson_07_shadow\?schema=public"$/m);
});

test('prepare from a lesson URL does not stack _lesson_ twice', () => {
  const a = apps('DATABASE_URL=postgresql://u@localhost/shop_lesson_03\n');
  assert.equal(run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04').out, 'shop_lesson_04');
});

test('prepare refuses a bad lesson number and a missing key', () => {
  const a = apps(`DATABASE_URL=${URL_MAIN}\n`);
  assert.equal(run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '4').status, 1);
  const b = apps('PORT=3000\n');
  assert.equal(run('prepare', '--main-app', b.main, '--worktree-app', b.worktree, '--lesson', '04').status, 1);
});

test('check prints lesson names and refuses the owner database', () => {
  const a = apps(`DATABASE_URL=${URL_MAIN}\n`);
  run('prepare', '--main-app', a.main, '--worktree-app', a.worktree, '--lesson', '04', '--shadow');
  const ok = run('check', '--worktree-app', a.worktree, '--shadow');
  assert.equal(ok.status, 0, ok.err);
  assert.deepEqual(ok.out.split(/\r?\n/), ['shop_lesson_04', 'shop_lesson_04_shadow']);

  const owner = apps(undefined, `DATABASE_URL=${URL_MAIN}\n`);
  const bad = run('check', '--worktree-app', owner.worktree);
  assert.equal(bad.status, 1);
  assert.match(bad.err, /refusing: "shop" is not a lesson database/);
});

test('create refuses the owner database before it connects', () => {
  const owner = apps(undefined, `DATABASE_URL=${URL_MAIN}\n`);
  const r = run('create', '--worktree-app', owner.worktree);
  assert.equal(r.status, 1);
  assert.match(r.err, /refusing/);
});
