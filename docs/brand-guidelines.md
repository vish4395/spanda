# Brand Guidelines v0.6 — Spanda

> **Status: chosen, pending clearance.** The name has had a light web-collision check only. It needs a formal trademark search (classes 9 and 42) and domain/handle availability before any rename of packages, app ID or repo. Until then the codebase keeps `ai-cinematic-studio` / `@studio/*`.
>
> Studio UI tokens remain owned by `design-system/ai-cinematic-studio/MASTER.md`. This file defines identity, voice and marketing use, and must not contradict MASTER.

## Quick Reference

| Item | Value |
|---|---|
| Name | **Spanda** (product: *Spanda Studio*) |
| Pronunciation | SPAN-duh (Sanskrit: SPUN-duh; both are fine) |
| Tagline | **Stillness, set in motion.** |
| Primary Color | #4B57E0 |
| Secondary Color | #8E9AF7 |
| Logo | Kolam S: one unbroken Neel line around two Diya dots |
| Canvas | #0E0E11 |
| Audience | Western-first, global |
| Origin | Designed and built in India |
| Personality | The calm director: assured, precise, generous |

## 0. Name & Story

**Spanda** (Sanskrit, स्पन्द) is the subtle pulse or vibration that sets stillness in motion: the first movement that brings something still to life.

That is what the product makes. A Spanda website is still until the viewer scrolls, and then it pulses into motion, scene by scene. **The viewer's movement brings the story to life.**

### Strategy: global name, Indian soul
The audience is Western-first, so anything that affects usability (UI labels, docs, onboarding, marketing headlines) is plain, natural English. The Indian heritage lives a layer deeper, in the name's meaning, the logo's symbolism, color names, codenames and a confident origin line. It is discovered, not imposed, the way IKEA carries "Swedish" or Muji carries "Japanese".

Why Spanda:
- **Easy to say.** Two syllables, no difficult sounds, spelled as spoken. It reads as a modern product name to Western users.
- **Meaningful.** The meaning describes the product literally, which gives it a story worth telling.
- **Ownable.** It is unused in software. Existing uses are in yoga and wellness, a different category.
- **Extensible.** Spanda Studio (desktop app), `spanda` (future CLI), `@spanda/*` (packages), *a Spanda* (an exported story site, informal).

Rejected: *Kinora* (strong, but no Indian layer), *Yavanika* and *Sutradhar* (too hard for a Western-first audience; reused as codenames below), *Maya* (Autodesk Maya), *Rasa* (Rasa AI framework), *Leela*, *Sutra*, *Mudra*, *Tala* (crowded).

## Positioning

**For** designers, developers, agencies and creators **who want** cinematic, scroll-driven 3D websites without generic templates, **Spanda** is a local-first desktop studio that **directs** an idea and references into an original story, then builds, tests and exports real HTML or React source you own. **Unlike** hosted site builders, there is no lock-in, no backend required, and every export ships with its test results and license report.

### Brand pillars
| Pillar | Promise | Proof in product |
|---|---|---|
| **Direction** | It asks like a director, not a form. | One visual question at a time; 2–4 original directions; storyboard approval |
| **Craft** | Cinematic *and* correct. | Cross-browser screenshots, a11y and perf checks, reduced-motion fallbacks |
| **Ownership** | Your story, your code, your machine. | Local-first; HTML or React export; SBOM and asset provenance |

## 1. Color Palette

Colors are inherited from the studio design system, so the brand and the app read as one. Names carry the heritage layer; users only see good color.

**Why indigo:** the word comes from the Greek *indikón*, "from India", because the dye did. The color carries the same hidden-India idea as the name and the kolam, and it moves Spanda away from the violet most AI products use.

### Primary Colors
| Name | Hex | Use |
|---|---|---|
| Neel | #4B57E0 | Primary CTA fill, selected indicator, logo line on light backgrounds |
| Neel Light | #8E9AF7 | Logo line on dark, accent text, links, focus ring |
| Neel Deep | #1E2A78 | Wordmark and dots on light backgrounds, print |

### Secondary Colors
| Name | Hex | Use |
|---|---|---|
| Diya Gold | #E9B04C | The two dots of the logo (lamps on a kolam; gold is also the color of Guru, Jupiter, the planet of growth in Vedic tradition), plus one marketing highlight per composition. Never in studio chrome, where it would read as the warning state. |

### Studio interface: muted
Inside Spanda Studio the accent is a muted tint of Neel (`#5862C4` buttons, `#9AA1DE` links and focus), and the area around the preview is a true neutral gray (`#121212`). A tool for colorful, cinematic websites must not compete with them or distort how their colors look. Full-strength Neel and Diya Gold are for the logo, the website and marketing. Tokens live in `design-system/ai-cinematic-studio/MASTER.md`.

