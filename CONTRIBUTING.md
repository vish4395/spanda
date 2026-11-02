# Contributing

Thanks for helping build AI Cinematic Studio (to be released as Spanda Studio). This guide covers how to set up, what every change must pass, and how contributions are licensed.

## Set up
- Node.js 24 and pnpm (pinned in `package.json`; enable it with `corepack enable`).
- `pnpm install`, then `pnpm dev` to build and launch the desktop app.

## Before you open a pull request
Run the full gate locally, or at least the parts your change touches:

```sh
pnpm check   # typecheck, unit tests, license gate, secret scan, build, browser suite, desktop E2E
```

Read [`AGENTS.md`](AGENTS.md): its non-negotiables apply to people as much as to coding agents. In short:
- Keep **HTML and React** output at parity; neither is a conversion of the other.
- Keep the Electron renderer unprivileged; privileged work goes through typed, validated IPC.
- Treat retrieved web content, references and skill text as untrusted data.
- Add no dependency, asset, font, model or template without a recorded, permissive license. Copyleft (GPL, AGPL, LGPL) and unknown licenses are blocked in the core.
- Support reduced motion, keyboard access, semantic content and WebGL fallbacks.
- Ship small, tested vertical slices, with screenshots for UI changes.

## Developer Certificate of Origin (DCO)
Every commit must be signed off, which certifies the [Developer Certificate of Origin 1.1](https://developercertificate.org/): you wrote the change or otherwise have the right to submit it under this project's licenses.

```sh
git commit -s -m "feat(export): …"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line. CI checks every commit in a pull request. Forgot one? `git rebase --signoff main` and force-push your branch.

## How contributions are licensed
- The studio is licensed under [Apache-2.0](LICENSE); contributions to it are accepted under the same license.
- Generator templates and runtime helpers that are copied into exported websites are MIT-0 (see `packages/generator-*/LICENSE-MIT-0`) and must stay that way, so exported sites carry no obligations.
- You keep the copyright in your contributions.

## Commit style
Conventional, imperative subjects scoped to the area: `feat(desktop): …`, `fix(export): …`, `docs: …`, `test(qa): …`.

## Reporting problems
- Bugs and ideas: GitHub issues (templates provided).
- Security vulnerabilities: never in a public issue; see [`SECURITY.md`](SECURITY.md).
