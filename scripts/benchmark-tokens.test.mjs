import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { getEncoding } from 'js-tiktoken';
import { compare, measure } from './benchmark-tokens.mjs';

const root = mkdtempSync(join(tmpdir(), 'token-bench-'));
after(() => {
  assert.ok(basename(root).startsWith('token-bench-'));
  rmSync(root, { recursive: true, force: true });
});
const skills = ['nestjs-best-practices', 'nestjs-learn-pick-task', 'nestjs-learn-write-lesson', 'nestjs-learn-coach'];
const encoder = getEncoding('o200k_base');
const count = (text) => encoder.encode(text, [], []).length;
function fixture(newline) {
  const dir = join(root, newline === '\n' ? 'lf' : 'crlf');
  for (const skill of skills) {
    const skillDir = join(dir, 'skills', skill);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), ['---', `name: ${skill}`, 'description: test a task', '---', 'hello world', ''].join(newline));
  }
  return dir;
}
const scenarios = [{ id: 'lookup', skill: skills[0], files: ['SKILL.md', 'SKILL.md'] }];

test('line endings do not change benchmark hashes or token counts', () => {
  assert.deepEqual(measure(fixture('\n'), scenarios, count), measure(fixture('\r\n'), scenarios, count));
});

test('a file is counted once per workflow and descriptions remain separate metrics', () => {
  const snapshot = measure(fixture('\n'), scenarios, count);
  assert.equal(snapshot.scenarios[0].files.length, 1);
  assert.equal(snapshot.scenarios[0].tokens, snapshot.skills[0].entryTokens);
  assert.equal(snapshot.skills[0].descriptionTokens, count('test a task'));
});

test('non-Markdown files count only when listed, and a line range counts only those lines', () => {
  const dir = fixture('\n');
  writeFileSync(join(dir, 'skills', skills[0], 'config.cjs'), ['one two', 'three four', 'five six'].join('\n'));
  const whole = measure(dir, [{ id: 'whole', skill: skills[0], files: ['config.cjs'] }], count);
  const part = measure(dir, [{ id: 'part', skill: skills[0], files: ['config.cjs#L1-1'] }], count);
  assert.equal(whole.scenarios[0].tokens, count('one two\nthree four\nfive six'));
  assert.equal(part.scenarios[0].tokens, count('one two'));
  assert.equal(measure(dir, scenarios, count).files[`skills/${skills[0]}/config.cjs`], undefined);
});

test('comparison distinguishes shorter content from loading fewer references', () => {
  const before = { encoding: 'test', scenarios: [{ id: 'review', skill: 'test', files: ['entry', 'optional'], tokens: 100 }] };
  const after = { encoding: 'test', scenarios: [{ id: 'review', skill: 'test', files: ['entry'], tokens: 30 }], files: { entry: { tokens: 30 }, optional: { tokens: 20 } } };
  assert.deepEqual(compare(before, after), [{ scenario: 'review', before: 100, afterSameFiles: 50, afterRouted: 30, savedPercent: 70 }]);
  assert.throws(() => compare(before, { ...after, encoding: 'different' }), /different encodings/);
  assert.throws(() => compare(before, { ...after, files: { entry: { tokens: 30 } } }), /Baseline file removed/);
});
