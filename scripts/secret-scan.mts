// Pre-publication secret scan (roadmap T037): every commit's diff and the working tree are
// checked for common credential formats and sensitive file names. Dependency-free on purpose.
// Run: pnpm secrets:check   (CI checks out full history for this).
import { execFileSync } from 'node:child_process';

const PATTERNS: [string, RegExp][] = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['Anthropic/OpenAI key', /\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./],
  ['hard-coded credential', /\b(api[_-]?key|secret|password|passwd|access[_-]?token)["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];
const SENSITIVE_FILES = /(^|\/)(\.env(\..*)?|id_rsa|id_ed25519|.*\.(pem|key|p12|pfx|keystore))$/i;

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30 });
const findings: string[] = [];
let commit = 'working tree';
let file = '';

const scanLine = (line: string, where: string) => {
  for (const [name, re] of PATTERNS) if (re.test(line)) findings.push(`${where} ${file}: ${name}`);
};

for (const line of git('log', '--all', '-p', '--format=commit %h', '--no-color').split('\n')) {
  if (line.startsWith('commit ')) commit = line.slice(7);
  else if (line.startsWith('+++ b/')) {
    file = line.slice(6);
    if (SENSITIVE_FILES.test(file)) findings.push(`${commit} ${file}: sensitive file name`);
  } else if (line.startsWith('+') && !line.startsWith('+++')) scanLine(line, commit);
}
for (const f of git('ls-files').split('\n').filter(Boolean)) {
  if (SENSITIVE_FILES.test(f)) findings.push(`working tree ${f}: sensitive file name`);
}

const commits = git('rev-list', '--all', '--count').trim();
if (findings.length) {
  console.error(`Secret scan FAILED (${commits} commits):\n${[...new Set(findings)].map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`Secret scan passed: ${commits} commits and the working tree, no credential patterns or sensitive files.`);
