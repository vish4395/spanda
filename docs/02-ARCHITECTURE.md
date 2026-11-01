# System Architecture

## Key decision
**Electron + Node.js/TypeScript local-first** for MVP. Electron adds bundle size but integrates well with CLI providers, local preview/build tooling and Playwright. Revisit Tauri after profiling packaging/security/maintenance. Electron renderer has no direct Node access.

## Logical modules
```
Electron Main (trusted)
  ├── typed IPC router + permission checks
  ├── workspace/project manager (safe paths)
  ├── local orchestrator/job engine
  ├── provider adapter registry (CLI/BYOK)
  ├── skill registry + evaluator
  ├── URL reference service (sandboxed browser/fetch)
  ├── artifact generator
  │    ├── StorySpec validator
  │    ├── html-three renderer
  │    └── react-r3f renderer
  ├── preview/build sandbox + Playwright QA
  └── local SQLite metadata + artifact storage

Electron Renderer (unprivileged React UI)
  ├── onboarding + dashboard
  ├── visual discovery
  ├── creative brief + storyboard
  ├── editor/chat/scene timeline
  ├── live preview and device toolbar
  └── provider/skill/license settings
```

## Monorepo target
```
apps/desktop/                 Electron main, preload, renderer
packages/contracts/           Zod schemas and shared TS types
packages/core/                domain services, project state, jobs
packages/providers/           provider interface + implementations
packages/skills/              skill registry, loader, policy
packages/reference-analyzer/  URL fetch/render/extraction
packages/story-engine/        brief/storyboard/StorySpec logic
packages/generator-html/      HTML + JS + Three.js renderer
packages/generator-react/     React + Vite + R3F renderer
packages/preview/             build/serve/screenshot infrastructure
packages/qa/                  browser, accessibility, visual QA
packages/licensing/           dependencies/assets/license evidence
packages/storage/             SQLite and filesystem repositories
fixtures/benchmarks/          five reproducible website briefs
```

## Project lifecycle state machine
`draft → discovery → brief_ready → storyboard_ready → approved → generating → validating → ready`
Alternative states: `needs_input`, `failed`, `cancelled`; retry from last valid checkpoint. Every transition has a typed event, timestamp, job ID, and snapshot reference.

## Trust boundaries
- User prompt, web pages, downloaded assets, AI output, imported skills and generated code are untrusted.
- Electron renderer has `nodeIntegration=false`, `contextIsolation=true`, sandbox enabled where possible, restrictive CSP.
- Main process exposes minimal `window.studio.*` typed API via preload; no generic `executeShell` or `readAnyFile`.
- Child processes use argument arrays, no shell interpolation; explicit binary allowlist and workspace-scoped cwd.
- Generated projects run in isolated process/container with resource and network limits; localhost preview origin separate from app origin.
- Block access to cloud metadata, private IPs, loopback, local files, credentials and internal services during URL fetching.
- Validate generated paths against project root, reject symlinks/path traversal before writes.
- Provider CLI credentials remain managed by provider tooling; BYOK secrets stored in OS credential vault if possible.
- No untrusted generated HTML inside privileged Electron webview.

## Generator design
StorySpec is canonical. Each generator maps supported scene primitives and behavior to its native stack. No React-to-HTML transpilation shortcut. Both targets share fixture tests and acceptance screenshots but may differ in implementation details.

## Rendering pipeline
Discover → brief → storyboard → StorySpec → asset manifest → renderer → build → preview → screenshot → critic → targeted repair → approval/export.
Set maximum iterations, budget, and timeout; do not loop indefinitely.

## Open design decisions
- Whether HTML output should use Vite for development only (recommended) or be zero-build by default (recommended: static `index.html` + ES modules, optional bundling).
- Best sandbox strategy by OS (Windows/macOS/Linux): define supported hosts and test before public beta.
- Exact provider CLI supported modes and legal terms must be verified against current official documentation before shipping.
