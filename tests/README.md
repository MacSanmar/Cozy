# Tests

Optional browser tests for the companion app. **The app itself stays
dependency-free with no build step** — nothing here ships to GitHub Pages, and
you never need to run these to use or deploy the app.

## Running

```sh
cd tests
npm install
npx playwright install chromium   # once
npm test
```

`npm test` starts a throwaway static server on `127.0.0.1:8087` and runs every
suite against it. To test something already running (a deploy, a preview):

```sh
COZY_URL=https://macsanmar.github.io/Cozy npm test
```

## Suites

| Suite | Covers |
|---|---|
| `01-core` | First-run welcome, tab navigation, lesson overlay, and the session timer: that it counts, survives a reload and a simulated backgrounding, keeps its notes, saves the full duration, and that history entries can be deleted |
| `02-backup-and-themes` | Export → wipe → import round-trip, Dutch date formatting, theme persistence, dark-theme contrast, and screenshots of both themes across all five tabs |
| `03-a11y-and-motion` | Keyboard operation and ARIA state on sound cards and palette swatches, clipboard copy with fallback, and that the particle loop pauses under `prefers-reduced-motion` while still drawing a still frame |
| `04-offline` | Service worker registration, loading with the network cut, reading stored progress offline, and network-first page fetches when online |
| `05-streaks` | The four streak states — safe, at risk, lapsed, and no history — including that a lapsed streak reports 0 rather than a stale count |
| `06-draw` | The drawing app (`index.html`): HiDPI backing store, drawing/undo/redo, that a drawing survives a reload, brush and size preferences persisting, macOS `Cmd+Z`/`Cmd+Shift+Z`, rapid music toggling not throwing, and the particle loop stopping when switched off or under reduced motion |
| `07-security` | Regressions for the four findings in the security review: a crafted backup must not execute or persist script, the schema must drop unknown lesson ids / invalid dates / out-of-range values while a valid backup still imports, oversized backups are rejected before parsing, service-worker activation preserves other apps' caches while cleaning its own, and navigation caching stays bounded and allowlisted |

Screenshots land in `tests/shots/` (gitignored).

## Notes

- `playwright` is pinned rather than ranged, because the package version must
  match the installed browser build.
- Suites are plain `.mjs` scripts with a tiny assertion helper — no test
  framework, to keep the tooling as light as the app.