### Neutral Palette
| Name | Hex | Use |
|---|---|---|
| Night | #0E0E11 | Canvas, default backgrounds |
| Panel | #16161B | Panels |
| Raised | #1E1E25 | Raised surfaces |
| Moonlight | #ECECF1 | Primary text, mark on dark (mono) |
| Ash | #A1A1AA | Secondary text |

### Semantic Colors
Use the MASTER status tokens (`--success`, `--warning`, `--danger`), always with an icon and a label.

### Accessibility
Contrast figures are in MASTER. White on Neel is 5.6:1, so Neel may carry white text. Neel Light is 7.5:1 on Night and is a text and focus color on dark surfaces only. Neel Deep is 10.8:1 on Moonlight. Diya Gold is 9.9:1 on Night but under 2:1 on light backgrounds, so on light the logo dots switch to Neel Deep.

## 2. Typography

- **Studio UI:** the MASTER system stacks. No bundled or CDN fonts, because the app works offline with zero font-license surface.
- **Wordmark:** custom-drawn and shipped as outlined SVG paths, never a live font. Lowercase `spanda`, geometric sans, medium weight, slightly open tracking (+2%). The stroke weight matches the Kolam S line so mark and wordmark read as one drawing.
- **Devanagari mark (स्पन्द):** a secondary mark only, for the About page, Indian launches, merchandise and credits. Never in the primary lockup or the UI. It must be drawn by someone fluent in Devanagari type, never as faux-Devanagari Latin.
- **Marketing site:** system stack by default. Any display font must be OFL-licensed, self-hosted and added to `licenses/inventory.json` first.
- Type scale for marketing: 14 / 16 / 20 / 28 / 44 / 72px; headings 600 with tight leading (1.1); body 400 at 1.5.

## 3. Logo Usage

### Concept: the Kolam S
One unbroken line loops around two dots and forms an **S**. In South India a *kolam* is drawn at the doorstep each morning: a single continuous line weaving around a grid of dots. In the mark, the dots are scenes and the line is the scroll that carries the viewer from one to the next, in one continuous take. The dots are colored Diya, like oil lamps placed on a kolam. Western viewers see a clean S monogram; anyone who knows kolam sees the tradition.

Drawing rules:
- The line is one stroke with round caps and constant weight; it never breaks or overlaps.
- Each dot sits inside a curve of the S, centered in its counter. Never put a dot on the spine or let a vertical stroke cross the S, which would read as a dollar sign.
- Reference geometry (64-unit grid): two 11-unit arcs of 250° on centers (32,20) and (32,42), stroke 5; dots of radius 3.4 at the arc centers. The final artwork refines optical balance from this.

### Colors of the mark
| Background | Line | Dots | Wordmark |
|---|---|---|---|
| Night / dark | Neel Light #8E9AF7 | Diya #E9B04C | Moonlight #ECECF1 |
| Moonlight / light | Neel #4B57E0 | Neel Deep #1E2A78 | Neel Deep #1E2A78 |
| Single color | Moonlight or Night throughout | same | same |

### Files
SVG sources live in `docs/brand/assets/`: `spanda-logo.svg` (dark backgrounds), `spanda-logo-light.svg`, `spanda-mark.svg`, `spanda-icon.svg`, and `spanda-icon-mandana.svg`. One-page summary: `docs/brand/branding.md`.

### Mandana special edition
A red-ochre (Geru `#9B2F1E`) tile with a turmeric (Haldi `#F2B829`) S and chalk-white (Khadiya `#FFF4E2`) dots inside a dotted chalk border, after the Mandana folk art of Rajasthan and Madhya Pradesh. Used **only** where heritage should be on show: the About page, India launch material, festival editions (Diwali, Holi), merchandise and stickers. Never as the default app icon or in the studio interface.

### Variants
| Variant | Use |
|---|---|
| Lockup (mark + `spanda`) | Website header, README, splash |
| Mark alone | App icon, favicon, avatars |
| Wordmark alone | Inline in text-heavy contexts |
| Devanagari lockup (mark + स्पन्द) | About page, India launches, merch |
| Single color (Moonlight or Night) | Print, embossing, single-color contexts |

**App icon:** the dark-background mark on a Night rounded square, with a faint Neel radial glow behind the S (the only gradient allowed in the identity).

### Clear Space
On every side, at least the height of one loop of the S.

