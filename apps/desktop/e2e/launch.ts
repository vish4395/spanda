import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export const appDir = fileURLToPath(new URL('..', import.meta.url));
export const screenshots = path.resolve(appDir, '../../artifacts/screenshots');

export interface LaunchOptions {
  /** `skip` (default) passes first-run setup with "Set up later"; `show` leaves it on screen. */
  welcome?: 'skip' | 'show';
  /** Put a scripted test double named `claude` first on PATH (never the real CLI). */
  fakeClaude?: FakeReplies;
}

/** Prompt marker → JSON reply the fake CLI returns as its result. */
export type FakeReplies = { marker: string; reply: unknown }[];

const cliEnvelope = (reply: unknown) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(reply), modelUsage: { 'fake-model': {} }, total_cost_usd: 0 });

/** A POSIX shell script standing in for `claude`: answers `--version`, then matches the prompt on stdin. */
async function fakeClaudeDir(replies: FakeReplies): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'fake-cli-'));
  const cases = replies.map(({ marker, reply }) => `  *'${marker}'*) printf '%s\\n' '${cliEnvelope(reply).replace(/'/g, `'\\''`)}' ;;`).join('\n');
  const script = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "9.9.9 (fake Claude Code for tests)"; exit 0; fi
input=$(cat)
sleep 1
case "$input" in
${cases}
  *) echo "fake claude: unexpected prompt" >&2; exit 3 ;;
esac
`;
  const file = path.join(dir, 'claude');
  await writeFile(file, script);
  await chmod(file, 0o755);
  return dir;
}

export async function launchStudio(workspace: string, options: LaunchOptions = {}): Promise<{ app: ElectronApplication; win: Page }> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  delete env.ELECTRON_RUN_AS_NODE; // set by VS Code / some hosts; would start Electron as plain Node
  env.STUDIO_WORKSPACE = workspace;
  if (options.fakeClaude) env.PATH = `${await fakeClaudeDir(options.fakeClaude)}${path.delimiter}${env.PATH ?? ''}`;
  const app = await electron.launch({ args: [path.join(appDir, 'dist/main.mjs')], cwd: appDir, env });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  if (options.welcome !== 'show') {
    await win.locator('#workspace .welcome, #workspace .tabs, #workspace .empty').first().waitFor();
    const later = win.getByRole('button', { name: 'Set up later' });
    if (await later.isVisible()) await later.click();
  }
  return { app, win };
}
