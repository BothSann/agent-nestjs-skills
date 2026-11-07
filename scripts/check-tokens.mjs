#!/usr/bin/env node
// Fails when a skill file exceeds its budget in benchmarks/budgets.json. Never calls an agent or API.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEncoding } from 'js-tiktoken';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgets = JSON.parse(readFileSync(join(repo, 'benchmarks/budgets.json'), 'utf8'));
const encoder = getEncoding(budgets.encoding);
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const count = (text) => encoder.encode(text).length;

const failures = [];
const rows = [];
function check(label, tokens, limit) {
  rows.push({ label, tokens, limit });
  if (tokens > limit) failures.push(`${label}: ${tokens} > ${limit}`);
}

for (const [skill, limits] of Object.entries(budgets.skills)) {
  const dir = join(repo, 'skills', skill);
  if (!existsSync(join(dir, 'SKILL.md'))) {
    failures.push(`${skill}: SKILL.md is missing`);
    continue;
  }
  const entry = read(join(dir, 'SKILL.md'));
  check(`${skill} description`, count(entry.match(/^description:\s*(.+)$/m)?.[1] ?? ''), budgets.description);
  check(`${skill} SKILL.md`, count(entry), limits.entry);
  const rulesDir = join(dir, 'rules');
  if (existsSync(rulesDir)) {
    let largest = { name: '', tokens: 0 };
    for (const name of readdirSync(rulesDir).filter((file) => file.endsWith('.md'))) {
      const tokens = count(read(join(rulesDir, name)));
      if (tokens > largest.tokens) largest = { name, tokens };
      if (tokens > budgets.rule) failures.push(`${skill}/rules/${name}: ${tokens} > ${budgets.rule}`);
    }
    rows.push({ label: `${skill} largest rule (${largest.name})`, tokens: largest.tokens, limit: budgets.rule });
  }
  for (const [id, files] of Object.entries(limits.scenarios ?? {})) {
    const tokens = files.files.reduce((sum, file) => sum + count(read(join(dir, file))), 0);
    check(`${skill} ${id}`, tokens, files.limit);
  }
}

console.table(rows);
if (failures.length) {
  console.error(`Over budget:\n${failures.join('\n')}`);
  process.exit(1);
}
