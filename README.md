<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/assets/spanda-logo.svg">
    <img src="docs/brand/assets/spanda-logo-light.svg" alt="Spanda" width="240">
  </picture>
</p>

<h3 align="center">Stillness, set in motion.</h3>

<p align="center">
  An open-source desktop studio for cinematic, scroll-driven 3D story websites.<br>
  Local-first. Exported as code you own, in HTML or React.
</p>

<p align="center">
  <a href="LICENSE">Apache-2.0</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#status">Status</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="SECURITY.md">Security</a>
</p>

---

**Spanda** (Sanskrit स्पन्द, *SPAN-duh*) is the subtle pulse that sets stillness in motion. A Spanda website is still until the viewer scrolls; then it comes alive, scene by scene.

Spanda Studio works like a director, not a form. It asks one visual question at a time, offers a few original art directions, drafts a storyboard you approve, and then builds the site twice: once as plain HTML with three.js and once as a React project. Neither is a conversion of the other. You preview both side by side, edit scene by scene, and export source code that runs without the studio.

> **Pre-release.** Spanda Studio runs from source today; installers come with the first public release. Code identifiers still use the working name `ai-cinematic-studio` / `@studio/*` until the trademark search clears ([branding](docs/brand/branding.md)).

## What it does

**Direction**
- **Guided discovery.** Four visual questions (tone, subject, motion, length), each with *Skip* and *You decide*, and every answer changeable later.
- **References, safely.** Paste a site you admire: the studio reads its structure behind an SSRF-safe fetcher and records what you want to borrow. References are research, never permission to copy.
- **Brief and storyboard.** Choose from original art directions with checked contrast, then shape a storyboard of six scene types: hero, chapter, scroll reveal, 3D model showcase, gallery and call to action.

**Craft**
- **Two native outputs from one StorySpec.** `html-three` (static HTML, CSS, ES modules, vendored three.js; no build step) and `react-r3f` (Vite, React, TypeScript, React Three Fiber).
- **Live, isolated preview.** Desktop, tablet and mobile sizes; a reduced-motion preview; errors from the running page shown as they happen. Generated sites run in a sandboxed frame with no access to the studio.
- **Edit one scene at a time.** Change a scene without touching the others. Every change is a version you can roll back.
- **Accessible by default.** Semantic HTML, keyboard access, `prefers-reduced-motion` support and a still fallback when WebGL is unavailable, in both outputs.

**Ownership**
- **Export.** A ZIP with the HTML and/or React source, build and hosting instructions, third-party notices, asset credits and a CycloneDX SBOM. Exports are refused while a build is out of date or a dependency license is blocked.
- **Local-first.** Projects live on your machine. No account is required to create, edit or export.
- **Bring your own AI, optionally.** The default storyboard planner runs locally without AI. You can turn on drafting with the Claude Code CLI you already use; the studio never handles your sign-in or resells access.

## Promises

1. **The core stays free.** A feature that ships in the open-source core is never moved behind a paid tier.
2. **Your output is yours.** Exported websites carry no watermark and no attribution requirement: generated code is MIT-0.
3. **No resold AI access.** You bring your own provider. Paid add-ons will sell features, never tokens.
4. **Works offline.** Editing, previewing and exporting don't need a network connection, and any future license check works locally.

Pro add-ons are coming; the core stays free.

## Quick start

Requirements: Node.js 24 or newer, pnpm 12 through Corepack, about 3 GB of free disk. macOS, Windows and Linux; ChromeOS through its Linux environment.

```sh
corepack enable                                        # provides the pinned pnpm
pnpm install                                           # dependency install scripts are denied by policy
pnpm --filter @studio/desktop exec install-electron    # one-time, checksum-verified Electron download
pnpm dev                                               # build and launch the studio
```

The studio opens with a sample project, *Heritage Journey*. Choose **Generate HTML + React**, then **Export…** to get the site as a ZIP. Generating the React output runs `npm ci` and `vite build`, so npm must be on your `PATH`.

