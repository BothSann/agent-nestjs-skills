#!/usr/bin/env node
// Adds one business module: the five layer folders, <name>.module.ts, and index.ts,
// then registers the module in the root Nest module. Follows the project's import
// style (`.js` suffix or not, quotes, path alias for modules if one exists).
// The dependency-cruiser rules match every module folder, so no config change is needed.
//
// Usage: node add-module.mjs <project-root> <kebab-name> [--dry-run] [--no-register]
//                            [--config=.dependency-cruiser.cjs]
// Prints JSON: { created, updated, manual }.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const [rootArg, name] = args.filter((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const register = !args.includes('--no-register');

function fail(message) {
  console.error(`add-module: ${message}`);
  process.exit(2);
}

if (!rootArg || !name) fail('usage: add-module.mjs <project-root> <kebab-name> [--dry-run] [--no-register]');
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) fail(`"${name}" is not kebab-case (for example: billing, order-history)`);
const root = resolve(rootArg);

const LAYERS = ['domain', 'application', 'infrastructure', 'api', 'contracts'];
const toPosix = (p) => p.replaceAll('\\', '/');

function readJsonc(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8')
    .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '')
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const configPath = join(root, flag('config') ?? '.dependency-cruiser.cjs');
let settings = existsSync(configPath) ? createRequire(configPath)(configPath).settings : null;
if (!settings) {
  const src = toPosix(readJsonc(join(root, 'nest-cli.json'))?.sourceRoot ?? 'src').replace(/\/$/, '');
  settings = { sourceRoot: src, modulesDir: `${src}/modules`, rootFiles: ['main.ts', 'app.module.ts'], tsConfig: 'tsconfig.json' };
}
const mods = toPosix(settings.modulesDir).replace(/\/$/, '');
const moduleDir = `${mods}/${name}`;
if (existsSync(join(root, moduleDir))) fail(`${moduleDir} already exists`);

