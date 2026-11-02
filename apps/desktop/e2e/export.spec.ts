import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { readZip } from '@studio/export';
import { launchStudio, screenshots } from './launch.ts';

test('T024: export the generated site as a ZIP with notices, SBOM and metadata', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'studio-export-'));
  const downloads = await mkdtemp(path.join(tmpdir(), 'studio-export-out-'));
  const { app, win } = await launchStudio(workspace);
  // The native save dialog cannot be driven by Playwright; answer it from the main process.
  const answerSaveDialog = (file: string | null) =>
    app.evaluate(({ dialog }, target) => {
      const reply = target ? { canceled: false, filePath: target } : { canceled: true, filePath: '' };
      (dialog as { showSaveDialog: unknown }).showSaveDialog = async () => reply;
    }, file);

  const exportButton = win.getByRole('button', { name: 'Export…' });
  await expect(exportButton).toBeDisabled(); // nothing generated yet
  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  await expect(exportButton).toBeEnabled();

  // Cancelling the dialog writes nothing and reports nothing.
  await answerSaveDialog(null);
  await exportButton.click();
  await expect(exportButton).toBeEnabled();
  await expect(win.getByRole('status').filter({ hasText: 'Exported' })).toHaveCount(0);

  await answerSaveDialog(path.join(downloads, 'heritage'));
  await exportButton.click();
  await expect(win.getByText(/Exported heritage\.zip · \d+ files · [\d.]+ MB · License check passed/)).toBeVisible({ timeout: 30_000 });
  await win.screenshot({ path: path.join(screenshots, 'desktop-export.png') });

  const files = readZip(await readFile(path.join(downloads, 'heritage.zip')));
  const names = [...files.keys()];
  for (const required of ['README.md', 'LICENSES.md', 'THIRD_PARTY_NOTICES.md', 'ASSET_CREDITS.md', 'sbom.cdx.json', 'metadata/story-spec.json', 'html/index.html', 'react/package.json', 'react/package-lock.json']) {
    expect(names).toContain(required);
  }
  expect(names.some((n) => n.startsWith('react/node_modules/') || n.startsWith('react/dist/'))).toBe(false);
  expect(files.get('README.md')!.toString()).toMatch(/Exported by AI Cinematic Studio 0\.\d+\.\d+\./); // the studio's version, not Electron's
  // Real React license texts come from the build, and the SBOM lists the pinned runtime packages.
  expect(files.get('THIRD_PARTY_NOTICES.md')!.toString()).toMatch(/## react \d/);
  const sbom = JSON.parse(files.get('sbom.cdx.json')!.toString()) as { components: { name: string; scope: string }[] };
  expect(sbom.components).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'react', scope: 'required' }), expect.objectContaining({ name: 'three', scope: 'required' })]));
  // No host paths leak into the export.
  const leaks = names.filter((n) => files.get(n)!.toString('utf8').includes(workspace));
  expect(leaks).toEqual([]);

  // HTML only, through the File menu.
  await win.getByRole('combobox', { name: 'Targets to export' }).selectOption('html');
  await answerSaveDialog(path.join(downloads, 'html-only.zip'));
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('project.export')!.click());
  await expect(win.getByText(/Exported html-only\.zip/)).toBeVisible({ timeout: 30_000 });
  expect([...readZip(await readFile(path.join(downloads, 'html-only.zip'))).keys()].some((n) => n.startsWith('react/'))).toBe(false);

  // After a scene edit the build is out of date, so export is disabled until regenerated.
  await win.locator('.scene-picker__item').first().click();
  const editor = win.getByRole('form', { name: /Edit scene/ });
  await editor.getByLabel('Heading').fill('A Place Changed');
  await editor.getByRole('button', { name: 'Apply to this scene' }).click();
  await expect(win.getByText('Out of date — generate to apply edits')).toBeVisible();
  await expect(exportButton).toBeDisabled();
  await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('project.export')!.enabled)).toBe(false);
  // The main process refuses a stale export even if asked directly.
  await expect(win.evaluate(() => (window as any).studio.invoke('export.create', { projectId: 'demo-heritage', targets: ['html'] }))).rejects.toThrow(/out of date/);

  await app.close();
});
