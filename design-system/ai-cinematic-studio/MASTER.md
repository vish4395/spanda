# AI Cinematic Studio — Desktop UI Design System (MASTER)

Scope: the **studio app UI** (Electron renderer). It does **not** style generated websites — those take their look from each project's `StorySpec.design`.
Page-specific overrides go in `pages/<page>.md` and win over this file.

Derived from `docs/03-UX-SCREENS.md` ("premium creative workstation, dark neutral canvas, restrained violet accent"; the accent was moved from violet to Neel indigo by the brand decision in `docs/brand-guidelines.md`) plus ui-ux-pro-max searches. The automated `--design-system` result was rejected in parts: it suggested a landing-page pattern, GSAP (blocked by docs/07 pending license review) and CDN-loaded Google Fonts (the studio must work offline and ship no unreviewed fonts). The palette was adapted from the "Photo Editor & Filters" palette (violet on dark) on a neutral gray canvas; the accent is now Neel indigo (brand v0.4).

## Principles
1. **Preview is the hero.** Chrome is quiet and neutral; color is reserved for the accent, state and the user's content.
2. **One primary action per view** (Neel). Everything else is secondary/ghost.
3. **State never relies on color alone** — every status has an icon + text label.
4. **Keyboard-first:** full tab order, visible 2px focus ring, reorder buttons instead of drag-only.
5. **Calm motion:** 120–200ms transitions on opacity/transform only; none under `prefers-reduced-motion`.

## Color tokens (dark — default)
The studio uses **muted** tints of the brand colors (about 50% saturation instead of 70–87%), as pro creative tools do: the chrome recedes and the user's website carries the color. Full-strength brand colors appear only in the logo.

| Token | Value | Use | Verified contrast |
|---|---|---|---|
| `--bg` | `#0E0E11` | app canvas | — |
| `--panel` | `#16161B` | sidebars, inspector, bottom panel | — |
| `--raised` | `#1E1E25` | cards, inputs, menus | — |
| `--fg` | `#ECECF1` | primary text | 16.4 on bg · 14.1 on raised |
| `--fg-muted` | `#A1A1AA` | secondary text, labels | 7.5 on bg · 6.5 on raised |
| `--accent` | `#5862C4` (muted Neel) | primary button fill, selected indicator | white text 5.3 · 3.6 on bg · 3.4 on panel · 3.1 on raised |
| `--accent-hover` | `#4C55B0` | primary button hover | white text 6.3 |
| `--on-accent` | `#FFFFFF` | text on accent | — |
| `--accent-text` | `#9AA1DE` (muted Neel Light) | accent-colored text/links, focus ring | 7.8 on bg · 7.3 on panel |
| `--stage` | `#121212` | background around the preview frame; true neutral (no hue) so users judge their site's colors accurately | — |
| `--brand-neel` | `#8E9AF7` (Neel Light) | **logo line only** (top-bar Kolam S) | 7.5 on bg |
| `--brand-gold` | `#E9B04C` (Diya Gold) | **logo dots only** (top-bar Kolam S); never UI state, it would read as warning | 9.9 on bg |
| `--divider` | `#2A2A33` | **decorative** separators only (panel edges, rules) | 1.4 — never carries information |
| `--control-border` | `#71717A` | input/button outlines | 3.7 on panel (≥3:1 non-text) |
| `--success` | `#4ADE80` | passed (with check icon) | 10.4 on panel |
| `--warning` | `#FBBF24` | review required (with alert icon) | 10.8 on panel |
| `--danger` | `#F87171` | failed/blocked (with x icon) | 6.5 on panel |

Light mode is post-M0 (docs/03: "offer light mode later"); it needs its own contrast verification, not inverted values.

## Typography
System stacks only — no bundled or CDN fonts (offline, zero font-license surface):
- UI: `system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif` (covers macOS, Windows, Linux, ChromeOS)
- Code/logs: `ui-monospace, "SF Mono", "Cascadia Mono", "Ubuntu Mono", "Noto Sans Mono", monospace`
- Scale (px): 12 (meta only) · 13 (dense UI) · 14 (body) · 16 (section) · 20 (page title) · 28 (welcome). Weights 400/500/600. Line-height 1.5 body, 1.25 headings. Tabular figures for job timers/sizes.

## Spacing, radius, elevation, layering
- Spacing: 4px base — 4, 8, 12, 16, 24, 32, 48.
- Radius: 6 (controls) · 10 (cards) · 14 (preview frame).
- Elevation: borders + surface steps (bg → panel → raised); one shadow token for menus/dialogs: `0 8px 24px rgb(0 0 0 / 0.45)`.
- z-index: content 0 · sticky panels 10 · menus 40 · dialogs 100 · toasts 1000.

## Layout (from docs/03)
Top bar 48px · left nav 240px · inspector 320px (collapsible) · bottom panel 200px (collapsible, resizable via keyboard too) · min window 1280×800; below 1100px the inspector becomes an overlay.

## Components & states
- Buttons: primary (accent fill), secondary (raised + control-border), ghost. Min height 32px desktop, hit target ≥24×24 (WCAG 2.2). Hover: lighten surface; active: no layout shift; disabled: 0.45 opacity + `disabled` attr; busy: spinner + `aria-busy`, label stays.
- Focus: `outline: 2px solid var(--accent-text); outline-offset: 2px` on `:focus-visible`. Sticky bars use `scroll-padding` so focus is never hidden.
- Status chips: icon + text (“Passed”, “Review required”, “Blocked”, “Running…”). Job progress uses `role="status"` / `aria-live="polite"`; errors `role="alert"` with a retry action.
- Preview frame: device presets 1440×900 / 768×1024 / 390×844; frame label shows origin (`127.0.0.1:port`) so users can see it is isolated.
- Icons: one stroke set (Lucide, ISC — add to license inventory before use), 16/20px, 1.75 stroke; decorative icons `aria-hidden="true"`; icon-only buttons need `aria-label`. No emoji as icons.

## Avoid
Pure #000 canvas; using `--divider` for control outlines (use `--control-border`); neon glows; gradients on chrome; more than one Neel primary per view; color-only status; hover-only actions; drag-only reordering; CDN assets; GSAP or any unreviewed animation library.
