# Code and tests

## Code map

- `src/Pages/` — React screens and charts.
- `src/Model/` — domain facades, parsers, and shared types.
- `src/api/` — Vercel/server handlers and cache orchestration.
- `api/` — Vercel entrypoints that call `src/api/`.
- `src/**/*.test.ts` — Jest regression tests.

Keep parsing, aggregation, cache policy, and presentation separate. Add tests beside changed logic. Test malformed, empty, stale, unrelated, home, and away cases when relevant.

## Commands

This repo has no Docker Compose setup; run commands from repo root with installed dependencies:

```sh
npm test -- --watchAll=false
npm run build
```

Use a focused Jest name while iterating:

```sh
npm test -- --watchAll=false --runInBand -t "name"
```

Run both commands before handoff. A build catches TypeScript and production-bundle failures that tests may miss.

## Test shape

Arrange source data, act through the public function/handler, assert returned behavior. Prefer fixtures that reproduce the user report. For UI changes, assert configuration/data where practical, then verify rendering through E2E.
