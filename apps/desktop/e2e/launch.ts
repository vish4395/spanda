import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export const appDir = fileURLToPath(new URL('..', import.meta.url));
export const screenshots = path.resolve(appDir, '../../artifacts/screenshots');

export async function launchStudio(workspace: string): Promise<{ app: ElectronApplication; win: Page }> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  delete env.ELECTRON_RUN_AS_NODE; // set by VS Code / some hosts; would start Electron as plain Node
  env.STUDIO_WORKSPACE = workspace;
  const app = await electron.launch({ args: [path.join(appDir, 'dist/main.mjs')], cwd: appDir, env });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  return { app, win };
}
