# Desktop UI/UX Specification

## Visual direction
Premium creative workstation, not a generic admin dashboard. Dark neutral canvas, carefully restrained indigo (Neel) accent, strong typographic hierarchy, generous whitespace, rich scene previews. Offer light mode later; meet contrast standards.

## Window layout (desktop)
- Top bar: app/project name, breadcrumb, run status, provider indicator, preview/export.
- Left navigation (220–260px): Home, Projects, New Project, Skills, Assets, Providers, Settings.
- Main area: workspace-dependent content.
- Optional right inspector (280–340px): scene properties, context, quality status.
- Bottom collapsible panel: logs, builds, test results, licenses.
- Minimum useful size: 1280×800; design adaptive behavior for narrower windows.

## Screen inventory (MVP)
S01 Welcome/onboarding — workspace location, provider setup, privacy notice.
S02 Project dashboard — recent projects, create, benchmark examples, resume jobs.
S03 New project — prompt, reference URL(s), images, HTML/React selection; no forced backend.
S04 Visual discovery — single question, 2–4 illustrated choices, story prompt, skip/AI choose.
S05 Reference analysis — URL screenshot, extracted facts, style observations, confidence, source links, selection of what to use.
S06 Creative directions — 2–3 moodboards, typography/color, animation density, mobile strategy.
S07 Storyboard — ordered scene cards, purpose, media, camera/motion, edit/approve.
S08 Main studio — left scenes/assets; center live preview; right chat/inspector; bottom logs/timeline; device toggle.
S09 Compare revisions — before/after images, code diff, accept/reject.
S10 QA dashboard — per-browser/device results, accessibility, performance, license issues.
S11 Export — HTML or React (or both), bundle options, notices, build instructions.
S12 Provider/skills settings — CLI status, BYOK, permissions, skill sources, license states.

## Core editor interactions
- Select scene in timeline → preview scrolls to scene → inspector shows editable properties.
- Click element in preview → show source component/DOM selector; changes proposed as patches.
- Chat command may target selected scene only; never silently overwrite approved content.
- User can inspect original and current design side-by-side.
- Toggle desktop/tablet/mobile and reduced-motion.
- QA issues link directly to affected scene/file.
- Each long-running job shows status, logs, cancellation and retry.

## Visual questions
Question model: `id`, `reason`, `prompt`, `type`, `options[]` (label, image, explanation), `optional`, `default`, `answer`.
Use images only when they genuinely clarify a design choice. Do not fabricate source screenshots.
Question examples: tone, scene style, narrative order, hero object, interaction intensity, preferred output target.
Ask for historical/factual stories only if needed; label unsupported facts as assumptions.

## Accessibility
Keyboard navigation for entire studio, visible focus, screen reader labels, color-independent state, reduced-motion previews. Avoid requiring drag-and-drop; provide reorder buttons.

## UX acceptance
User can start an HTML or React project within 2 minutes with a single idea; advanced controls are optional. All user-facing failure states explain what happened and what can be retried.
