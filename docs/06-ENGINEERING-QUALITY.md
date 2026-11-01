# Engineering Quality & QA Gates

## Website acceptance pipeline
1. Validate StorySpec and asset manifest.
2. Generate source for selected target(s).
3. Install only approved dependencies from lockfile.
4. Typecheck/lint/build (React) or validate HTML/CSS/JS (HTML).
5. Start isolated preview and check routes/console/network.
6. Capture screenshots at representative desktop (1440×900), tablet (768×1024), mobile (390×844).
7. Run Chromium, Firefox, WebKit smoke tests; verify fallback on WebGL disabled.
8. Check keyboard focus, alt text, headings, labels, contrast and reduced-motion.
9. Run Lighthouse where supported, plus manual/mobile testing.
10. Verify license/asset report; only then enable export.

## Browser support
Latest stable Chromium, Firefox and WebKit engines for MVP; real Safari/iOS and Android hardware spot-check before public release. Playwright WebKit is useful but not a complete substitute for real Safari.

## Performance targets
Aim for field Core Web Vitals: LCP ≤2.5s, CLS ≤0.1, INP ≤200ms at p75; measure actual field data when available. Establish separate 3D budgets per device and network. Prefer compressed glTF/GLB, responsive images, deferred assets, lower mobile pixel ratio, capped draw calls, and graceful 2D fallback.

## Visual QA rubric (0–5 each)
Composition, typography, color harmony, story coherence, motion restraint, 3D craft, mobile art direction, originality, interaction clarity, accessibility. Record observed evidence; do not treat model scores as ground truth.

## Required automated tests
- Unit: schemas, transformations, provider capability checks, license rules.
- Integration: StorySpec → HTML and React export; sandbox path checks.
- E2E: project creation → discovery → approve → generate → preview → export.
- Regression: snapshot screenshots with approved thresholds and manual review for intended visual changes.
- Security: malicious URL SSRF, prompt injection in fetched pages, path traversal, zip-slip, malicious skill scripts.

## Failure policy
Never hide errors behind a success state. Build failures trigger bounded targeted repair; failed browser/license gates block `commercial-ready` status. Save logs with secrets removed.
