# AI Cinematic Studio

> **Implementation status:** Milestone **M0 (technical spike)** is implemented. See `IMPLEMENTATION_LOG.md` for results, evidence and known gaps. Later milestones are not started.

## Quick start (M0)

Requirements: Node.js 24+, pnpm 12 via Corepack, ~3 GB free disk. Works on macOS, Windows, Linux; ChromeOS via its Linux environment.

```sh
corepack enable                 # provides the pinned pnpm (package.json → packageManager)
pnpm install                    # dependency install scripts are denied by policy (pnpm-workspace.yaml)
pnpm --filter @studio/desktop exec install-electron   # one-time, checksum-verified Electron download

pnpm typecheck                  # strict TypeScript across all packages
pnpm test                       # unit/integration tests (Vitest)
pnpm licenses:check             # license gate → licenses/inventory.json
pnpm generate:sample            # writes artifacts/sample/{html,react} from schemas/story-spec.example.json
pnpm --filter @studio/qa exec playwright install chromium firefox webkit
pnpm test:browsers              # Chromium/Firefox/WebKit × desktop/tablet/mobile + fallbacks → artifacts/screenshots
pnpm dev                        # build and launch the desktop studio
pnpm test:desktop               # Electron end-to-end test
```

If your shell sets `ELECTRON_RUN_AS_NODE` (VS Code's integrated terminal can), unset it before `pnpm dev`.

---

## Build blueprint

**Status:** Planning / implementation-ready specification (v0.1)  
**Target:** Desktop-first, local-first AI-assisted 3D storytelling website builder  
**Primary outputs from day one:** **Static HTML/CSS/JavaScript** and **React + Vite + TypeScript**.

## Product in one sentence
A desktop creative studio that asks visual questions, understands user-provided references, plans a cinematic story, generates and iteratively tests commercially usable, cross-device websites, and exports complete source code.

## Recommended implementation
- Desktop shell: Electron + React + TypeScript, with strict context isolation and a minimal IPC allowlist.
- Local backend/orchestrator: Node.js + TypeScript, SQLite for app metadata, job queue persisted locally.
- Website rendering: two separate targets from a shared validated `StorySpec`: `html-three` and `react-r3f`.
- AI providers: adapters for official Codex CLI, Claude Code CLI, OpenCode/Kilo where supported, and BYOK APIs. No subscription-cookie extraction or credential resale.
- Preview: isolated localhost web server; Playwright for browser screenshots and smoke tests.
- Skill system: versioned local registry, curated third-party skills, original studio skills, per-skill permissions and license inventory.

## Suggested reading / implementation order
1. `docs/01-PRD.md` — scope, user journeys, MVP acceptance criteria.
2. `docs/02-ARCHITECTURE.md` — boundaries, components, execution/security model.
3. `docs/03-UX-SCREENS.md` — desktop layouts and visual discovery.
4. `docs/04-STORY-SPEC.md` and `schemas/story-spec.schema.json` — shared intermediate format.
5. `docs/05-AGENTS-AND-SKILLS.md` — orchestration, adapters, skill routing.
6. `docs/06-ENGINEERING-QUALITY.md` — browser, accessibility, performance, testing.
7. `docs/07-LICENSING-SECURITY.md` — commercial-use gates and safety.
8. `docs/08-ROADMAP-BACKLOG.md` — milestones and tickets.
9. `docs/09-DATA-AND-API.md` — database entities and typed contracts.
10. `docs/10-DECISIONS-AND-RISKS.md` — ADRs, assumptions and risks.
11. `AGENTS.md`, `CLAUDE.md`, `prompts/` — instructions to coding agents.
12. `skills/` — starter original skills for the agent registry.

## Scope clarification
- **MVP** generates HTML and React equally, with shared visual and QA acceptance criteria.
- Optional backend generation (Node/Python), Vue, CMS, databases, deployment integrations, collaborative editing are **post-MVP**.
- Desktop app may run a Node process locally, but **static exported websites do not require a backend**.
- Generated website must work independently of the studio.
- Source URLs and open-source projects are **research inputs**, not permission to copy designs or assets.

## First run with Claude Code or Codex
1. Create a new git repository and copy this blueprint into it.
2. Ask the coding agent to read `AGENTS.md` and `docs/01-PRD.md` through `docs/10-DECISIONS-AND-RISKS.md`.
3. Use `prompts/01-bootstrap.md` to scaffold the monorepo.
4. Complete milestones in `docs/08-ROADMAP-BACKLOG.md` in order.
5. Run tests and capture screenshots before marking any feature complete.
6. Keep an `IMPLEMENTATION_LOG.md` and ADR updates in the repo as code evolves.

This package is a build specification, not a claim that the application has already been implemented.
