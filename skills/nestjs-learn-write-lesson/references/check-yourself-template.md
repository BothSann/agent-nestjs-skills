# check-yourself.md template

The quiz for the lesson. Each answer sits right under its question, hidden in a click-to-open box.
The owner reads the question, thinks, then opens the box. No switching between files.

```markdown
# Check yourself

Try each one before you open the answer.

1. Why does `create()` answer with `UserResponseDto` and not the `User` entity?

   <details><summary>Answer</summary>

   **DTO, not entity.** The entity has `passwordHash`. Send the entity, and the hash leaks. Add a column later, and that leaks too. `UserResponseDto` lists fields by name.

   </details>

2. What happens to `"role": "admin"` in the body, with `whitelist: true` and `forbidNonWhitelisted: true`?

   <details><summary>Answer</summary>

   **Refused.** `CreateUserDto` has no `role` field, so `ValidationPipe` answers 400 `property role should not exist`. The controller never runs.

   </details>

3. Trick question: is `findOneBy({ email })` before the insert enough to stop two users with one email?

   <details><summary>Answer</summary>

   **No, it is a trick.** Two requests at the same time both find nothing, then both insert. Only the unique index stops the second one. We catch its error (`23505`) and answer 409.

   </details>
```

## Rules

- 5–8 questions. At least one "what breaks if..." and one trick question.
- Answer: bold short label, then 1–4 sentences.
- Name the real class, method, decorator, or error string.
- For "what breaks" questions, give the exact error the owner would see (for example `Nest can't resolve dependencies of the UsersService (?)`).
- For trick questions, say it is a trick, then why.
- Keep a blank line after `<summary>...</summary>` and before `</details>`. Without it, Markdown inside the box does not render.
- Indent the `<details>` block under its number (3 spaces), so the list numbering keeps going.
