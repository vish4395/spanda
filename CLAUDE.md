# Claude Code project entrypoint

Follow `AGENTS.md` as the shared source of truth. Start by reading `README.md` and the relevant `docs/` file(s). Do not assume Claude subscription sign-in can be embedded in third-party products: use supported official CLI operation locally, respecting provider terms, and expose provider availability/errors honestly.

For each task:
1. Summarize intended behavior and acceptance criteria.
2. Identify affected packages and dependencies.
3. Implement the smallest tested vertical slice.
4. Run checks and inspect actual rendered output.
5. Report remaining risks and the next milestone.

For initial implementation, execute `prompts/01-bootstrap.md`. Do not skip HTML support.