### Minimum Size
Mark 16px (stroke thickened to 2px on the 16-unit grid, dots kept); lockup 96px wide.

### Don'ts
- No glows, neon, bevels or ornamental borders
- No mandalas, paisley, lotus or deity motifs added to or around the mark
- Don't rotate, mirror or stretch the S
- Don't move the dots out of the curves or add more dots
- Don't put the mark on Diya or on busy imagery without a Night scrim
- Don't recolor outside the palette

**Signature motion:** on launch or hover, the line draws itself from the top over about 1.1s, then the two dots land, the only time the brand moves on its own. Disabled under `prefers-reduced-motion`, where the finished mark is shown.

## 4. Voice & Tone

### Brand Personality
**The calm director.** It knows the craft, explains its choices and hands the final cut to you. It doesn't hype and doesn't flatter. It is quietly proud of where it comes from and never makes a costume of it.

### Voice Chart
| We are | We are not |
|---|---|
| Assured | Boastful |
| Precise | Jargon-heavy |
| Warm | Cute |
| Honest about limits | Apologetic or vague |
| Proud of our origin | Exotic or mystical |

### Film vocabulary (use lightly)
Use it in secondary copy and empty states, but keep functional labels plain:

| Concept | Flavor term | UI label stays |
|---|---|---|
| Generation iteration | take | "Version 3" |
| QA screenshots review | dailies | "Test results" |
| Export | final cut | "Export" |

### Tone by Context
| Context | Tone | Example |
|---|---|---|
| Onboarding | Inviting, brief | "Tell me the story in one line. We'll find the look together." |
| Visual question | Curious, one thing at a time | "Should the camera feel handheld or on rails?" |
| Progress | Factual | "Rendering scene 3 of 5 in Firefox, tablet." |
| Failure | Plain, actionable | "Claude Code CLI isn't signed in. Open a terminal and run `claude` to sign in, then retry." |
| Marketing | Confident, concrete | "Stillness, set in motion. Cinematic websites, exported as code you own." |
| About page | Proud, brief | "Spanda is Sanskrit for the pulse that sets stillness in motion. Designed and built in India." |

### Prohibited Terms
- "magic", "one-click", "effortless", "revolutionary", "unlimited"
- "ancient wisdom", "mystical", "exotic", "spiritual AI": the heritage is confidence, not a theme
- "copy any site", "clone", or anything implying reference URLs grant reuse rights
- "100% commercially safe" or "guaranteed licensed". Say "ships with a license and provenance report."
- Implied provider partnership ("powered by Claude", "official Codex app"). Say "works with the Claude Code or Codex CLI you already use."

## 5. The Heritage Layer

Where the Indian touch lives, and where it does not:

| Place | Treatment |
|---|---|
| Name meaning | One line on the About page, splash screen and press kit |
| Logo | Kolam S symbolism and Diya-colored dots (documented, never explained in the UI) |
| Color | Neel (indigo, from the Greek for "from India") and Diya, in brand docs and tokens |
| Origin line | "Designed and built in India" in the footer, installer, About and credits |
| AI director agent | Internal and credits name: **Sutradhar** ("holder of the threads", the director of Sanskrit drama). The UI says "Director". |
| Release codenames | Terms from classical Indian theatre, in order: *Yavanika* (curtain), *Ranga* (stage), *Natya* (drama), *Chhaya* (shadow), *Darpana* (mirror)… |
| Devanagari mark | About page, India launches, merch |
| **Not here** | UI labels, docs, error messages, onboarding, headline copy: plain English only |

## 6. Imagery Guidelines

### Photography Style
The hero imagery is always **real Spanda output**, shown in a device frame on Night. No stock photography of people at laptops.

### Illustrations
Minimal line diagrams in Ash and Neel Light that explain the pipeline (idea → storyboard → scenes → tests → export). No robots, brains, sparkles or ornamental Indian motifs.

### Icons
Lucide at 1.75 stroke, matching the studio (pending license inventory, per MASTER).

## 7. Design Components

Buttons, spacing (4px base) and radius (6/10/14) follow MASTER exactly. Marketing pages reuse them so the website feels like the app.

## 8. Open Source & Editions

Spanda is **open core**: the studio is free and open source on GitHub, and premium features are sold later as add-ons.

### Brand architecture
| Layer | Name | License | Where |
|---|---|---|---|
| Free core | **Spanda Studio** (just "Spanda" in conversation) | Apache-2.0 (proposed) | Public GitHub repo |
| Paid tier | **Spanda Pro**, the umbrella for every paid add-on | Commercial EULA | Separate private repo, installed into the core |
| Individual add-ons | Descriptive English names under Pro: *Pro Scene Library*, *Pro Team Review*… | Commercial EULA | Same as above |

