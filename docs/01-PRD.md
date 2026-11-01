# Product Requirements Document (PRD)

## Vision and audience
A premium desktop AI studio for designers, developers, agencies, creators, artists and businesses to produce interactive, cinematic, commercially publishable websites from ideas and references.

## User problems
- Conventional generators produce generic templates or poor visual quality.
- Building excellent 3D scroll stories demands multidisciplinary expertise.
- Users cannot easily specify a visual experience in technical language.
- AI-generated websites often fail on mobile, browsers, accessibility or licensing.
- Users need complete portable HTML or React source, not vendor lock-in.

## MVP user journeys
### Journey A: Idea to website
1. Create project, enter name and one-line idea.
2. AI classifies project and asks **at most one focused visual question at a time** when information is missing; users can skip.
3. User selects from 2–4 original visual directions with preview cards.
4. User adds story, images, files, or public reference URLs.
5. Reference analyzer reports observations, sources, confidence, and possible copyright restrictions.
6. Studio generates editable creative brief and storyboard; user approves.
7. User chooses **HTML** or **React** target (can later export both).
8. Studio generates scenes, runs preview, tests and visually critiques.
9. User selects scene and requests scoped revisions; approved scenes remain unchanged.
10. User exports source + assets + license notices + README + build/run instructions.

### Journey B: Existing site as inspiration
Paste URL → fetch safely → summarize layout, narrative and design patterns → ask which aspects inspire user → produce **original** storyboard → generate.

### Journey C: Advanced user
Choose output stack immediately; optionally skip discovery, edit StorySpec and code, select provider/skills, inspect build/test logs.

## MVP functional requirements
- FR-01 Project creation, local persistence, recent projects.
- FR-02 Visual discovery with adaptive questions and explicit skip/AI-decide.
- FR-03 URL reference analysis with screenshot and structured observations.
- FR-04 Brief + storyboard generation, versioning and approval.
- FR-05 Native HTML/CSS/JS/Three.js generation.
- FR-06 Native React/Vite/TS/R3F generation.
- FR-07 Live preview, scene timeline, device-size presets, error overlay.
- FR-08 Chat-based scoped edits, diff preview, undo/checkpoints.
- FR-09 Provider adapters, connection tests, per-run provider selection.
- FR-10 Versioned skill registry and retrieval.
- FR-11 Automated build, smoke, accessibility, browser screenshot and basic perf checks.
- FR-12 License/SBOM and asset provenance report.
- FR-13 Full export, reproducible build and static hosting instructions.
- FR-14 Graceful fallback when WebGL or reduced-motion constraints apply.

## Non-functional requirements
- Offline: core project browsing/editing/export should work; AI generation requires available local or remote provider.
- Security: sandbox project execution, restricted filesystem/IPC, SSRF-safe URL analysis.
- Accessibility: keyboard navigation, visible focus, semantic UI, reduced-motion.
- Reliability: recoverable jobs, bounded retries, snapshots, meaningful errors.
- Observability: local task logs with secrets redacted.
- Performance: interactive editor remains responsive while generating/building.

## Explicit non-goals for MVP
Native 3D mesh editor; collaborative cloud editing; publishing platform; payment processing; built-in image/video/3D model generation; backend/database generation; Vue output; VR; multiplayer; marketplace.

## User stories / acceptance
- As a nontechnical creator, I can generate a responsive story website without choosing a backend.
- As a developer, I can select HTML or React and receive editable source.
- As an agency, I can see license/attribution notices before client delivery.
- As a mobile visitor, I can read content and navigate even when WebGL fails.
- As an editor, I can change scene 2 without destroying scenes 1 and 3.

## Success metrics (initial targets, to validate with pilot)
- 100% of curated benchmark projects export and build for **both** targets.
- 100% of generated sites include static/no-WebGL fallback.
- 0 unresolved prohibited licenses at export.
- ≥90% of benchmark browser smoke checks pass before human review; release requires all critical checks.
- Human art-direction panel evaluates originality, hierarchy, coherence and polish; establish rubric baseline during alpha.
