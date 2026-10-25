#!/usr/bin/env node
// Deterministic instruction-file benchmark; never invokes an agent or external API.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getEncoding } from 'js-tiktoken';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const encoding = 'o200k_base';
const skills = ['nestjs-best-practices', 'nestjs-learn-pick-task', 'nestjs-learn-write-lesson', 'nestjs-learn-coach', 'nestjs-modular-monolith'];

export function measure(root, scenarios, count) {
  const files = {};
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.md')) {
        const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
        const key = relative(root, path).replaceAll('\\', '/');
        files[key] = { tokens: count(text), sha256: createHash('sha256').update(text).digest('hex') };
      }
    }
  }
  // Skills missing from `root` (an older checkout, a test fixture) are skipped.
  const skillRows = skills.filter((name) => existsSync(join(root, 'skills', name, 'SKILL.md'))).map((name) => {
    const dir = join(root, 'skills', name);
    walk(dir);
    const entry = `skills/${name}/SKILL.md`;
    const text = readFileSync(join(root, entry), 'utf8').replace(/\r\n/g, '\n');
    const description = text.match(/^description:\s*(.+)$/m)?.[1] ?? '';
    return { skill: name, entryTokens: files[entry].tokens, descriptionTokens: count(description), corpusTokens: Object.entries(files).filter(([file]) => file.startsWith(`skills/${name}/`)).reduce((sum, [, row]) => sum + row.tokens, 0) };
  });
  const scenarioRows = scenarios.map(({ id, skill, files: paths }) => {
    const selected = [...new Set(paths.map((file) => `skills/${skill}/${file}`))];
    for (const file of selected) {
      // Non-Markdown files (config templates the agent reads to edit) count only when a scenario lists them.
      // `path#L1-20` counts only those lines, for instructions that say to read just that part.
      // The whole file is recorded too, so a baseline that read all of it can still be compared.
      const [path, range] = file.split('#L');
      if (!files[file] && !path.endsWith('.md') && existsSync(join(root, path))) {
        const text = readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
        const row = (t) => ({ tokens: count(t), sha256: createHash('sha256').update(t).digest('hex') });
        files[path] ??= row(text);
        if (range) {
          const [from, to] = range.split('-').map(Number);
          files[file] = row(text.split('\n').slice(from - 1, to).join('\n'));
        }
      }
      if (!files[file]) throw new Error(`Scenario ${id}: missing ${file}`);
    }
    return { id, skill, files: selected, tokens: selected.reduce((sum, file) => sum + files[file].tokens, 0) };
  });
  return { schema: 1, encoding, normalization: 'CRLF to LF; sum each distinct file once per scenario', skills: skillRows, scenarios: scenarioRows, files };
}

export function compare(before, after) {
  if (before.encoding !== after.encoding) throw new Error('Cannot compare different encodings');
  return before.scenarios.map((old) => {
    const current = after.scenarios.find((row) => row.id === old.id && row.skill === old.skill);
    if (!current) throw new Error(`Missing scenario: ${old.id}`);
    const sameFiles = old.files.reduce((sum, file) => {
      if (!after.files[file]) throw new Error(`Baseline file removed: ${file}`);
      return sum + after.files[file].tokens;
    }, 0);
    return { scenario: old.id, before: old.tokens, afterSameFiles: sameFiles, afterRouted: current.tokens, savedPercent: Number(((old.tokens - current.tokens) / old.tokens * 100).toFixed(1)) };
  });
}

function main() {
  const args = process.argv.slice(2);
  const value = (key) => { const i = args.indexOf(key); return i === -1 ? null : args[i + 1]; };
  const encoder = getEncoding(encoding);
  const root = value('--root') ? resolve(value('--root')) : repo;
  const scenarioPath = value('--scenarios') ? resolve(value('--scenarios')) : join(repo, 'scripts', 'token-scenarios.json');
  const scenarios = JSON.parse(readFileSync(scenarioPath, 'utf8'));
  const snapshot = { ...measure(root, scenarios, (text) => encoder.encode(text, [], []).length), label: value('--label') ?? 'working-tree' };
  const baseline = value('--compare');
  if (baseline) snapshot.comparison = compare(JSON.parse(readFileSync(resolve(baseline), 'utf8')), snapshot);
  const output = value('--output');
  if (output) {
    const path = resolve(output);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  }
  console.table(snapshot.skills.map(({ skill, entryTokens, descriptionTokens }) => ({ skill, entryTokens, descriptionTokens })));
  console.table(snapshot.comparison ?? snapshot.scenarios.map(({ id, tokens }) => ({ scenario: id, tokens })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
