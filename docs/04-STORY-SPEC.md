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

## Design language (0.2.0)
`design` holds `theme`, `colors` (`background`, `foreground`, `accent`, `secondary`, all hex), `typography` (`heading`, `body` font stacks) and `style`. Every `style` field is an enum, so a StorySpec can never carry raw CSS:

| Field | Values |
|---|---|
| `mode` | dark, light |
| `scale` | quiet, editorial, monumental |
| `headingCase` / `headingWeight` | normal, uppercase / light, regular, bold |
| `radius` | sharp, soft, round |
| `texture` | none, grain, grid, lines, dots |
| `density` | airy, balanced, compact |
| `reveal` / `easing` | fade-up, mask, blur, scale, slide / gentle, snappy, dramatic |
| `heroArt` | faceted, particles, ribbons, terrain, rings, none |
| `panelArt` | arcs, mesh, stripes, grid, blobs, duotone |

Scenes compose with `visual.layout` (chapters: split, split-reverse, centered, full-bleed, editorial, asymmetric, stacked) and `visual.variant` (hero: bottom-left, centered, top-left, split, monumental; scroll-reveal: cards, timeline, sticky; model-showcase: split, stage; gallery: carousel, grid, mosaic; cta: card, banner, minimal). The first variant is the default.

Both generators map `design` through one function (`renderDesignTokensCss` and `designRootAttributes` in `@studio/contracts`) onto CSS custom properties and `<html>` data attributes, and share one stylesheet, so HTML and React cannot drift. Art directions come from the story engine's design families (`packages/story-engine/src/directions.ts`): seeded, deterministic per project, contrast-checked (body text ≥ 7:1, accent ≥ 4.5:1). The 0.1.0 → 0.2.0 migration adds the style that reproduces the 0.1.0 look.

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
