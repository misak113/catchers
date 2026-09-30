# Development workflow

## Before coding

- Confirm repository: `git rev-parse --show-toplevel`.
- Read `README.md`, `AGENTS.md`, this index, and only relevant docs.
- Start from clean `master` unless user explicitly selects another branch.
- Turn request into acceptance checks: data, UI, API, and deployment behavior.
- For 3+ steps, keep a short plan in session state, not in the repo.

## Iterate

1. Reproduce the reported behavior locally or against the deployed preview.
2. Trace the complete path: source → parser/transform → cache/API → UI.
3. Add a regression test before or with the fix.
4. Make focused changes; avoid unrelated refactors.
5. Run targeted tests, then production build.
6. Deploy preview and validate the real API and UI.
7. Repeat until acceptance checks pass. Do not call work ready after local tests alone.

## Change hygiene

- TypeScript strict; no `any`, unsafe assertions, or secrets.
- Preserve existing behavior outside requested scope.
- Use US English and existing project style.
- Update docs only when behavior or workflow changes.
- Use direct-to-`master` only when explicitly requested; otherwise use a short feature branch.
