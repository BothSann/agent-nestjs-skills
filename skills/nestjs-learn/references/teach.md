# How to teach

Start with the everyday picture from boundaries.md. Show the idea in plain TypeScript first when it helps, then what Nest adds. Use this project's names and real output.

## Concepts ledger
`learn/concepts.md` holds each TypeScript, Node, and Nest idea once. Search headings with `grep`; don't read the whole file. Add an entry only the first time an idea appears, and link to it afterwards. Keep it plain and short:

````markdown
## Union narrowing (`if (user === null)`)
A type can say "one of these". After a check, TypeScript knows which one you have.
JS: the same `if`, but nothing warns you when you forget it.
```typescript
const user = await this.users.findByEmail(email);
if (user === null) throw new NotFoundException();
return user.id; // user is User here, not User | null
```
Trap: `if (!count)` is also true for `0`, so check `=== undefined` for absence.
Seen in: lesson 03
````

Common TypeScript traps to cover when they appear:
- Types vanish at runtime, so a `CreateUserDto` type alone checks nothing; `ValidationPipe` and class-validator do.
- `any` turns checking off; `unknown` forces a check first.
- An `async` call without `await` runs later, and its error goes unhandled.
- `as User` and `user!` silence the compiler without changing the value.
- `?.` stops at `null` or `undefined`; `??` replaces only those, while `||` also replaces `0` and `""`.
- `interface` disappears at runtime, so Nest can't inject by it; use a token.
- `this` inside a plain `function` callback isn't the class; arrow functions keep it.
- `Date` holds a moment in UTC; formatting picks a time zone.
- An optional `name?: string` and `name: string | undefined` differ under `exactOptionalPropertyTypes`.

## Open the magic once
| Magic | Show it with |
|---|---|
| Dependency injection | Log in a service constructor: it prints once at startup, not per request |
| Decorators | `@Get(':id')` is a function that runs when the class loads and stores metadata |
| `ValidationPipe` | Send a bad body: the 400 comes before the controller runs |
| Request order | Middleware, guards, interceptors before, pipes, handler, interceptors after, filters on error |
| Lifecycle | Log in `onModuleInit` and `onModuleDestroy`: startup and shutdown |
| Prisma | `log: ['query']` in the worktree shows the real SQL |

## Layers, the first time
| Layer | One line |
|---|---|
| `api` | Controllers and DTOs: read the request, call one use case, shape the answer |
| `application` | The steps of a use case, and the ports it needs |
| `domain` | Business rules with no Nest or database |
| `infrastructure` | Prisma repositories and outside clients |
| `contracts` | What other modules may import |
| Module | The box that lists what it `imports`, `provides`, and `exports` |

## Notes
For "explain in the learn folder", write `learn/notes/<idea>.md`: the question, an everyday picture, a plain answer, a small code sample, and one "try it" command. Link it from the lesson README.
