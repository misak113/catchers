# Match data

## Source path

PSMF team history is parsed in `src/Model/psmfMatchHistoryParser.ts`, aggregated and cached by `src/api/psmf-match-history.ts`, exposed by `api/psmf-match-history.js`, and consumed by `src/Pages/Matches.tsx`.

PSMF uses separate tables:

- `games-old-table` — completed matches.
- `games-new-table` — upcoming/current fixtures.

A fixture belongs in Catchers history only when Catchers is one of its teams. Keep home/away score orientation explicit: `score.home` is home goals and `score.guest` is away goals.

## Debug order

1. Fetch raw PSMF HTML and inspect both tables.
2. Test parser output, including completed rows and home/away orientation.
3. Test final Catchers-only filtering before cache writes.
4. Inspect API payload and cache version/refresh behavior.
5. Inspect UI mapping and chart datasets.

When cache shape changes or old data can be wrong, bump the cache version and test stale-cache invalidation. Cache serialization must contain only Firestore-safe values. Never repair production data by writing ad hoc records without explicit approval.

## Chart contract

Scored goals are positive; conceded goals are negative. Both datasets use one category per match and must render at the same horizontal level (`grouped: false`). Tooltips and labels may display absolute values.
