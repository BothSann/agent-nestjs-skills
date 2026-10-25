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

  // Edit only what can be read for sure: an object literal whose top-level `imports`
  // is missing or an array literal. Anything else (a variable, a spread, a duplicate
  // key, `@Module(metadata)`) is left untouched for manual registration.
  const start = text.indexOf('@Module(') + '@Module('.length;
  const objOpen = skipBlank(text, start);
  if (text[objOpen] !== '{') return null;
  const objClose = closing(text, objOpen, '{', '}');
  if (objClose < 0) return null;
  if (skipBlank(text, objOpen + 1) === objClose) {
    return `${text.slice(0, objOpen)}{ imports: [${cls}] }${text.slice(objClose + 1)}`;
  }
  const props = topLevelProps(text, objOpen, objClose);
  if (!props || props.some((p) => p.spread)) return null;
  const found = props.filter((p) => p.name === 'imports');
  if (found.length > 1) return null;
  if (!found.length) {
    const indent = (text.slice(objOpen + 1).match(/^\n([ \t]+)/) ?? [, ' '])[1];
    const lead = text[objOpen + 1] === '\n' ? '\n' : '';
    return `${text.slice(0, objOpen + 1)}${lead || ' '}${lead ? indent : ''}imports: [${cls}],${text.slice(objOpen + 1)}`;
  }
  if (found[0].valueStart < 0 || text[found[0].valueStart] !== '[') return null;
  const open = found[0].valueStart;
  const close = closing(text, open, '[', ']');
  if (close < 0 || close > objClose) return null;
  const inner = text.slice(open + 1, close);
  const multiLine = inner.includes('\n');

  // Insert after the last real code in the array, never inside or before a comment.
  let lastCode = -1;
  for (let i = open + 1; i < close; i++) {
    const next = skipToken(text, i);
    if (next !== i) {
      if ("'\"`".includes(text[i])) lastCode = next - 1; // strings are code, comments are not
      i = next - 1;
    } else if (!/\s/.test(text[i])) lastCode = i;
  }

  if (lastCode < 0) {
    // Empty, or only comments: the module becomes the first entry.
    if (!multiLine) return `${text.slice(0, open + 1)}${cls}${inner.trim() ? ` ${inner.trimStart()}` : ''}${text.slice(close)}`;
    const indent = (inner.match(/\n([ \t]+)\S/) ?? [, '    '])[1];
    return `${text.slice(0, open + 1)}\n${indent}${cls},${text.slice(open + 1)}`;
  }

  const comma = text[lastCode] === ',' ? '' : ',';
  const lineEnd = text.indexOf('\n', lastCode);
  const restOfLine = lineEnd < 0 ? '' : text.slice(lastCode + 1, lineEnd);
  const openBlockComment = restOfLine.lastIndexOf('/*') > restOfLine.lastIndexOf('*/');
  if (!multiLine || lineEnd < 0 || lineEnd > close || openBlockComment) {
    return `${text.slice(0, lastCode + 1)}${comma} ${cls}${text.slice(lastCode + 1)}`;
  }
  // New line after the last item's line, so a trailing `// comment` stays on its item.
  const lineStart = text.lastIndexOf('\n', lastCode) + 1;
  const indent = text.slice(lineStart).match(/^[ \t]*/)[0];
  return `${text.slice(0, lastCode + 1)}${comma}${restOfLine}\n${indent}${cls},${text.slice(lineEnd)}`;
}

// Index of the next character that is not whitespace or a comment.
function skipBlank(text, i) {
  for (;;) {
    while (/\s/.test(text[i] ?? '')) i++;
    if (text.startsWith('//', i)) i = text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i);
    else if (text.startsWith('/*', i)) i = text.indexOf('*/', i) < 0 ? text.length : text.indexOf('*/', i) + 2;
    else return i;
  }
}

// Index after a string or comment starting at i, or i when there is none.
function skipToken(text, i) {
  const c = text[i];
  if (c === "'" || c === '"' || c === '`') {
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\') j++;
      else if (text[j] === c) return j + 1;
    }
    return text.length;
  }
  if (text.startsWith('//', i) || text.startsWith('/*', i)) return skipBlank(text, i);
  return i;
}

function closing(text, open, a, b) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const next = skipToken(text, i);
    if (next !== i) {
      i = next - 1;
      continue;
    }
    if (text[i] === a) depth++;
    else if (text[i] === b && --depth === 0) return i;
  }
  return -1;
}

// Top-level properties of the object literal between objOpen and objClose:
// { name, spread, valueStart } where valueStart is -1 for shorthand (`{ imports }`).
function topLevelProps(text, objOpen, objClose) {
  const props = [];
  let depth = 0;
  let atStart = true;
  for (let i = objOpen + 1; i < objClose; i++) {
    const next = skipToken(text, i);
    if (next !== i) {
      i = next - 1;
      continue;
    }
    const c = text[i];
    if (/\s/.test(c)) continue;
    if (depth === 0 && atStart) {
      atStart = false;
      if (text.startsWith('...', i)) {
        props.push({ spread: true });
        continue;
      }
      const m = /^(['"]?)([A-Za-z_$][\w$]*)\1\s*(:?)/.exec(text.slice(i));
      if (!m) return null;
      props.push({ name: m[2], valueStart: m[3] ? skipBlank(text, i + m[0].length) : -1 });
      i += m[0].length - 1;
      continue;
    }
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) atStart = true;
  }
  return props;
}

if (!dryRun) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  if (rootUpdate) writeFileSync(join(root, rootUpdate[0]), rootUpdate[1]);
}
process.stdout.write(`${JSON.stringify({ dryRun, ...result }, null, 2)}\n`);
