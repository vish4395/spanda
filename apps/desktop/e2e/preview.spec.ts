import { appendFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchStudio, screenshots } from './launch.ts';

test('T019: reduced-motion emulation and runtime error overlay in the live preview', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'studio-preview-'));
  const { app, win } = await launchStudio(workspace);
  await expect(win.getByRole('heading', { level: 1, name: 'Heritage Journey' })).toBeVisible();
  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });

  const motion = win.getByRole('button', { name: 'Reduced motion' });
  const previewFrame = () => win.frames().find((f) => f.url().startsWith('http://127.0.0.1:'))!;

  for (const target of ['HTML', 'React'] as const) {
    await win.getByRole('radio', { name: target }).click();
    const frame = win.frameLocator('iframe');
    await expect(frame.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await expect(motion).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => previewFrame().evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);

    // Real media emulation: both matchMedia and CSS @media see it, live, without reloading the page.
    await motion.click();
    await expect(motion).toHaveAttribute('aria-pressed', 'true');
    await expect(win.locator('.preview__bar')).toContainText('Reduced motion');
    await expect.poll(() => previewFrame().evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    if (target === 'HTML') await expect(frame.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await win.screenshot({ path: path.join(screenshots, `desktop-preview-reduced-motion-${target.toLowerCase()}.png`) });

    await motion.click();
    await expect.poll(() => previewFrame().evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);
    if (target === 'HTML') await expect(frame.locator('html')).toHaveAttribute('data-motion', 'full');
  }

  // Healthy exports report no errors (React last, so HTML is the current target below).
  for (const target of ['React', 'HTML'] as const) {
    await win.getByRole('radio', { name: target }).click();
    await expect(win.frameLocator('iframe').locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await win.waitForTimeout(1500);
    await expect(win.getByRole('region', { name: 'Preview errors' })).toHaveCount(0);
  }

  // Break the generated page on disk, then reload the preview: the studio shows what the page reported.
  // (The export's CSP blocks inline scripts, so the faulty script is a same-origin file.)
  const out = path.join(workspace, 'projects', 'demo-heritage', 'output', 'html');
  await writeFile(path.join(out, 'studio-e2e-boom.js'), 'throw new Error("studio-e2e-boom");\n');
  await appendFile(path.join(out, 'index.html'), '\n<script src="studio-e2e-boom.js"></script>\n<img alt="" src="studio-e2e-missing.png">\n');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.send('menu:command', { command: 'preview.reload' }));
  const panel = win.getByRole('region', { name: 'Preview errors' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toContainText('Uncaught error');
  await expect(panel).toContainText('studio-e2e-boom');
  await expect(panel).toContainText('Failed to load');
  await expect(panel).toContainText('studio-e2e-missing.png');
  await expect(panel).toContainText('File missing');
  // The page stays usable behind the panel.
  await expect(win.frameLocator('iframe').locator('h1')).toHaveText('A Place With a Story');
  await win.screenshot({ path: path.join(screenshots, 'desktop-preview-runtime-errors.png') });

  await panel.getByRole('button', { name: 'Dismiss preview errors' }).click();
  await expect(panel).toHaveCount(0);
  await win.waitForTimeout(1500);
  await expect(panel).toHaveCount(0);

  await app.close();
});
