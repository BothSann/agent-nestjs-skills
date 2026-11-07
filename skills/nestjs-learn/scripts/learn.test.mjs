// Behaviour of learn.mjs and the nestjs-learn docs. Run: node --test skills/nestjs-learn/scripts/learn.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanup, run, scan } from './learn.mjs';

const SKILL = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = join(SKILL, '..', 'nestjs-best-practices', 'rules');
const SCRIPT = join(SKILL, 'scripts', 'learn.mjs');

const PACKAGE = JSON.stringify({
  name: 'demo',
  packageManager: 'pnpm@10.0.0',
  scripts: { build: 'nest build', test: 'vitest run', lint: 'eslint .' },
  dependencies: { '@nestjs/core': '^12.0.1', '@prisma/client': '7.10.1' },
  devDependencies: { vitest: '^4.1.2' },
});
const MAIN = `import { NestFactory } from '@nestjs/core';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
`;
const CONTROLLER = `@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.posts.findOne(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreatePostDto) {
    return this.posts.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    throw new NotImplementedException();
  }
}
`;
const SERVICE = `@Injectable()
export class PostsService {
  async findOne(id: string) {
    return { id };
  }

  create(dto: CreatePostDto) {
    return 'This action adds a new post';
  }
}
`;
const PLAN = `# Plan

| Method | Path | Auth |
|---|---|---|
| GET | \`/api/v1/posts/{id}\` | user |
| POST | \`/api/v1/posts\` | user |
| GET | \`/api/v1/feed\` | user |

\`\`\`text
GET /api/v1/ignored-example
\`\`\`

## Build order
1. Identity
2. Posts
`;
const GUIDE = `# Guide: x

## The big idea
Idea.

## Step 1: First
What: one.

## Step 2: Second
What: two.

## Finish
Gates.
`;

const learn = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const git = (cwd, ...args) => {
  const done = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8' });
  assert.equal(done.status, 0, done.stderr);
};
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const collect = () => {
  const lines = [];
  return { lines, io: { out: (l) => lines.push(l), err: (l) => lines.push(`ERR ${l}`) }, text: () => lines.join('\n') };
};

