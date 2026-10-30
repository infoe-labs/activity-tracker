# Project guidelines

- Use Node 22.12+ and npm with the committed lockfile.
- Preserve React/TypeScript, the local-first persistence contract, and subpath PWA support.
- Never seed production tracking sessions or introduce telemetry, remote fonts, accounts or cloud sync without explicit authorization.
- Store all timer operations immediately. Use atomic IndexedDB transactions, exact timestamps, and only one running session.
- Reject overlaps with a visible recovery path; never silently trim history.
- Schema/retention changes require a documented migration. Never clear unrelated origin storage or caches.
- Keep icons, chart colors, safe areas, keyboard access, themes and reduced-motion behavior consistent.
- Run npm test, npm run build and npm run test:e2e. Changes to paths, workers or manifests also require a non-root BASE_PATH build and offline browser test.
- Use synthetic test data. Do not put user content, credentials, personal identities, machine paths, raw errors or browser traces into tracked files or CI logs.
- Work through feature branches and pull requests once main exists. Never bypass branch protection or hooks.
- Use only the explicitly approved repository-local Git identity. Do not infer identity from GitHub login, global config or another repository.
- Review staged contents and outgoing commit metadata before publishing. Keep privacy hooks local under .git/hooks.
- Do not claim real iOS/Android installation was verified by Chromium automation.
