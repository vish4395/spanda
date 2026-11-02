# Milestones, Backlog and Delivery Plan

**Planning estimate:** ~12–20 weeks for a small experienced team, subject to graphics and provider integration complexity. Ship vertical slices rather than building every screen first.

## M0 — Technical spike (1–2 weeks)
- T001 Create Electron/React/TS pnpm monorepo with typed IPC.
- T002 Generate minimal **HTML** and **React** pages from one sample StorySpec.
- T003 Run local preview and Playwright Chromium/Firefox/WebKit smoke.
- T004 Test provider CLI availability without bypassing authentication.
- T005 Prototype isolated workspace process and cancellation.
**Exit:** one story renders correctly in both outputs and screenshots are captured.

## M1 — Product foundation (2–3 weeks)
- T006 Project storage, create/open/recent/snapshots.
- T007 Provider registry, capability probing, settings UI.
- T008 Skill registry, metadata, version pinning, permission policy.
- T009 Desktop shell, dashboard, job status/log panel.
- T010 StorySpec schema validation and migration scaffolding.
**Exit:** user can create a local project and preview saved sample artifacts.

## M2 — Creative workflow (2–3 weeks)
- T011 Guided idea intake and visual question cards.
- T012 Safe reference URL analysis and screenshot summaries.
- T013 Creative brief editor and approvals.
- T014 Storyboard scene cards and scene timeline.
- T015 Initial story/creative agent with structured outputs.
**Exit:** idea → approved storyboard with clear provenance and no arbitrary shell access.

## M3 — Dual output generation (3–4 weeks)
- T016 HTML renderer for hero, chapter, reveal, gallery, CTA, model showcase.
- T017 React renderer for same primitives.
- T018 Three.js/R3F scenes, camera, responsive fallbacks.
- T019 Live preview, error overlay, device presets.
- T020 Scoped scene edits and checkpoint rollback.
**Exit:** benchmark briefs export both targets, each builds and runs.

## M4 — Quality and commercial readiness (2–3 weeks)
- T021 Visual QA screenshot compare + issue reporting.
- T022 Browser smoke/accessibility/performance checks.
- T023 License and asset provenance inventory.
- T024 Export ZIP with source, notices, SBOM and docs.
- T025 Security and sandbox regression suite.
**Exit:** complete validated HTML/React export with honest license status.

## M5 — Private beta and hardening (2–5 weeks)
- T026 Five-project evaluation harness and human design review.
- T027 Real Safari/iOS/Android device validation.
- T028 Recovery, offline states, provider failures, telemetry opt-in.
- T029 Installer signing, updates, support diagnostics.
- T030 Provider terms/legal review and release checklist.
**Exit:** reproducible beta builds and resolved critical issues.

## Release track — open source and Spanda Pro (ADR-011)
Runs alongside the product milestones. R0 can start now; R1 is gated on M4; R2 starts after the public release has users.

### R0 — Release readiness (now, in parallel with M1–M4)
- T031 Trademark knockout search for "Spanda" (USPTO, EUIPO, WIPO, Indian Trade Marks Registry; classes 9 and 42); then file the word mark and logo. **Blocks T034.**
- T032 Secure domains (`spanda.studio` / `spanda.app`), the GitHub org, the npm `@spanda` scope and social handles.
- T033 Draw the logo mark, wordmark and Devanagari mark as SVG; validate at 16px; produce the app icon set and a 1280×640 social preview.
- T034 Rename in one commit: package names, Electron `productName`/`appId`, window title, docs. Only after T031 clears.
- T035 Licensing files: `LICENSE` (Apache-2.0), `NOTICE`, `"license"` fields in every `package.json`, MIT-0 headers and notice for generator templates/runtime, and a test that exports contain no Apache-only obligation.
- T036 Repository policy files: `TRADEMARKS.md`, `CONTRIBUTING.md` (DCO), `CODE_OF_CONDUCT.md`, `SECURITY.md`, and issue/PR templates.
- T037 Pre-publication audit: secret scan of the full git history, `pnpm licenses:check` green, third-party `skills/` and assets with recorded provenance, removal of internal or customer references.
- T038 Public README: hero GIF of a real export, quick start, the four promises, a free-vs-Pro line, and the trademark note.
**Exit:** legal and brand blockers cleared; the repo can be made public without exposing secrets or license risk.

### R1 — Public open-source release v0.1 (after M4 exit)
- T039 Make the repo public; CI green on macOS, Windows and Ubuntu; DCO check in CI.
- T040 Signed release builds for all three OSes (depends on T029) with checksums and a changelog; codename *Yavanika*.
- T041 Community basics: GitHub Discussions, issue triage labels, a "good first issue" set, docs site or a docs folder index.
- T042 Launch: landing page and launch posts following the brand voice; real exported example sites only.
**Exit:** a stranger can install, create a story site and export it using only the public docs.

### R2 — Spanda Pro foundation (after R1)
- T043 Public add-on API: versioned manifest, capability permissions, typed IPC surface, loading from a user add-ons directory. Core contract tests prove the app runs with zero add-ons.
- T044 Offline license-key verification (signed keys, public key in core, no phone-home on launch), with graceful degradation that never blocks opening or exporting projects.
- T045 Private `spanda-pro` repository, commercial EULA, build and signing pipeline for add-on bundles.
- T046 Store and payments through a merchant of record (handles global VAT and GST), license delivery and refunds policy.
- T047 First paid add-on (candidate: *Pro Scene Library*), chosen from R1 user feedback.
- T048 Free/Pro boundary page in the docs, and a review gate for every ticket that touches the boundary.
**Exit:** a user can buy, install and use one Pro add-on offline; the core stays fully functional without it.

## Priority rules
P0 = dual renderer, quality, safety, licensing, project workflow.
P1 = extra scenes, design variants, provider improvements, template packs.
Release track: R0 tickets T031, T035 and T037 are P0 for going public. Pro (R2) work never pre-empts P0 core work.
Post-MVP = Vue, Node/Python backend generation, databases, cloud sync, deployment integrations, collaboration.

## Per-ticket template
ID / goal / dependencies / touched packages / acceptance tests / security-license checks / screenshot evidence / docs updates / done status.
