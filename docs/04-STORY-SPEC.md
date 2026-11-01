# Story Experience Specification (StorySpec)

## Purpose
Single source of truth for both HTML and React renderers. Must represent story and interactions without referencing React components or HTML DOM APIs directly.

## Required structure
- `schemaVersion`, `project`, `design`, `pages`, `assets`, `quality`.
- Each page has ordered scenes.
- Each scene declares `type`, `content`, `visual`, `motion`, `responsive`, `accessibility`.
- All IDs stable; content and assets referenced by ID; no executable JS in StorySpec.

## MVP scene primitives
1. `hero`: fullscreen/contained hero, headline, background, CTA.
2. `scroll-reveal`: copy/media reveal across scroll progress.
3. `model-showcase`: 3D object with camera presets and fallback image.
4. `chapter`: narrative content with image/3D environment.
5. `gallery`: media collection with keyboard navigation.
6. `cta`: conversion or contact section.

## Motion model
Use declarative scroll ranges and transitions: `trigger`, `start`, `end`, `easing`, `property`, `from`, `to`. Renderer maps to native CSS/JS or React timeline. Restrict to known safe properties. `prefers-reduced-motion` behavior required.

## 3D model
Scene may specify `camera` (position/target/fov), `lights`, `environment`, `objects` (asset refs, transforms), `interaction`, `fallback`. 3D assets must have license provenance. Clamp performance parameters.

## Responsive
Specify breakpoint-independent intent first; optional overrides for desktop/tablet/mobile. Use fluid layout. 3D complexity budgets and camera framing vary by device. Never hide critical content in WebGL.

## Evolution
Use semver schemaVersion and migration functions. Preserve scene IDs across edits. Renderer reports unsupported primitives as validation errors, not silent omissions.

## Example
See `schemas/story-spec.example.json`; validation contract in `schemas/story-spec.schema.json`.
