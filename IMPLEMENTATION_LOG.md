# Implementation log

## 2026-11-02 — T020 scoped scene edits and checkpoint rollback

| Area | Result |
|---|---|
| Scoped edit | Build & preview → Scenes: edit one scene (heading, body, eyebrow, items, CTA, 3D object, text alternative). Only that scene changes (other scenes byte-identical), the whole StorySpec is re-validated, and an "Edited …" version is recorded |
| Rollback | Restore any version from the Versions list; the current spec is snapshotted first, so the edit stays in history |
| Storyboard stays in step | Edits and restores are synced into the storyboard by scene ID, so approving the storyboard again can no longer silently revert a scoped edit or resurrect a rolled-back one. Storyboard `body`/`visualNote` limits raised to the StorySpec's (4000/1000) so the sync is lossless |
| Storyboard scene types | Storyboards can add scroll-reveal, model-showcase, gallery and CTA scenes; reordering keeps scene IDs stable |

Verification: 180/180 unit tests (approve → edit → re-approve → restore covered in the creative integration test; round-trip test in story-engine) · desktop E2E 17/17, M3 spec now also rolls back through the UI and checks the storyboard.

Limits: restoring a version with a different scene structure (added/removed/reordered scenes) syncs text by ID but does not reshape the storyboard.

## 2026-11-02 — T019 live preview: reduced motion and runtime errors

Already in place before this slice: device presets (desktop/tablet/mobile with scale-to-fit), build-failure overlay with retry, scroll-to-scene, out-of-date marker.

| Added | Result |
|---|---|
| Reduced-motion preview | Toolbar toggle + **View → Preview with Reduced Motion** checkbox. Real media emulation of the preview frame from the main process (ADR-010 addendum), applied live without reload and before page scripts on reload; works for both HTML and React exports, which are not modified |
| Runtime error overlay | Uncaught exceptions, `console.error`, failed loads (HTTP ≥ 400, network errors, ORB-blocked missing files) and the export's own CSP violations are shown in a dismissible panel docked over the stage; the page stays usable. Cleared on reload, filtered to the visible preview, capped at 50 with a dropped count |
| Contracts | `preview.setMotion`, `preview.issues`, `MenuState.reducedMotion`, menu command `preview.reducedMotion` |

