# Architecture Decision Records (initial) and Risks

## ADR-001 Desktop first — Accepted provisionally
Electron + React/TS + Node local services for CLI integration, preview and filesystem operations. Cost: app size, OS packaging and sandbox complexity. Reassess after spike.

## ADR-002 HTML and React both in MVP — Accepted
Two native generators share StorySpec and acceptance fixtures. React is not a prerequisite for HTML. Cost: twice the implementation/QA surface.

## ADR-003 Frontend excellence first — Accepted
Backend/database output generation postponed. Studio itself still needs local persistence and orchestration.

## ADR-004 StorySpec canonical format — Accepted
Validated declarative scene graph enables scoped edits, renderer independence and repeatable QA. Risk: overdesign; keep MVP primitives small.

## ADR-005 Commercial-safe default — Accepted
Default to permissive libraries and original/verified assets. Preserve notices and block unresolved restrictions. Legal review needed for provider integrations and specific dependencies.

## ADR-006 Agent execution model — Proposed
Local official CLI adapters plus BYOK. No credentials scraping. Must test documented supported modes per provider and terms.

## ADR-007 HTML runtime — Accepted (M0)
Zero-backend, zero-build output: `index.html` + CSS + ES modules, with three.js vendored under `vendor/three/` (no CDN) and a strict CSP meta tag. Verified CDN-free in Chromium and WebKit; the Firefox run is pending (see IMPLEMENTATION_LOG). Cost: three.js 0.186 ships unminified (`three.module.js` + `three.core.js`, ~2.1 MB raw); an optional tree-shaking build is a later optimisation.

## ADR-008 Supported desktop platforms — Accepted (M0)
The studio targets macOS, Windows and Linux via Electron; ChromeOS is supported through its Linux development environment (Crostini) using the Linux build — Chromebooks cannot run Electron apps natively outside it. Consequences: no shell-string process execution (argument arrays only; Windows `.cmd` shims go through `cmd.exe` only after every argument passes a strict allowlist regex); path handling rejects POSIX and Windows absolute/UNC/drive paths; system font stacks cover all four platforms; CI runs on macOS, Windows and Ubuntu. Ubuntu 24.04+ (and some distros) restrict unprivileged user namespaces, which Chromium's sandbox needs — installers (M5, T029) must ship a correctly-permissioned `chrome-sandbox` or document the AppArmor profile. Packaging/signing per OS (dmg/notarisation, NSIS/MSIX + code signing, AppImage/deb) is M5 scope.

## ADR-009 Pin Vite 7 for exports and studio — Accepted (M0)
Vite 8 depends on `lightningcss` (MPL-2.0), which policy (docs/07) marks review-required. Vite 7.3.7 (maintained, patched 2026-10-06) has only permissive dependencies, so generated React exports ship a lockfile with zero review-required licenses. The workspace pins `vite: 7.3.7` via pnpm overrides. Revisit when legal reviews MPL-2.0 for build-time tools or when Vite 7 leaves maintenance.

## ADR-010 Preview isolation — Accepted (M0)
Generated sites are served by a per-session static server bound to `127.0.0.1` with an unguessable path token, Host-header (DNS-rebinding) check, realpath containment and `nosniff`. The studio frames them in `<iframe sandbox="allow-scripts">` (opaque origin: no access to the studio window, storage or `window.studio`). The renderer itself loads from a custom `app://studio` protocol with a strict CSP; only that top-level frame may call IPC. Not yet done: OS-level sandboxing/network limits for `npm ci`/`vite build` child processes (they run with an allowlisted environment, `--ignore-scripts`, timeouts and cancellation) — see risk register.

*Addendum (M3, T019):* the main process attaches Electron's `webContents.debugger` to the studio window to inspect the preview frame without modifying the generated site: `Emulation.setEmulatedMedia` gives real `prefers-reduced-motion` emulation (CSS `@media` and `matchMedia` alike) and `Runtime`/`Log`/`Network` events supply the runtime error overlay. Out-of-process frames are auto-attached paused so emulation lands before page scripts; every target gets `Runtime.enable` and is then resumed (a lone resume leaves Chromium OOPIFs paused). Data flows one way, from the frame to the main process; issue text is clipped, capped at 50 per page and rendered as plain text. The protocol is never exposed to the renderer, which can only toggle motion and read issues through two schema-validated IPC channels. If attaching fails (e.g. another debugger holds the window) the preview works normally and the toggle is disabled.

## ADR-011 Open core: Apache-2.0 studio, paid Spanda Pro add-ons — Proposed
The studio is released publicly as open source under Apache-2.0 (permissive, patent grant, no trademark grant under §6). Premium features ship later as **Spanda Pro** add-ons under a commercial EULA from a separate private repository, loaded only through a public versioned add-on API. Generated website code is MIT-0/0BSD so exports carry no obligations. The brand name and logo, not the code, are the protected asset: forks must rebrand (`TRADEMARKS.md`). Contributions use DCO, not a CLA. AGPL was rejected because it deters adoption and contributors and its network clause adds little to a desktop app. Consequences: the core must stay fully functional without Pro; core features are never moved behind Pro; Pro never resells AI provider access; license checks are offline. Becomes Accepted when the trademark search (T031) clears and the license files (T035) land. See `docs/brand-guidelines.md` §8 and roadmap R0–R2.

## Risk register
| Risk | Impact | Mitigation |
|---|---|---|
| Provider CLI automation not supported by terms | High | Official documented modes, BYOK fallback, legal review |
| AI creates generic designs | High | Art-direction rubric, references, visual critic, human approvals |
| HTML and React drift visually | High | Shared StorySpec, parity fixtures, screenshot comparisons |
| WebGL mobile performance | High | Complexity budgets, adaptive quality, 2D fallback |
| Malicious references/skills | Critical | Sandboxes, SSRF checks, untrusted-data boundaries |
| License contamination | High | Versioned evidence, SBOM, blocked export |
| "Spanda" trademark conflict found late | High | T031 search before T034 rename or any public launch; Kinora kept as fallback name |
| Fork rebrands and competes with Pro | Medium | Trademark policy, fast release cadence, Pro value in curated content and services |
| Community backlash over the free/Pro line | High | Public promises in README, ADR-011 rules, boundary review gate (T048) |
| Secrets or internal data exposed when repo goes public | Critical | T037 full-history secret scan before T039 |
| Electron app too heavy | Medium | Profile startup/memory, lazy load, consider Tauri later |
| Huge generation cost | High | Skill routing, budgets, checkpoints, scoped edits |
| Desktop OS differences | Medium | CI matrices and native testing |
| 3D assets expensive to create | Medium | Procedural kits, licensed asset library, user uploads |
| Export builds run without OS sandbox/network isolation | High | M0: pinned lockfile, `npm ci --ignore-scripts`, env allowlist, timeouts, cancel. M4 (T025): per-OS sandbox, offline install from verified cache |
| Firefox not exercised in every dev environment | Medium | CI matrix runs Chromium/Firefox/WebKit on 3 OSes; release requires green Firefox |
