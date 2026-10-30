# Still — Time well spent

A calm, mobile-first productivity activity tracker. Start with one tap, switch
without stopping, and see where your time goes. No account or backend required.

Built with React, strict TypeScript, Vite, Tailwind CSS v4, shadcn/ui buttons and accessible Radix
dialog primitives, Lucide, Dexie/IndexedDB, Recharts and vite-plugin-pwa.
Adapted from PWA Base Layer. All runtime assets are bundled locally.

## Build and run

Requires **Node.js 22.12 or newer** and npm. Use the version in .nvmrc.

```sh
npm ci
npm run dev
```

Create and preview the production build:

```sh
npm run build
npm run preview
```

Build output is in **dist/**. Only deploy that directory.

### Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests use the production build on port 4173. Build first.
To test deployment under a repository subpath:

```sh
BASE_PATH=/activity-tracker/ npm run build
BASE_PATH=/activity-tracker/ npm run test:e2e
```

Unit tests cover timer recovery, atomic switching, concurrent taps, clock reversal,
overlap handling, editing, backup validation, archived associations, overnight
splitting and calendar ranges. Browser tests cover tracking, refresh recovery,
manual edits, export, presentation and offline reload.

## Using Still

- **Today:** tap an activity to start; tap a different one to save and switch at
  the exact same timestamp. Repeated taps on the running activity do nothing.
- **Log time:** enter local start/end dates and times. Overnight sessions use
  the following date for the end. Duration can also be adjusted in minutes.
- **History:** choose a day, inspect time blocks and gaps, and tap entries to edit.
- **Analytics:** choose a period, inspect five chart types, filter activities,
  focus trends, expand a report or save/share a PNG.
- **Settings:** customize names, colors, icons, favorites and order; archive
  activities; change theme/time format; export or restore data.

Conflicting sessions are rejected with a clear explanation. Adjust the proposed
times or edit/delete the conflicting historical entry first. No history is
silently trimmed. Future manual entries are rejected. Destructive changes require
confirmation. Activities with historical sessions are archived instead of removed.

## Analytics and image exports

Distribution (pie/donut), daily stacked bars, trends, time-of-day patterns and
activity ranking all use actual IndexedDB sessions, including a running timer.
No demo sessions are seeded. Excluding activities recalculates percentages using
only included tracked time. Averages include all days in the selected range.

Durations are timestamp differences, clipped to range boundaries and split at
local calendar midnights. Daylight-saving days may contain 23 or 25 hours. The
current device timezone determines day boundaries; stored instants never change.
Native local-time inputs use the browser's interpretation of a repeated DST hour.
Overlapping intervals are prevented on save and rejected on restore.

Presentation mode hides navigation and unrelated controls. PNG reports are composed
locally with Canvas, separately from the UI, at 1080×1920, 1080×1080 or 1920×1080.
Long legends/date ranges grow the report to avoid clipping. The app-name footer is
off by default. Web Share is used where file sharing is available; download is the
fallback. Browser activation rules can require using Download and sharing the
resulting file manually. No remote rendering service is used.

## Local data and backups

Activities and sessions persist in version-1 IndexedDB until explicitly deleted
or replaced. Theme and time format are in localStorage. Storage identifiers
include the app ID, deployment base path, feature and schema version. Keep app ID
and base stable after launch. Future migrations must validate and transact
conversion before deleting old records; unsupported backup versions are rejected.

**Browser storage can be cleared or evicted. Keep JSON backups.** Settings offers
validated JSON export/atomic restore, CSV export, optional persistent-storage
permission and confirmed tracking-data deletion. Persistent-storage permission
is not a backup. Deletion clears only this app's tracking tables and restores
default activities; it preserves preferences, app assets and unrelated apps.

JSON includes activities, notes, timestamps and the active session. CSV includes
timestamps, duration in seconds and notes, with spreadsheet-formula escaping.
Downloaded files contain your data; keep them appropriately protected.
Storage is not encrypted, and same-origin apps share storage permissions/quotas.
Namespaces prevent collisions, not access by scripts on the same origin.

There is no cloud sync, telemetry, authentication, external font, or runtime API.
The static hosting provider receives ordinary requests for app assets.

## Offline and installation

The production service worker precaches revisioned application assets only.
Use the app online once and wait for **Offline shell ready** in Settings.
After that, tracking and all analytics work offline, including after a reload.
Development mode intentionally has no service worker.

- **Android:** use Settings → Install Still when available, or the browser's
  Install app menu.
- **iPhone/iPad:** open in Safari → Share → Add to Home Screen, enabling
  Open as Web App when offered.
- **Desktop:** use the browser's install option.

Updates wait for **Settings → Update and reload**. Finish open edits first.
Manifest paths, standalone start URL, worker scope and assets respect BASE_PATH.
Actual Android/iOS installation, OS termination, Safari file sharing, safe areas
and updates still need real-device release checks; Chromium automation cannot
verify operating-system installation.

## GitHub Pages

The included **Test and deploy Pages** workflow validates pull requests and deploys
trusted main after tests pass.

1. Push the source to your GitHub repository.
2. Under **Settings → Pages**, select **GitHub Actions** as the source.
3. Merge passing changes into main, or manually run the workflow.
4. Open the deployment URL shown by Actions/Pages.

The workflow automatically infers /repository-name/ for project repositories
and / for repositories ending in .github.io. For a custom domain, set repository
Actions variable **BASE_PATH** to /. Other paths must begin and end with /.
For a local project-path build:

```sh
BASE_PATH=/activity-tracker/ npm run build
```

Use required pull requests and required passing build checks on main, admin
enforcement, resolved conversations, linear history, no force pushes and no branch
deletion. Workflow tokens default to read-only; Pages/id-token writes are isolated
to deployment. Do not weaken existing rules to enable publishing.

## Source map

| Location                                      | Responsibility                                  |
| --------------------------------------------- | ----------------------------------------------- |
| src/lib/db.ts                                 | Atomic timer operations, storage and restore    |
| src/lib/model.ts                              | Types, validation, timestamps and duration math |
| src/lib/analytics.ts                          | Date ranges and analytics calculations          |
| src/lib/chart-export.ts                       | High-resolution standalone PNG rendering        |
| src/components/Analytics.tsx                  | Lazy-loaded interactive charts and presentation |
| src/components/Sheet.tsx                      | Accessible focus-managed modal sheets           |
| src/lib/pwa.js, src/lib/install.js, src/sw.js | Offline shell, updates and installation         |
| tests/                                        | Synthetic unit and production-browser tests     |
| scripts/generate-icons.py                     | Optional icon regeneration using Pillow         |

No paid services, database server or backend are required.