// Project style, read from existing source.
function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else if (/\.ts$/.test(e.name)) out.push(full);
    if (out.length >= 200) break;
  }
  return out;
}
let js = 0;
let bare = 0;
let single = 0;
let double = 0;
for (const file of sourceFiles(join(root, settings.sourceRoot))) {
  for (const m of readFileSync(file, 'utf8').matchAll(/from\s+(['"])([^'"]+)\1/g)) {
    if (m[1] === "'") single++;
    else double++;
    if (m[2].startsWith('.')) {
      if (/\.(js|mjs|cjs)$/.test(m[2])) js++;
      else bare++;
    }
  }
}
const suffix = js > bare ? '.js' : '';
const q = double > single ? '"' : "'";

function moduleAlias() {
  let paths = {};
  for (let current = join(root, settings.tsConfig ?? 'tsconfig.json'), n = 0; current && n < 5; n++) {
    const json = readJsonc(current);
    if (!json) break;
    paths = { ...json.compilerOptions?.paths, ...paths };
    current = typeof json.extends === 'string' && json.extends.startsWith('.') ? resolve(dirname(current), json.extends) : null;
    if (current && !current.endsWith('.json')) current += '.json';
  }
  const hit = Object.entries(paths).find(
    ([key, targets]) => key.endsWith('/*') && targets.some((t) => posix.normalize(toPosix(t)).replace(/^\.\//, '') === `${mods}/*`),
  );
  return hit ? hit[0].slice(0, -2) : null;
}

const className = `${name.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')}Module`;
const files = {
  [`${moduleDir}/${name}.module.ts`]: `import { Module } from ${q}@nestjs/common${q};\n\n@Module({})\nexport class ${className} {}\n`,
  [`${moduleDir}/index.ts`]: `export { ${className} } from ${q}./${name}.module${suffix}${q};\n`,
  ...Object.fromEntries(LAYERS.map((layer) => [`${moduleDir}/${layer}/.gitkeep`, ''])),
};

const result = { created: Object.keys(files), updated: [], manual: null };

// Register in the root Nest module.
let rootUpdate = null;
if (register) {
  const rootModule = settings.rootFiles.find((f) => f.endsWith('.module.ts'));
  const rootPath = rootModule && `${toPosix(settings.sourceRoot).replace(/\/$/, '')}/${rootModule}`;
  const manual = `Add ${className} to the imports of your root Nest module, importing it from the module's index.ts.`;
  if (!rootPath || !existsSync(join(root, rootPath))) {
    result.manual = manual;
  } else {
    const text = readFileSync(join(root, rootPath), 'utf8');
    const alias = moduleAlias();
    let spec = alias
      ? `${alias}/${name}${suffix ? `/index${suffix}` : ''}`
      : posix.relative(posix.dirname(rootPath), `${moduleDir}/index`) + suffix;
    if (!alias && !spec.startsWith('.')) spec = `./${spec}`;
    if (!alias && !suffix) spec = spec.replace(/\/index$/, '');
    const updated = registerIn(text, className, `import { ${className} } from ${q}${spec}${q};`);
    if (updated) {
      rootUpdate = [rootPath, updated];
      result.updated.push(rootPath);
    } else result.manual = `${manual} Could not edit ${rootPath} safely.`;
  }
}

function registerIn(text, cls, importLine) {
  const deco = text.indexOf('@Module(');
  if (deco < 0) return null;
  // Add the import after the last import statement before @Module.
  const imports = [...text.slice(0, deco).matchAll(/^import[\s\S]*?from\s*['"][^'"]+['"];?[^\S\n]*$/gm)];
  if (!imports.length) return null;
  const last = imports.at(-1);
  const at = last.index + last[0].length;
  text = `${text.slice(0, at)}\n${importLine}${text.slice(at)}`;

  const start = text.indexOf('@Module(') + '@Module('.length;
  if (/^\{\s*\}/.test(text.slice(start))) {
    return text.slice(0, start) + text.slice(start).replace(/^\{\s*\}/, `{ imports: [${cls}] }`);
  }
  const key = /\bimports\s*:\s*\[/g;
  key.lastIndex = start;
  const m = key.exec(text);
  const decoEnd = closing(text, start - 1, '(', ')');
  if (!m || m.index > decoEnd) {
    // No imports yet: add the key first.
    const open = text.indexOf('{', start);
    const indent = (text.slice(open + 1).match(/^\n([ \t]+)/) ?? [, '  '])[1];
    return `${text.slice(0, open + 1)}\n${indent}imports: [${cls}],${text.slice(open + 1)}`;
  }
  const open = m.index + m[0].length - 1;
  const close = closing(text, open, '[', ']');
  if (close < 0) return null;
  const inner = text.slice(open + 1, close);
  if (!inner.trim()) return `${text.slice(0, open + 1)}${cls}${text.slice(close)}`;
  if (inner.includes('\n')) {
    const itemIndent = (inner.match(/\n([ \t]+)\S/) ?? [, '    '])[1];
    const body = inner.replace(/\s*$/, '');
    const comma = body.endsWith(',') ? '' : ',';
    const tail = inner.slice(body.length);
    return `${text.slice(0, open + 1)}${body}${comma}\n${itemIndent}${cls},${tail}${text.slice(close)}`;
  }
  return `${text.slice(0, open + 1)}${inner.replace(/,?\s*$/, '')}, ${cls}${text.slice(close)}`;
}

function closing(text, open, a, b) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      i = text.indexOf(c, i + 1);
      if (i < 0) return -1;
    } else if (c === a) depth++;
    else if (c === b && --depth === 0) return i;
  }
  return -1;
}

if (!dryRun) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  if (rootUpdate) writeFileSync(join(root, rootUpdate[0]), rootUpdate[1]);
}
process.stdout.write(`${JSON.stringify({ dryRun, ...result }, null, 2)}\n`);
