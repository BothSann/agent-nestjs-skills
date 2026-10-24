#!/usr/bin/env node
// Tests for scan-project.mjs. Run: node --test skills/nestjs-learn-pick-task/scripts/scan-project.test.mjs
// Builds a small fake NestJS repo in a temp folder, so the skill ships no fixture files.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'scan-project.mjs');
const temp = mkdtempSync(join(tmpdir(), 'nest-scan-'));
after(() => rmSync(temp, { recursive: true, force: true }));

const FILES = {
  'app/package.json': JSON.stringify({
    name: 'shop',
    scripts: { test: 'jest', 'test:e2e': 'jest --config ./test/jest-e2e.json' },
    dependencies: { '@nestjs/core': '^12.2.0', '@nestjs/config': '^5.0.0', '@nestjs/typeorm': '^12.0.0', typeorm: '^0.3.20', pg: '^8.0.0' },
    devDependencies: { jest: '^30.0.0', supertest: '^7.0.0' },
  }),
  'app/package-lock.json': '{}',
  'app/nest-cli.json': '{ "sourceRoot": "src" }',
  'app/src/main.ts': `
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
`,
  'app/src/app.module.ts': `
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate }), TypeOrmModule.forRoot({ synchronize: true })] })
export class AppModule {}
`,
  'app/src/common/check.ts': `
const pipeOptions = { forbidUnknownValues: true };
export const pipe = new ValidationPipe(pipeOptions);
export const options = { whitelist: true };
`,
  'app/src/users/users.controller.ts': `
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<{ id: string }> {
    return this.usersService.findOne(id);
  }

  @Version('2')
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: Request) {
    return req.user;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    throw new NotImplementedException();
  }
}
`,
  'app/src/users/users.service.ts': `
@Injectable()
export class UsersService {
  create(dto: CreateUserDto) {
    return 'This action adds a new user';
  }

  async findOne(id: string): Promise<User> {
    console.log('find', id);
    return this.repo.findOneBy({ id });
  }
}
`,
  'app/src/users/user-profile.entity.ts': '@Entity()\nexport class UserProfile {}\n',
  'app/src/users/user.entity.ts': "@Entity('users')\nexport class User {}\n",
  'app/src/modules/posts/posts.controller.ts': `
@Controller({ path: 'posts', version: '1' })
export class PostsController {
  constructor(private readonly posts: PostsService) {}
  @Get()
  findAll() { return this.posts.findAll(); }
}
`,
  'app/src/modules/posts/posts.service.ts': 'export class PostsService { findAll() { return this.repo.find(); } }\n',
  'app/src/migrations/1700000000000-Init.ts': 'export class Init1700000000000 implements MigrationInterface {}\n',
  'app/src/app.controller.spec.ts': "describe('AppController', () => { it('works', () => {}); });\n",
  'app/test/app.e2e-spec.ts': "describe('e2e', () => {\n  it('one', () => {});\n  test('two', () => {});\n});\n",
  'docs/scope.md': `# Scope

## 1. Users

| Method | Path | Auth | Does |
|---|---|---|---|
| POST | \`/api/v1/users\` | public | Sign up. |
| GET | \`/api/v1/users/{id}\` | user | One user. |
| GET | \`/api/v2/users/me\` | user | Me. |
| DELETE | \`/api/v1/users/:id\` | admin | Delete. |

## 2. Posts

- \`GET /api/v1/posts\`
- \`POST /api/v1/posts\`

## Build order

1. Users
2. Posts
`,
  'learn/learn.config.json': JSON.stringify({ appPath: 'app', buildOrderDoc: 'docs/scope.md', baseBranch: 'origin/main', shell: 'bash', baseUrl: 'http://localhost:3000/api/v1' }),
  'learn/01-scaffold-app/TICKET.md': '---\nid: L-01\nstatus: done\nkind: scaffold\n---\n\n# Ticket L-01: Scaffold\n',
  'learn/02-posts-list/TICKET.md': '---\nid: L-02\nstatus: in-progress\nkind: endpoint\nbranch: feat/posts-list\n---\n\n# Ticket L-02: Posts list\n',
  'home/.claude/skills/nestjs-best-practices/SKILL.md': '---\nname: nestjs-best-practices\nmetadata:\n  version: "1.4.0"\n---\n',
  'home/.claude/skills/nestjs-best-practices/rules/_template.md': '',
  'home/.claude/skills/nestjs-best-practices/rules/db-use-migrations.md': '',
  '.claude/rules/api.md': '# API rules\n',
  'merged.json': JSON.stringify([{ number: 5, headRefName: 'feat/posts-list' }]),
};

