# Coding Agent Prompt — Creative Workflow M2

Read `AGENTS.md`, PRD, UX, StorySpec and agent/skills docs. Implement the smallest functional path:
- Prompt-based project creation.
- Visual question card with skip/AI choose.
- Safe public URL reference analyzer with screenshot, observations and sources.
- Editable creative brief and 2–3 design directions.
- Ordered storyboard scene cards and approval.
- Persist each step and recover after app restart.
- Generate validated StorySpec; do not generate code yet unless existing M0 pipeline is available.
- Use mock deterministic test fixtures only in tests, never masquerading as a real AI provider.
Add unit/integration/E2E tests and document trust boundaries. Avoid unnecessary new dependencies.