Verification (macOS arm64, Node 23.7 — Node 24 not installed on this machine): typecheck pass · 179/179 unit tests (11 new for `PreviewInspector`) · license gate passed · desktop E2E 17/17 including the new T019 spec (emulation checked via `matchMedia` and the HTML runtime's `data-motion` in both targets; a broken script and missing image injected into the HTML output surface in the panel) · export browser suite 46/46 (Chromium, WebKit).

Findings while building: OOPIF targets attach with an empty URL, so URLs are learned from `Target.targetInfoChanged`; resuming a paused OOPIF without `Runtime.enable` leaves it blank; Chromium sends failed loads only through the `Network` domain, not `Log`; the HTML export's CSP correctly blocked an injected inline script. The committed M2 E2E still expected positional scene IDs after reorder, which the (earlier, uncommitted) stable-ID storyboard change replaced; assertion updated to `#chapter-02`.

Not done / limits: Firefox and Windows/Linux not run locally; no element picking in the preview ("click element → source", S08) yet; issues are not linked to scenes; workers inside the preview are not inspected (no nested auto-attach).

## 2026-11-02 — M2 creative workflow (T011–T015)

| Ticket | Result |
|---|---|
| T011 Idea intake + visual questions | One question at a time (4 total), 2–4 illustrated options, **Skip** and **You decide**, change any answer later |
| T012 Reference URL analysis | `@studio/reference-analyzer`: SSRF policy (IPv4 blocklist, IPv6 global-unicast allowlist with embedded-IPv4 normalisation), re-vetted on every redirect with the socket pinned to the vetted IP, size/time/redirect caps, linear-time HTML extraction; observations carry confidence and source; rights notice on every report. Screenshots render in an in-memory Electron session where every request is re-vetted, permissions/downloads/popups are denied |
| T013 Creative brief + approval | Five original art directions (contrast verified in tests), editable audience/tone/motion/chapters/notes; editing an approved brief requires re-approval |
| T014 Storyboard + scene cards | Hero + chapters, edit copy and text alternatives, reorder with buttons (no drag-only), add/remove; approval writes the StorySpec and records a "Storyboard approved" version |
| T015 Story agent with structured output | Default **local planner** (deterministic structure, labelled starter text — no AI). Opt-in **Claude Code CLI** planner: documented `-p --output-format json` mode, all tools disabled, no MCP, no session persistence, empty temp cwd, prompt via stdin, references wrapped as untrusted data, schema-validated with one corrective retry, sanitised (control/bidi characters removed). Live smoke test against the installed CLI succeeded (5 s) |

Verification: typecheck pass · 163/163 unit tests · license gate passed · browser suite 30/30 · desktop E2E 8/8 including idea → discovery → brief → storyboard → approve → HTML and React preview of the edited copy.

Security review follow-up: an automated review of the first analyzer commit flagged ReDoS-prone regexes and an incomplete IPv6 blocklist; both fixed in d03f82c with tests.

Not done / limits: no vision analysis of screenshots (observations come from HTML/CSS only); reference analysis has no positive E2E (it needs the internet) — covered by unit tests with a fake fetcher plus the SSRF suite; Claude drafting is not exercised in E2E to avoid spending the user's plan.

## 2026-11-01 — M1 product foundation (T006–T010)

Started at the user's explicit request while M0's Firefox/Windows/Linux verification is still pending CI.

| Ticket | Result |
|---|---|
| T006 Project storage | `@studio/storage` on Node's bundled `node:sqlite` (no native modules → same code on macOS/Windows/Linux/ChromeOS), versioned schema with refusal of newer databases; create project from name + idea (`@studio/story-engine` starter spec, safe unique IDs), recent ordering, immutable hash-verified snapshots, restore that first snapshots the current spec |
| T007 Provider registry/settings | Probe results persisted; Providers screen shows install state/version and states plainly that AI generation is off pending terms review |
| T008 Skill registry | `@studio/skills`: strict frontmatter subset parser, per-file SHA-256 content hash, `skills/skills.lock.json` pinning, modified skills auto-disabled, scripts disabled until approved, symlinks/oversize rejected, metadata-first selection (≤4 skills); Skills screen |
| T009 Shell, job/log panel | Navigation (projects, new project, settings), versions inspector, jobs and log lines persisted with interrupted-job recovery after crashes |
| T010 StorySpec migrations | Migration registry with cycle/version checks; all disk reads go migrate → validate |

Verification: typecheck pass · 101/101 unit tests · license gate passed (102/159/1) · browser suite 30/30 (Chromium, WebKit) · desktop E2E 7/7 including create → generate → restart → persisted log and preview.

Fixes found during M1: job "started" event now precedes any log line (FK ordering); the single-instance lock no longer blocks a development workspace (`STUDIO_WORKSPACE`) from running beside the user's studio.

Notes: the four studio skills were pinned as "repository blueprint (studio-original, markdown only)" — a maintainer should re-pin under their own name after reading them. StorySpec editing UI arrives with M3 (scoped edits), so restore is exercised through unit tests rather than UI edits.

## 2026-11-01 — M0 technical spike (T001–T005)

### Scope delivered
| Ticket | Result |
|---|---|
| T001 Electron/React/TS pnpm monorepo, typed IPC | `apps/desktop` (main ESM, 765-byte sandboxed preload, React renderer on `app://studio`), 7 Zod-validated IPC channels, request **and** response validation, top-frame-only sender check |
| T002 HTML + React from one StorySpec | `packages/generator-html` (static HTML/CSS/ES modules + vendored three.js) and `packages/generator-react` (Vite 7 + React 19 + TS strict + R3F 9, pinned lockfile) — separate native generators, shared CSS class names and test hooks |
| T003 Local preview + Playwright smoke | `packages/preview` loopback server; `packages/qa` suite: 2 targets × 3 viewports + no-WebGL + reduced-motion + keyboard + semantics + content parity |
| T004 Provider CLI availability | `packages/providers` runs only `<cli> --version`; reports installed/not-found/error; never inspects or proxies auth |
| T005 Isolated workspace process + cancellation | `packages/core` allowlisted process runner (argument arrays, no shell, env allowlist, timeout, process-tree kill, Windows `.cmd` handling) + `JobManager` with cancel; UI Cancel button |

Also: StorySpec Zod schema (single source; `schemas/story-spec.schema.json` is generated and drift-tested), license gate (`pnpm licenses:check`), CI matrix (macOS/Windows/Ubuntu), ADR-007…010, desktop design system (`design-system/ai-cinematic-studio/MASTER.md`).

### Verification (final run, macOS arm64, Node 24.22)
| Check | Command | Result |
|---|---|---|
| Typecheck (strict, all packages + renderer + e2e) | `pnpm typecheck` | pass |
| Unit/integration | `pnpm test` | 72/72 pass (8 files) |
| License gate | `pnpm licenses:check` | studio 102 / React export 159 / HTML vendored 1 — all `passed`, 0 review, 0 blocked |
| Desktop build | `pnpm build` | pass |
| Browser suite | `playwright test --project=chromium --project=webkit` | 30/30 pass |
| Desktop E2E (real Electron) | `pnpm test:desktop` | 5/5 pass (incl. full generate → build → preview in ~8 s with warm npm cache) |
| Screenshots | `artifacts/screenshots/` | 24 images (20 export, 4 desktop) — manually reviewed |

Security tests include: path traversal (POSIX/Windows/UNC/encoded), symlink escape on write and serve, dotfiles, DNS-rebinding Host header, preview token, shell metacharacters, binary allowlist, env secret leakage, XSS/markup injection in both generators, CSS injection via colors/fonts, `javascript:` links, renderer has no `require`/`process`, frozen bridge, unknown channels/invalid payloads rejected, preview iframe has opaque origin and no bridge access, navigation and new windows blocked.

### Defects found by checks and fixed
1. R3F's `<Canvas>` sets inline `position: relative`, which pushed hero copy into the right half (seen in WebKit screenshot). Fixed with an owned wrapper; added a layout-guard assertion.
2. Hiding the canvas with `display:none` while loading would leave R3F with a 0×0 canvas. Now `visibility:hidden` while loading.
3. IPC sender check used `new URL().origin`, which Node reports as `"null"` for `app:` — every call was rejected (failed closed). Fixed with protocol+host comparison, unit tested.
4. Vite 8 pulled MPL-2.0 `lightningcss` into both the export and the studio. Pinned Vite 7.3.7 (ADR-009).
5. Preload bundled all of Zod (761 KB). Split a dependency-free channel list → 765 bytes.

### Not verified / known gaps (honest status)
- **Firefox not run locally**: Firefox exits with "Could not find profile folder" under this session's command sandbox (Chromium/WebKit unaffected). The suite is engine-agnostic and CI runs Firefox on all three OSes; M0 acceptance for Firefox is **pending a CI or local run** (`pnpm test:browsers`).
- **Windows and Linux not run locally**; covered by the CI workflow, which has not executed yet (repository is not under git).
- Export builds (`npm ci`, `vite build`) run as child processes without OS sandbox/network limits (risk register; T025).
- three.js is vendored unminified in HTML exports (~2.1 MB raw).
- No axe-core/contrast automation yet (M4, T022); no physical device testing (M5, T027).
- Projects are file-based; SQLite storage, snapshots and recent projects are M1 (T006).
- The first desktop E2E draft called `window.open('https://example.com')`; because https links are intentionally opened externally, that run likely opened example.com in the default browser. The test now uses a non-https URL.

### Next tickets
M1: T006 project storage/snapshots → T010 StorySpec migrations → T009 job/log panel persistence → T007 provider registry UI → T008 skill registry. Prerequisite: green CI on all three OSes including Firefox.