function makeRepo(name, files, commit = true) {
  const root = join(temp, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  mkdirSync(root, { recursive: true });
  const git = (...args) => spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  git('init', '-q');
  if (commit) {
    git('add', '-A');
    git('commit', '-qm', 'init');
  }
  return root;
}

const repo = makeRepo('shop', FILES);
const empty = makeRepo('empty', { 'learn/learn.config.json': '{ "appPath": ".", "baseBranch": "origin/main", "shell": "bash", "baseUrl": "http://localhost:3000" }' }, false);

function scan(root, extra = ['--no-gh']) {
  const result = spawnSync(process.execPath, [script, root, `--home=${join(root, 'home')}`, ...extra], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { json: JSON.parse(result.stdout), raw: result.stdout };
}

const short = (rows) => rows.map((r) => `${r.method} ${r.path}`);
const practice = (json, id) => json.practices.find((p) => p.id === id);

test('reads prefix and version from main.ts', () => {
  const { json } = scan(repo);
  assert.deepEqual(json.blockers, []);
  assert.equal(json.app.globalPrefix, 'api');
  assert.equal(json.app.versioning, 'uri');
  assert.equal(json.stack.orm, 'typeorm');
  assert.equal(json.stack.packageManager, 'npm');
});

test('builds full route paths and finds stubs, also through the service', () => {
  const { json } = scan(repo);
  const routes = json.routes.map((r) => `${r.method} ${r.path} ${r.stub}`);
  assert.deepEqual(routes, [
    'GET /api/v1/posts false',
    'POST /api/v1/users true',
    'DELETE /api/v1/users/:id true',
    'GET /api/v1/users/:id false',
    'GET /api/v2/users/me false',
  ]);
});

test('splits doc endpoints into done, stub, and missing', () => {
  const { json } = scan(repo);
  assert.deepEqual(short(json.endpoints.done), ['GET /api/v1/users/{id}', 'GET /api/v2/users/me', 'GET /api/v1/posts']);
  assert.deepEqual(short(json.endpoints.stubs), ['POST /api/v1/users', 'DELETE /api/v1/users/:id']);
  assert.deepEqual(short(json.endpoints.missing), ['POST /api/v1/posts']);
  assert.deepEqual(json.buildOrder.map((b) => b.title), ['Users', 'Posts']);
});

test('names tables like TypeORM does', () => {
  const { json } = scan(repo);
  assert.deepEqual(json.tables.map((t) => t.name), ['user_profile', 'users']);
  assert.deepEqual(json.migrations, ['app/src/migrations/1700000000000-Init.ts']);
});

test('checks ValidationPipe options in the call, not anywhere in the code', () => {
  const { json } = scan(repo);
  // `whitelist: true` sits in check.ts, but no ValidationPipe gets it.
  assert.equal(practice(json, 'validation-pipe').status, 'problem');
});

test('sees ConfigModule validate in shorthand form', () => {
  const { json } = scan(repo);
  assert.equal(practice(json, 'config-validation').status, 'ok');
});

test('flags open CORS, synchronize, console.log, and missing hooks', () => {
  const { json } = scan(repo);
  assert.equal(practice(json, 'cors').status, 'problem');
  assert.equal(practice(json, 'migrations').status, 'problem');
  assert.deepEqual(practice(json, 'logger').evidence, ['app/src/users/users.service.ts:9']);
  assert.equal(practice(json, 'shutdown-hooks').status, 'missing');
  assert.equal(practice(json, 'unit-tests').status, 'missing');
  assert.equal(practice(json, 'e2e-tests').status, 'ok');
});

test('counts tests', () => {
  const { json } = scan(repo);
  assert.equal(json.tests.unit.testCalls, 1);
  assert.equal(json.tests.e2e.testCalls, 2);
});

test('reads lessons and finds the best-practices skill', () => {
  const { json } = scan(repo);
  assert.deepEqual(json.lessons.map((l) => `${l.number}:${l.status}:${l.kind}`), ['1:done:scaffold', '2:in-progress:endpoint']);
  assert.equal(json.summary.nextLessonNumber, 3);
  assert.equal(json.qualitySources.bestPractices.version, '1.4.0');
  assert.equal(json.qualitySources.bestPractices.ruleCount, 1);
  assert.deepEqual(json.qualitySources.rules, [{ path: '.claude/rules/api.md', title: 'API rules' }]);
});

test('flags a lesson whose branch is already merged', () => {
  const { json } = scan(repo, [`--merged-prs=${join(repo, 'merged.json')}`]);
  assert.deepEqual(json.lessons.map((l) => l.mergedPr), [null, { number: 5, branch: 'feat/posts-list' }]);
  assert.deepEqual(json.summary.staleLessons, [2]);
});

test('same input gives the same output', () => {
  assert.equal(scan(repo).raw, scan(repo).raw);
});

test('an empty repo asks for a commit and the scaffold lesson', () => {
  const { json } = scan(empty);
  assert.deepEqual(json.blockers, ['no_commits', 'no_nest_app', 'no_build_order_doc', 'no_best_practices_skill']);
  assert.equal(json.summary.nextLessonNumber, 1);
});

// The six shared reference files are copied into each nestjs-learn-* skill.
// In this repo, all copies must match. Installed alone, the sibling skills are missing: skip.
test('shared reference files match in every nestjs-learn skill', (t) => {
  const skills = join(here, '..', '..');
  const names = ['nestjs-learn-pick-task', 'nestjs-learn-write-lesson', 'nestjs-learn-coach'];
  if (!names.every((name) => existsSync(join(skills, name)))) return t.skip('sibling skills not installed');
  for (const file of ['hard-rules.md', 'layout.md', 'project-config.md', 'code-quality.md', 'review-rules.md', 'voice.md']) {
    const [first, ...rest] = names.map((name) => readFileSync(join(skills, name, 'references', file), 'utf8'));
    for (const copy of rest) assert.equal(copy, first, `${file} differs between skills`);
  }
});
