# Secrets and external access

- Workspace secrets file: `.env.secrets` (at workspace root; locate it from the current workspace).
- GitHub HTTPS operations use `PERSONAL_GITHUB_TOKEN` from that file when prompts are unavailable.
- Read the value only into the command environment; never print, commit, paste, or put it in a URL saved to disk.
- Use user-provided test credentials only for browser E2E. Never document or persist them.
- Firebase/Vercel keys belong in local environment configuration (`.env*` ignored by Git), not source or docs.
- If required access is missing, ask for only that credential. Do not guess or weaken security.
