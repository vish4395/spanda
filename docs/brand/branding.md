# Spanda Studio — Branding

One-page summary. The full rules are in [`../brand-guidelines.md`](../brand-guidelines.md); the visual board is [`spanda-brand-board.html`](spanda-brand-board.html) (opens offline).

> **Status:** name chosen, trademark search pending (roadmap T031). Code keeps `ai-cinematic-studio` / `@studio/*` until it clears.

## Name

**Spanda** (Sanskrit स्पन्द, SPAN-duh): the subtle pulse that sets stillness in motion. A Spanda website is still until the viewer scrolls, and then it comes alive.

- **Product:** Spanda Studio, an open-source desktop studio for cinematic, scroll-driven 3D story websites
- **Tagline:** Stillness, set in motion.
- **Audience:** Western-first and global, with a quiet "Designed and built in India" heritage
- **Personality:** the calm director: assured, precise, warm, honest about limits

## Logo: the Kolam S

One unbroken line loops around two dots and forms an **S**. It's based on the *kolam*, the continuous line drawn around a grid of dots at South Indian doorsteps every morning. The dots are scenes, the line is the scroll that carries you through them, and the dots are gold like oil lamps on a kolam.

| File | Use |
|---|---|
| [`assets/spanda-logo.svg`](assets/spanda-logo.svg) | Logo for dark backgrounds (default) |
| [`assets/spanda-logo-light.svg`](assets/spanda-logo-light.svg) | Logo for light backgrounds |
| [`assets/spanda-mark.svg`](assets/spanda-mark.svg) | Mark alone, for avatars and inline use |
| [`assets/spanda-icon.svg`](assets/spanda-icon.svg) | App icon |
| [`assets/spanda-icon-mandana.svg`](assets/spanda-icon-mandana.svg) | Mandana special edition: About page, India launches, Diwali or Holi editions, merch only |

Rules: never rotate, mirror or stretch the S; dots always sit inside the curves; no glows, outlines or ornaments; keep clear space of one S loop on every side; minimum lockup width 96px.

The wordmark is drawn as single-weight line paths matching the S (no font needed). These SVGs are production-ready drafts; a final optical refinement and 16px favicon are roadmap T033.

## Colors

| Name | Hex | Use |
|---|---|---|
| Neel | `#4B57E0` | Primary button, logo line on light backgrounds |
| Neel Light | `#8E9AF7` | Logo line on dark, links, focus ring |
| Neel Deep | `#1E2A78` | Wordmark and dots on light backgrounds |
| Diya Gold | `#E9B04C` | Logo dots and one marketing highlight; never in the studio interface |
| Night | `#0E0E11` | Background |
| Moonlight | `#ECECF1` | Text, wordmark on dark |
| Ash | `#A1A1AA` | Secondary text |

"Indigo" comes from the Greek *indikón*, "from India". Gold is the color of Guru (Jupiter), the planet of growth in Vedic tradition.

Mandana special edition only: Geru `#9B2F1E` (red ochre), Haldi `#F2B829` (turmeric), Khadiya `#FFF4E2` (chalk white).

## Type

System fonts only in the studio (offline, no font licenses). Wordmark is lowercase `spanda`, monoline, geometric.

## Voice

Plain English everywhere. Say "Stillness, set in motion" and "exported as code you own". Never say "magic", "one-click", "clone any site", "100% commercially safe", "ancient wisdom" or "powered by Claude".

## Heritage, quietly

"Designed and built in India" in the footer and credits. The AI director is called *Sutradhar* in the credits (the UI says "Director"). Release codenames come from classical Indian theatre, starting with *Yavanika* (the curtain). No saffron-and-gold, mandala or deity imagery in the main brand.

## Prompt for ChatGPT (image generation)

Attach `assets/spanda-logo.svg` (or a PNG of it) as a reference, then use:

```text
Design a refined, professional logo for "Spanda", a desktop studio for cinematic, scroll-driven 3D websites. Use the attached logo as the exact concept; refine it, don't replace it.

Mark: a single unbroken monoline stroke forming a lowercase-style "S" made of two round loops, with one small solid dot centred inside each loop (inspired by a South Indian kolam: one continuous line drawn around dots). Round line caps, even stroke weight, no breaks or overlaps.
Wordmark: "spanda" in lowercase, geometric monoline letters with the same stroke weight as the S, placed to the right of the mark.
Colors: S line #8E9AF7 (soft indigo), dots #E9B04C (lamp gold), wordmark #ECECF1, on a near-black #0E0E11 background.
Style: flat vector, minimal, calm and premium, generous spacing, perfectly balanced.
Avoid: gradients, glows, 3D effects, shadows, extra dots or ornaments, mandalas, a dollar-sign look (no vertical line through the S), any other text.
Output: a centred logo on a plain background, plus the mark alone as a rounded-square app icon.
```

Image generators can't produce exact geometry or real vector files. Treat the result as a design reference, and keep the SVGs in `assets/` as the source of truth.