- There is one paid brand, "Pro", not a new name per add-on. Western buyers should understand what they are buying from the name alone.
- Add-on names are plain English. Theatre codenames stay internal (see §5).
- In the UI, paid features carry a small "Pro" text chip (Neel Light outline plus a lock or sparkle icon from the Lucide set), never color alone and never Diya.

### Promises (public, in the README)
These protect community trust, which is the asset open core depends on:
1. **Core stays free.** A feature that ships in the open-source core is never moved behind Pro.
2. **Your output is yours.** Exported websites carry no watermark, attribution requirement or Spanda license, whether made with free or Pro.
3. **No resold AI access.** Pro never sells or proxies AI provider subscriptions. You bring your own provider (official CLI or API key); Pro sells features, not tokens.
4. **Works offline.** Pro license checks work locally without phoning home on every launch.

### Legal guardrails (decide before the first public release)
- **Core license: Apache-2.0** (recommended). It is permissive and enterprise-friendly, includes a patent grant, and §6 explicitly grants no trademark rights. AGPL was considered and rejected: it deters adoption and contributors, and its network clause adds little to a desktop app.
- **Export templates and runtime code:** MIT-0 or 0BSD, so generated sites carry no obligations (promise 2).
- **Trademark is the moat**, not the code. File "Spanda" (word) and the logo before launch, and publish `TRADEMARKS.md`: forks are welcome but must rename and rebrand, as Firefox and Rust require.
- **Contributions:** DCO sign-off (lighter than a CLA). Use a CLA only if you might relicense the core later.
- **Pre-publication audit:** third-party skills in `skills/` and the license gate (`pnpm licenses:check`), git history for secrets, and asset provenance in the repo.
- **Architecture:** Pro needs a public extension boundary in the core (an add-on API alongside the skill registry). The core must build and run fully without any Pro code present.

### GitHub launch kit
- Repo: `spanda-studio/spanda` (pending handle availability)
- README: hero GIF of a real exported story site, one-line pitch, quick start, the Promises section, and a free-vs-Pro line ("Pro add-ons are coming; the core stays free.")
- Social preview image 1280×640: mark and wordmark on Night with a single pulse ring
- `LICENSE`, `TRADEMARKS.md`, `CONTRIBUTING.md` (DCO), `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Messaging: "Open source. Local-first. Cinematic websites, exported as code you own."

## AI Image Generation

### Base Prompt Template
"Dark cinematic product scene, near-black #0E0E11 environment, single soft indigo (#4B57E0) key light, one small warm amber oil-lamp accent (#E9B04C), generous negative space, one flowing continuous line motif, crisp, no text, no logos."

### Style Keywords
continuous line, flowing S-curve, stillness, depth, layered parallax planes, quiet, precise, editorial

### Visual Don'ts
Neon cyberpunk, glowing brains, circuitry, purple gradient blobs, generic AI violet, saffron-and-gold palettes, mandalas, temples, deities, "mystic India" clichés.

## Next Steps
1. Trademark knockout search: USPTO, EUIPO, WIPO Global Brand DB, Indian Trade Marks Registry, classes 9 and 42.
2. Domains (`spanda.studio`, `spanda.app`, `getspanda.com`), GitHub org, npm `@spanda` scope, social handles.
3. Draw the final Kolam S, wordmark and Devanagari mark as SVG (from the reference geometry in §3) and validate them at 16px.
4. If cleared: rename `package.json` names, Electron `productName`/`appId`, window title and docs in one commit.

## Changelog
- v0.6 (2026-11-02): Studio interface switched to muted Neel tints and a neutral preview surround; full-strength colors kept for the logo and marketing.
- v0.5 (2026-11-02): Logo dots changed from Diya amber to Diya Gold #E9B04C. Added the Mandana special edition and the SVG asset files.
- v0.4 (2026-11-02): Logo changed to the Kolam S (replacing bindu and pulse, which read as a target or Wi-Fi icon). Accent changed from violet to Neel indigo with Diya dots; studio tokens updated to match.
- v0.3 (2026-11-02): Added the open-core model: Spanda Pro add-on architecture, public promises, license and trademark guardrails, and the GitHub launch kit.
- v0.2 (2026-11-02): Name changed to Spanda. Added the heritage layer and the bindu-and-pulse logo; renamed the colors.
- v0.1 (2026-11-01): Proposed Kinora, with positioning, voice and identity derived from the studio design system.