If your shell sets `ELECTRON_RUN_AS_NODE` (VS Code's integrated terminal can), unset it before `pnpm dev`.

### Checks

```sh
pnpm check   # everything below, in order
```

| Command | What it checks |
|---|---|
| `pnpm typecheck` | Strict TypeScript across every package |
| `pnpm test` | Unit and integration tests (Vitest) |
| `pnpm licenses:check` | License gate for the studio and both export targets → `licenses/inventory.json` |
| `pnpm secrets:check` | Secret scan of every commit and the working tree |
| `pnpm test:browsers` | Generated sites in Chromium, Firefox and WebKit: benchmark briefs, viewports, fallbacks, HTML/React parity |
| `pnpm test:desktop` | The desktop app end to end in Electron |

Install the browsers once with `pnpm --filter @studio/qa exec playwright install chromium firefox webkit`.

## Status

| Milestone | State |
|---|---|
| M0 Technical spike | Done |
| M1 Product foundation: projects, versions, providers, skills | Done |
| M2 Creative workflow: discovery, references, brief, storyboard | Done |
| M3 Dual output: six scene types in HTML and React, live preview, scene edits | Done on Chromium and WebKit; Firefox, Windows and Linux in CI |
| M4 Quality and commercial readiness | In progress: export ZIP with notices and SBOM is done; in-app visual QA, accessibility and performance checks are next |
| First public release (*Yavanika*) | After M4: signed installers, trademark clearance |

Evidence, test results and known gaps for each step are in [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md); the plan is in [`docs/08-ROADMAP-BACKLOG.md`](docs/08-ROADMAP-BACKLOG.md).

## How it is built

- **Desktop:** Electron, React and TypeScript. The renderer is unprivileged; everything privileged goes through a small, schema-validated IPC surface.
- **StorySpec:** one validated intermediate format ([`docs/04-STORY-SPEC.md`](docs/04-STORY-SPEC.md)) drives two independent generators.
- **Preview:** a per-session loopback server with an unguessable path token, framed in a sandboxed iframe.
- **Storage:** local files plus SQLite for projects, versions and jobs, with hash-checked snapshots.

| Package | Role |
|---|---|
| `apps/desktop` | Electron app: main process, preload bridge, React renderer |
| `packages/contracts` | StorySpec schema, migrations and IPC contracts (Zod) |
| `packages/story-engine` | Discovery, art directions, brief and storyboard |
| `packages/generator-html` · `packages/generator-react` | The two native website generators |
| `packages/preview` | Loopback preview server and React builds |
| `packages/export` | Deterministic export ZIP, notices and SBOM |
| `packages/licensing` | License policy, inventory and notices |
| `packages/reference-analyzer` | SSRF-safe fetching and fact extraction for references |
| `packages/providers` · `packages/skills` | Provider CLI probing and drafting; pinned skill registry |
| `packages/core` · `packages/storage` | Workspace, jobs and process runner; SQLite store |
| `packages/qa` | Browser test suites and benchmark briefs |

Design documents, from product to risks, are in [`docs/`](docs/): [PRD](docs/01-PRD.md), [architecture](docs/02-ARCHITECTURE.md), [UX](docs/03-UX-SCREENS.md), [agents and skills](docs/05-AGENTS-AND-SKILLS.md), [engineering quality](docs/06-ENGINEERING-QUALITY.md), [licensing and security](docs/07-LICENSING-SECURITY.md), [data and API](docs/09-DATA-AND-API.md), [decisions and risks](docs/10-DECISIONS-AND-RISKS.md). Coding agents start from [`AGENTS.md`](AGENTS.md).

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first: every commit needs a DCO sign-off (`git commit -s`), and new dependencies need a permissive, recorded license. Please follow the [code of conduct](CODE_OF_CONDUCT.md), and report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md).

## License

- **Spanda Studio** is licensed under [Apache-2.0](LICENSE). See [`NOTICE`](NOTICE).
- **Websites you export** are yours. The generated code is [MIT-0](packages/generator-html/LICENSE-MIT-0), so no attribution is required, and third-party libraries in the export keep their own licenses, listed in its notices and SBOM.
- **The names and logos** "Spanda", "Spanda Studio", "Spanda Pro" and "AI Cinematic Studio" are trademarks and are not covered by the code license. Forks are welcome under their own name; see [`TRADEMARKS.md`](TRADEMARKS.md).

---

<p align="center">Copyright 2026 Vishal Sharma (NewAi.in) and contributors · Designed and built in India</p>
