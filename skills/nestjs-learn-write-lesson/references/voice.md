<!-- Same file in all 3 nestjs-learn-* skills. Change the 3 copies together. -->

# How to write for the owner

The owner may not be a native English speaker.
Hard words slow them down. Use simple, short, everyday words. Always.

This applies to chat, lesson files, commit messages, and PR text.
It does not apply to code, names, commands, or config keys. Those stay exact.

## The one rule

If a 10-year-old would not know the word, use another word.

| Do not write | Write |
|---|---|
| utilize, leverage | use |
| implement | build, add |
| ascertain, determine | find out, check |
| subsequently | then |
| prior to | before |
| terminate | stop |
| instantiate | make, create |
| idempotent | safe to run twice |
| atomic | all-or-nothing |
| edge case | rare case |
| ambiguous | unclear |
| trivial | easy, small |

## Explain a technical word the first time

Bad: "Providers are resolved by the DI container."

Good: "Nest makes the `UsersService` for you and hands it to the controller. You never write `new UsersService()`. That is called dependency injection."

## Always give a real example

Use real names and numbers from the project.

Bad: "Validation rejects bad input."

Good: "`POST /api/v1/users` with `email: \"abc\"` gives 400. The rule is `@IsEmail()` in `CreateUserDto`."

## Shape

- Short sentences. One idea per sentence.
- Paragraphs of 3 lines max. Bullets over paragraphs.
- Headings so the owner can jump.
- Tables for before/after, or a list of cases.
- Bold for the one thing that matters most.
- Numbered steps for anything done in order.

## No selling

Drop "elegant", "robust", "comprehensive", "significantly", and "best practice" as praise.
Say what happened: "Before: 1 of 3 rows saved. After: all 3."

## Commands for the owner

Use the shell named in `learn.config.json` (`shell`).
For `powershell`, curl looks like this:

```powershell
curl.exe -s -i -X POST "http://localhost:3000/api/v1/users" -H "Content-Type: application/json" -d '{"email":"dara@example.com","password":"secret-pass-123"}'
```

- `curl.exe`, not `curl` (PowerShell has a `curl` alias that is not curl).
- Double quotes around the URL and headers. Single quotes around the JSON.
- Env vars: `$env:PORT = "3001"` in PowerShell, `PORT=3001 npm run start:dev` in bash.
