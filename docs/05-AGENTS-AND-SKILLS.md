# Agent Orchestration and Skill System

## Provider abstraction
Interface: `probe()`, `startRun(input, context, budget)`, `streamEvents()`, `cancel()`, `getCapabilities()`. Return structured events: token/text, tool request, artifact, warning, error, completion. Do not assume all CLIs support identical streaming or JSON modes. Capability negotiation mandatory.

Supported candidates:
- Official Codex CLI via user-managed supported login.
- Official Claude Code CLI via user-managed supported login.
- OpenCode / Kilo via documented CLI modes, subject to version and terms.
- BYOK API adapters via official SDKs.
Provider login is not equivalent to API credits. Do not proxy subscriptions to other users or scrape credentials.

## Agent roles (logical, not always separate models)
- Discovery Director → structured questions.
- Reference Analyst → facts, screenshots, style observations.
- Creative Director → original art direction.
- Story Architect → validated StorySpec.
- 3D Director → scenes and assets.
- HTML Engineer → native HTML output.
- React Engineer → native React output.
- QA Critic → observed defects and repair requests.
- Licensing Reviewer → evidence and blockers.
One orchestrator manages state and approvals; role skills can be loaded into a single provider.

## Skill contract
`id`, `version`, `source`, `commit`, `license`, `permissions`, `triggers`, `inputs`, `outputs`, `supportedTargets`, `evaluationCases`, `dependencies`.
Skill files can include `SKILL.md`, references, scripts, examples. Scripts require separate permission review; Markdown is not automatically executable.
Use progressive disclosure: metadata → relevant references → full instructions only when needed.

## External candidates (evaluate and pin)
- https://github.com/viettranx/3dviz-pro-max
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- https://github.com/freshtechbro/claudedesignskills
- https://github.com/vercel-labs/agent-skills
- https://github.com/anthropics/skills
Do not blindly install bundles. Confirm current file-level licenses and embedded assets before distribution. Never assume skill guidance makes referenced commercial SDKs free.

## Skill selection
Select by project phase + scene type + output target + capabilities + permissions + evaluation score. For a scene edit, retrieve only relevant scene context and 2–4 skills, not the entire catalog.

## Evaluation harness
Five benchmark briefs: heritage, product launch, portfolio, SaaS, educational story. For each: generate HTML and React; measure build success, screenshots, browser issues, accessibility, performance, originality rubric, license blockers. Record provider/model, prompts, skill versions and artifact hashes.

## Run budgets
Configurable max cost/tokens, max repair attempts, max elapsed time, max generated files. Request user approval before expensive operations, external uploads or deployment.
