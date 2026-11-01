# Coding Agent Prompt — HTML + React Renderer Parity M3

Read `AGENTS.md`, `docs/04-STORY-SPEC.md`, `docs/06-ENGINEERING-QUALITY.md` and `schemas/story-spec.schema.json`.

Implement or extend six MVP scene primitives in **both**:
- HTML5/CSS3/ES modules/Three.js
- React/Vite/TypeScript/React Three Fiber

Rules:
- Use shared StorySpec; no React-to-HTML conversion.
- Ensure content, interactions, camera intent, and fallbacks match.
- Build scene-level components/modules, not one monolithic file.
- Add reduced-motion, no-WebGL, keyboard and responsive support.
- Generate sample output for every primitive and run browser screenshot parity tests.
- Do not mark done until both targets build and the visual difference is reviewed.
