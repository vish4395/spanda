# Commercial Licensing, Assets, Privacy & Security

## Principle
Users may publish, modify, sell and self-host output to the extent our platform and third-party rights allow. We must not guarantee exclusive copyright or unrestricted commercial use of assets we do not control.

## License policy
- Prefer MIT, BSD-2/3-Clause, Apache-2.0, ISC, CC0 (for suitable assets) with obligations preserved.
- GPL, AGPL, LGPL, MPL, custom licenses, non-commercial/educational-only, no-redistribution, and proprietary terms require specific policy/legal review.
- Separate **skill content license**, **runtime dependency license**, **asset license**, **font license**, and **AI provider terms**.
- Example: a MIT-licensed skill discussing a proprietary animation library does not license that library.
- Review GSAP/Webflow licensing carefully before using it inside a visual website/animation builder. Do not include by default pending review.
- License findings are versioned and tied to exact package/asset hashes.

## Asset provenance fields
`assetId`, `sourceUrl`, `creator`, `licenseId`, `licenseUrl`, `acquiredAt`, `allowedUses`, `attribution`, `redistribution`, `evidence`, `hash`.
Unknown rights → block commercial-ready export or require replacement/user-supplied rights confirmation. User-supplied confirmation is recorded but not independently verified.

## Export manifest
`LICENSES.md`, `THIRD_PARTY_NOTICES.md`, `ASSET_CREDITS.md`, `sbom.cdx.json`, build instructions, dependency lockfile. SBOM generation with CycloneDX and vulnerability scans can be integrated after dependency review.

## Security
- Reference fetching: allow only http/https, resolve and validate DNS/IP on each redirect, block localhost/private/reserved/link-local/cloud metadata ranges, cap response size/time/redirects, no authenticated browser cookies.
- Browser capture: isolated context, no host filesystem/network access, strict timeouts and download restrictions.
- Skills: signed/pinned or checksum-verified sources, review scripts, explicit permissions, disable untrusted scripts by default.
- AI agents: no shell execution without policy; approved commands with argument arrays, bounded resources, logs and cancellation.
- Electron: contextIsolation, sandbox, no Node in renderer, CSP, safe IPC, safe external link handling, auto-update signature verification.
- Secrets: OS keychain/credential vault; redact logs; never include secrets in prompts or exports.
- Generated code: isolate builds/previews; scan dependencies and prevent access to host secrets.

## Provider legal checklist
Verify each CLI's permitted invocation, auth, automation and third-party app integration terms before release. Existing ChatGPT/Claude subscriptions are not equivalent to unrestricted API or resale rights. Prefer official local CLI use and BYOK SDK integrations.

## Release gate
Commercial status = `pending` / `review_required` / `passed` / `blocked`; explain evidence, not absolute legal guarantee.