let tmp;
let repo;
beforeEach(() => {
  tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'nestjs-learn-')));
  repo = join(tmp, 'repo');
  mkdirSync(repo);
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function makeApp(root = 'apps/api') {
  const app = join(repo, root);
  write(join(app, 'package.json'), PACKAGE);
  write(join(app, 'src', 'main.ts'), MAIN);
  write(join(app, 'src', 'modules', 'posts', 'api', 'posts.controller.ts'), CONTROLLER);
  write(join(app, 'src', 'modules', 'posts', 'application', 'posts.service.ts'), SERVICE);
  return app;
}
function commit() {
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
}
function scanOut() {
  const result = learn('scan', repo, '--no-gh');
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

describe('scan', () => {
  test('empty folder reports blockers for a scaffold', () => {
    const out = scanOut();
    assert.match(out, /blocker: no_git/);
    assert.match(out, /blocker: no_config/);
    assert.match(out, /blocker: no_nest_app/);
    assert.match(out, /next lesson number: 01/);
  });

  test('repo without commits is reported', () => {
    git(repo, 'init', '-q');
    assert.match(scanOut(), /blocker: no_commits/);
  });

  test('monorepo finds the api and ignores the frontend', () => {
    makeApp();
    write(join(repo, 'apps', 'web', 'package.json'), JSON.stringify({ dependencies: { next: '16' } }));
    write(join(repo, 'apps', 'web', 'src', 'x.controller.ts'), "@Controller('web') export class W { @Get() a() {} }");
    const out = scanOut();
    assert.match(out, /app: apps\/api/);
    assert.match(out, /stack: pnpm, vitest, prisma, express, nest \^12\.0\.1/);
    assert.doesNotMatch(out, /\/web/);
  });

  test('several apps ask, and a configured appRoot wins', () => {
    makeApp('apps/one');
    makeApp('apps/two');
    assert.match(scanOut(), /blocker: several_apps apps\/one, apps\/two/);
    write(join(repo, 'learn', 'learn.config.json'), JSON.stringify({ appRoot: 'apps/two' }));
    const out = scanOut();
    assert.match(out, /app: apps\/two/);
    assert.doesNotMatch(out, /several_apps/);
  });

  test('routes carry prefix and version, stubs follow the service call, and plan coverage', () => {
    makeApp();
    write(join(repo, 'docs', 'plan.md'), PLAN);
    write(join(repo, 'learn', 'learn.config.json'), JSON.stringify({ appRoot: 'apps/api', planDoc: 'docs/plan.md' }));
    const out = scanOut();
    assert.match(out, /route GET \/api\/v1\/posts\/:id src\/modules\/posts\/api\/posts\.controller\.ts:5\n/);
    assert.match(out, /route POST \/api\/v1\/posts \S+ STUB/);
    assert.match(out, /route DELETE \/api\/v1\/posts\/:id \S+ STUB/);
    assert.match(out, /module posts: api, application/);
    assert.match(out, /endpoints: 1 done, 1 stub, 1 missing/);
    assert.match(out, /missing: GET \/api\/v1\/feed/);
    assert.doesNotMatch(out, /ignored-example/);
    assert.match(out, /plan: Identity/);
  });

  test('prefix and version set in a shared setup function still apply', () => {
    const app = makeApp();
    write(join(app, 'src', 'main.ts'), 'configureApp(app);\nawait app.listen(3000);\n');
    write(join(app, 'src', 'shared', 'api', 'configure-app.ts'), MAIN);
    assert.match(scanOut(), /route GET \/api\/v1\/posts\/:id /);
  });

  test('extra docs add endpoints', () => {
    makeApp();
    write(join(repo, 'docs', 'rules.md'), 'Users may `GET /api/v1/feed`, `GET /api/v1/me`, and `GET /api/v1/posts/:id?expand=`.\n');
    write(join(repo, 'learn', 'learn.config.json'), JSON.stringify({ docs: ['docs/rules.md'] }));
    assert.match(scanOut(), /endpoints: 1 done, 0 stub, 2 missing/);
  });

  test('hints name a real rule', () => {
    makeApp();
    const out = scanOut();
    assert.match(out, /ValidationPipe without whitelist: true \[security-validate-all-input\]/);
    assert.match(out, /no guard .*\[security-use-guards\]/);
    assert.match(out, /no tests beyond the starter \[test-use-testing-module\]/);
    for (const [, rule] of out.matchAll(/\[([a-z0-9-]+)\]/g)) assert.ok(existsSync(join(RULES, `${rule}.md`)), rule);
  });

  test('a whitelisted pipe, a guard, and real tests silence the hints', () => {
    const app = makeApp();
    write(join(app, 'src', 'main.ts'), MAIN.replace('new ValidationPipe()', 'new ValidationPipe({ whitelist: true })'));
    write(join(app, 'src', 'app.module.ts'), 'providers: [{ provide: APP_GUARD, useClass: AuthGuard }]');
    write(join(app, 'src', 'modules', 'posts', 'posts.service.spec.ts'), "test('x', () => {})");
    assert.doesNotMatch(scanOut(), /hint:/);
  });

  test('RouterModule is flagged', () => {
    const app = makeApp();
    write(join(app, 'src', 'app.module.ts'), "RouterModule.register([{ path: 'admin', module: AdminModule }])");
    assert.match(scanOut(), /blocker: router_module/);
  });

  test('invalid config stops', () => {
    write(join(repo, 'learn', 'learn.config.json'), '{nope');
    assert.equal(learn('scan', repo, '--no-gh').status, 2);
  });

  test('a 1.x config is flagged and still scanned', () => {
    makeApp();
    write(join(repo, 'learn', 'learn.config.json'), JSON.stringify({ appPath: 'apps/api', buildOrderDoc: 'docs/plan.md', orm: 'prisma' }));
    write(join(repo, 'docs', 'plan.md'), PLAN);
    const out = scanOut();
    assert.match(out, /blocker: old_config appPath, buildOrderDoc, orm/);
    assert.match(out, /app: apps\/api/);
    assert.match(out, /plan: Identity/);
  });

  test('lessons, next number, and concepts', () => {
    write(join(repo, 'learn', '03-posts', 'TICKET.md'), '---\nstatus: in-progress\nkind: endpoint\nbranch: feat/posts\n---\n');
    write(join(repo, 'learn', '01-a', 'TICKET.md'), '---\nstatus: done\nkind: scaffold\n---\n');
    write(join(repo, 'learn', 'concepts.md'), '## Union narrowing\n\n## await\n');
    const out = scanOut();
    assert.match(out, /lesson 03-posts: in-progress, endpoint/);
    assert.doesNotMatch(out, /01-a/);
    assert.match(out, /lessons finished: 1/);
    assert.match(out, /next lesson number: 04/);
    assert.match(out, /concepts seen: 2/);
  });

  test('scan changes nothing', () => {
    makeApp();
    commit();
    const status = () => spawnSync('git', ['status', '--porcelain', '--ignored'], { cwd: repo, encoding: 'utf8' }).stdout;
    const before = status();
    scanOut();
    assert.equal(status(), before);
  });

  test('a merged in-progress lesson is reported', () => {
    write(join(repo, 'learn', '02-x', 'TICKET.md'), '---\nstatus: in-progress\nkind: endpoint\nbranch: feat/x\n---\n');
    const { io, text } = collect();
    const fake = (args, cwd) => (args[0] === 'gh' ? [0, '[{"number":12}]'] : run(args, cwd));
    scan(repo, true, fake, io);
    assert.match(text(), /lesson 02-x: in-progress, endpoint, merged PR #12/);
  });
});

describe('guide', () => {
  test('step prints only that step', () => {
    write(join(tmp, 'GUIDE.md'), GUIDE);
    const first = learn('step', join(tmp, 'GUIDE.md'), '1').stdout;
    assert.match(first, /What: one\./);
    assert.doesNotMatch(first, /two/);
    const last = learn('step', join(tmp, 'GUIDE.md'), '2').stdout;
    assert.match(last, /What: two\./);
    assert.doesNotMatch(last, /Gates/);
  });

  test('missing step says how many exist', () => {
    write(join(tmp, 'GUIDE.md'), GUIDE);
    const result = learn('step', join(tmp, 'GUIDE.md'), '9');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /steps up to 2/);
  });

  test('size limits fail', () => {
    const guide = join(tmp, 'GUIDE.md');
    write(guide, GUIDE);
    assert.equal(learn('guide-size', guide).status, 0);
    write(guide, Array.from({ length: 7 }, (_, n) => `## Step ${n + 1}: s\nx\n`).join(''));
    assert.equal(learn('guide-size', guide).status, 1);
    write(guide, `## Step 1: s\n${'x'.repeat(15000)}`);
    assert.equal(learn('guide-size', guide).status, 1);
  });

  test('bad arguments are an error', () => {
    assert.equal(learn('step', join(tmp, 'nope.md'), '1').status, 2);
    assert.equal(learn('nope').status, 2);
  });
});

describe('cleanup', () => {
  function lesson(slug, worktree, status = 'done') {
    write(join(repo, 'learn', slug, 'TICKET.md'), `---\nstatus: ${status}\nkind: endpoint\nbranch: feat/x\n---\n`);
    write(join(repo, 'learn', slug, 'README.md'), `# L\n\n- Worktree: ${worktree}\n`);
  }
  function prepared() {
    write(join(repo, 'a.txt'), 'a');
    write(join(repo, '.gitignore'), 'learn/\n');
    commit();
    const path = join(tmp, 'repo-lessons', '01-x');
    git(repo, 'worktree', 'add', '-q', '--detach', path, 'HEAD');
    lesson('01-x', path);
    return path;
  }

  test('unknown merge state keeps the worktree', () => {
    const path = prepared();
    assert.match(learn('cleanup', repo, '--no-gh').stdout, /merge state unknown/);
    assert.ok(existsSync(path));
  });

  test('abandoned removes the worktree and empty parent, but keeps docs', () => {
    const path = prepared();
    write(join(path, 'node_modules', 'x.txt'), 'untracked');
    const result = learn('cleanup', repo, '--no-gh', '--abandoned', '01-x');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(!existsSync(path));
    assert.ok(!existsSync(dirname(path)));
    assert.ok(existsSync(join(repo, 'learn', '01-x', 'README.md')));
    assert.ok(existsSync(join(repo, 'a.txt')));
  });

  test('dry run removes nothing', () => {
    const path = prepared();
    assert.match(learn('cleanup', repo, '--no-gh', '--abandoned', '01-x', '--dry-run').stdout, /would remove/);
    assert.ok(existsSync(path));
  });

  test('never removes paths that are not its worktree', () => {
    prepared();
    const stranger = join(tmp, 'stranger');
    write(join(stranger, 'keep.txt'), 'mine');
    lesson('02-y', stranger);
    lesson('03-z', repo);
    learn('cleanup', repo, '--no-gh', '--abandoned', '02-y');
    learn('cleanup', repo, '--no-gh', '--abandoned', '03-z');
    assert.ok(existsSync(join(stranger, 'keep.txt')));
    assert.ok(existsSync(join(repo, 'a.txt')));
  });

  test('unknown abandoned name is an error', () => {
    prepared();
    assert.equal(learn('cleanup', repo, '--no-gh', '--abandoned', 'nope').status, 2);
  });

  // The real gh isn't run here: these stub its output, shaped as gh returns it.
  const stubbed = (code, output) => (args, cwd) => (args[0] === 'gh' ? [code, output] : run(args, cwd));

  test('a merged PR removes the worktree', () => {
    const path = prepared();
    assert.equal(cleanup(repo, null, false, true, stubbed(0, '[{"number":12}]'), collect().io), 0);
    assert.ok(!existsSync(path));
  });

  test('an unmerged PR keeps the worktree', () => {
    const path = prepared();
    assert.equal(cleanup(repo, null, false, true, stubbed(0, '[]'), collect().io), 0);
    assert.ok(existsSync(path));
  });

  test('gh failure or bad output keeps the worktree', () => {
    const path = prepared();
    for (const [code, output] of [[1, 'not logged in'], [0, 'not json'], [127, 'no gh']]) {
      assert.equal(cleanup(repo, null, false, true, stubbed(code, output), collect().io), 0);
      assert.ok(existsSync(path));
    }
  });
});

describe('docs', () => {
  const docs = () => [join(SKILL, 'SKILL.md'), ...readdirSync(join(SKILL, 'references')).map((n) => join(SKILL, 'references', n))];

  test('every rule named in check.md exists', () => {
    const text = readFileSync(join(SKILL, 'references', 'check.md'), 'utf8');
    const section = text.split('## Rule files')[1].split('## Checks that have no rule file')[0];
    const names = [...section.matchAll(/^\| [^|]+ \| ([a-z0-9, -]+) \|\r?$/gm)].flatMap((m) => m[1].split(',').map((n) => n.trim()));
    assert.ok(names.length > 40, String(names.length));
    for (const name of names) assert.ok(existsSync(join(RULES, `${name}.md`)), name);
  });

  test('every rule is reachable from check.md except operational ones', () => {
    const text = readFileSync(join(SKILL, 'references', 'check.md'), 'utf8');
    const allowed = new Set(['devops-docker-and-dependencies']);
    for (const name of readdirSync(RULES).filter((n) => n.endsWith('.md') && !n.startsWith('_'))) {
      const stem = name.slice(0, -3);
      if (!allowed.has(stem)) assert.ok(text.includes(stem), stem);
    }
  });

  test('relative links resolve', () => {
    for (const path of docs()) {
      for (const [, target] of readFileSync(path, 'utf8').matchAll(/\]\(([^)#:]+\.md)\)/g)) {
        assert.ok(existsSync(join(dirname(path), target)), `${path}: ${target}`);
      }
    }
  });

  test('stuck cue, lesson-db, and old skill names stay out', () => {
    for (const path of docs()) {
      const text = readFileSync(path, 'utf8');
      assert.doesNotMatch(text, /\*\*stuck\*\*|"stuck"|lesson-db|nestjs-learn-(?:pick-task|write-lesson|coach)/, path);
    }
  });
});

// Only in a repository checkout: an installed copy has no scripts/ folder or js-tiktoken.
const CHECK_TOKENS = join(SKILL, '..', '..', 'scripts', 'check-tokens.mjs');
const TIKTOKEN = join(SKILL, '..', '..', 'scripts', 'node_modules', 'js-tiktoken');
test('every skill stays within its token budget', { skip: !(existsSync(CHECK_TOKENS) && existsSync(TIKTOKEN)) && 'needs a repository checkout with scripts/ installed' }, () => {
  const r = spawnSync(process.execPath, [CHECK_TOKENS], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
