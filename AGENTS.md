# Agent instructions

- This is a React/TypeScript app with Vercel functions in `src/api/`.
- Use `npm start` for development and `npm run build` before finishing code changes.
- Preserve existing behavior and make focused changes; do not overwrite unrelated work.
- Treat Vercel and Firebase data as production. Default diagnostics to read-only.
- Never print, persist, or commit credentials, tokens, user records, or email addresses.
- Do not trigger emails or other production writes without explicit user approval.
- Keep cron logs concise and limited to aggregate, non-sensitive data.
