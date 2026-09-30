# Deployment and E2E

## Preview

Push the branch; Vercel creates a preview. Obtain the URL from the GitHub/Vercel check or deployment output. Check availability first:

```sh
curl -fsSI "$PREVIEW_URL"
```

For API work, call the deployed endpoint directly and inspect status, shape, and representative records before opening the UI.

## Browser validation

Use `agent-browser` against the preview:

1. Open preview URL.
2. Snapshot page.
3. Authenticate only with user-provided test credentials when required; never record them.
4. Navigate to affected screen.
5. Snapshot after each state change.
6. Verify acceptance data, empty/loading/error states, and visual layout.
7. Capture a temporary screenshot only when visual comparison is needed; do not commit it.

For this app, validate the `Zápasy` page and `Historie výsledků`: all expected completed season matches, correct scores, no unrelated fixtures, and chart bars/tooltips. API correctness does not replace UI E2E.

## Handoff gate

Report ready only after tests, build, deployed HTTP check, deployed API check, and authenticated browser E2E pass. If any check fails, keep iterating and report the blocker, not success.
