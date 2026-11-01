# Coding Agent Prompt — Bootstrap M0

You are the lead engineer for AI Cinematic Studio. Read `AGENTS.md`, `README.md`, and docs 01–10. Implement **M0 only**. Do not jump to full product generation.

Create a pnpm workspace with Electron desktop shell (main/preload/React renderer), shared contracts, core project module, minimal HTML generator and minimal React generator, preview/test harness, and sample StorySpec.

Required working vertical slice:
1. Launch desktop shell showing projects and a basic preview.
2. Load `schemas/story-spec.example.json` and validate it.
3. Generate a static HTML/CSS/JS/Three.js project and a React/Vite/TS/R3F project from the same spec.
4. Build/run each export locally; show them in isolated preview.
5. Capture screenshots with Playwright Chromium, Firefox and WebKit.
6. Include no-WebGL and reduced-motion fallbacks.
7. Add tests, security-safe IPC and explicit setup commands.
8. Pin dependencies, record licenses and preserve required notices.

Before coding, give a concise file plan and acceptance tests. After coding, run checks and report results, limitations, and next ticket IDs. No fake provider integration, no unverified package licenses, no external deployment.
