---
name: visual-qa
description: Critique actual rendered HTML and React websites with browser screenshots and structured quality checks.
---
# Visual QA
## Inputs
Approved brief/storyboard, current StorySpec, screenshot sets, build/browser logs, accessibility and performance reports.
## Procedure
1. Observe real screenshots, not code descriptions.
2. Compare composition, hierarchy, typography, lighting, camera framing, visual consistency, mobile adaptation.
3. Identify concrete defects with scene ID, viewport, browser, severity, evidence.
4. Check interactions, reduced motion, no-WebGL fallback and accessibility separately.
5. Recommend minimal scoped changes, avoiding broad redesign unless requested.
6. After repair, re-render affected scene and run regression checks.
## Output
Machine-readable issue list + human-readable summary; never invent measurements or claim unrun tests.
