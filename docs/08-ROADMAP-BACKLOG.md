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

## Priority rules
P0 = dual renderer, quality, safety, licensing, project workflow.
P1 = extra scenes, design variants, provider improvements, template packs.
Post-MVP = Vue, Node/Python backend generation, databases, cloud sync, deployment integrations, collaboration.

## Per-ticket template
ID / goal / dependencies / touched packages / acceptance tests / security-license checks / screenshot evidence / docs updates / done status.
