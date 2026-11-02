# Security policy

## Reporting a vulnerability
Please report vulnerabilities privately through GitHub's private vulnerability reporting:
**https://github.com/vish4395/spanda/security/advisories/new**

Do not open a public issue, pull request or discussion for a suspected vulnerability. Include what you found, the steps to reproduce it, the affected version or commit, and the impact you expect. A maintainer will acknowledge the report, keep you informed while it is investigated, and credit you in the advisory unless you prefer otherwise.

## Supported versions
The project is pre-1.0. Security fixes land on the latest release and `main` only.

## Scope
In scope, among others:
- Escapes from the preview sandbox (the generated site reaching the studio window, IPC, files or the network beyond the loopback preview server).
- Privilege escalation from the Electron renderer, or IPC calls that bypass validation.
- SSRF or code execution through reference URL analysis or skills.
- Path traversal or symlink escapes in project storage, preview serving or export.
- Generated websites that execute content from a StorySpec as code (XSS, CSS or URL injection).
- Secrets, tokens or host paths leaking into logs, exports or provider prompts.

Out of scope: vulnerabilities in third-party AI provider CLIs or services themselves (report those to the provider), and issues that need an already compromised machine.

## Known limitations
Generated React projects are installed and built (`npm ci`, `vite build`) as child processes without OS-level sandboxing or network limits; see the risk register in `docs/10-DECISIONS-AND-RISKS.md`.
