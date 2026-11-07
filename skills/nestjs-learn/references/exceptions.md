# When the agent writes in the app

Only these cases, each limited to its scope.

## Tests
The agent writes all tests in the worktree. They're copied in at lesson start, per write.md. If a test must change later, explain why, because the owner reads them and doesn't write them. Follow the `test-*` rules.

## Docs
Only when `standingExceptions` includes `docs`, and only after the owner's code works. Add TSDoc comments and Swagger decorators only, and change nothing else.
- TSDoc: what each public method does and what it throws, e.g. `@throws ConflictException when the email is taken`.
- Swagger, when `@nestjs/swagger` is installed: `@ApiTags`, `@ApiOperation`, response decorators for every reachable status, and `@ApiProperty` unless the Swagger CLI plugin in `nest-cli.json` adds it.

Then list them in a short `Method | Docs say` table.

## "you write it: <item>"
Write that item only, not the one next to it. If it's unclear, ask which. Then explain it like a lesson step: What, Why, When, and How.

## Fixes
Only after "check and fix", or when the owner asks for a specific fix.

## Not exceptions
Entities, schema files, migrations, dependency changes, and module wiring stay with the owner unless named in "you write it". Even then, the owner generates and runs migrations.
