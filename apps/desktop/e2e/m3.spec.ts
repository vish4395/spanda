import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchStudio, screenshots } from './launch.ts';

test('M3: new primitives from the storyboard, scoped scene edit, regenerate', async () => {
  const { app, win } = await launchStudio(await mkdtemp(path.join(tmpdir(), 'studio-m3-')));
  await win.getByRole('button', { name: 'New project' }).click();
  await win.getByLabel('Project name').fill('Harbour Kiln');
  await win.getByLabel('One-line idea').fill('A ceramics studio by the harbour.');
  await win.getByRole('button', { name: 'Create project' }).click();
  for (const label of [/Warm and inviting/, /A product or object/, /Balanced/, /Short/]) await win.getByRole('button', { name: label }).click();
  await win.getByRole('tab', { name: 'Brief' }).click();
  await win.getByRole('button', { name: 'Approve brief' }).click();
  await win.getByRole('button', { name: 'Draft storyboard' }).click();

  const scenes = win.getByRole('list', { name: 'Storyboard scenes' });
  await expect(scenes.getByRole('listitem')).toHaveCount(2);
  const ids = await scenes.locator('.mono').allInnerTexts();
  await win.getByLabel('Scene type to add').selectOption('gallery');
  await win.getByRole('button', { name: 'Add scene' }).click();
  await win.getByLabel('Scene type to add').selectOption('cta');
  await win.getByRole('button', { name: 'Add scene' }).click();
  await expect(scenes.getByRole('listitem')).toHaveCount(4);
  await win.getByLabel('card 1 title').fill('Salt-glaze jug');
  await win.getByLabel('Button label').fill('Book a class');
  // Reordering keeps existing scene IDs stable.
  await win.getByRole('button', { name: 'Move scene 4 up' }).click();
  expect((await scenes.locator('.mono').allInnerTexts()).slice(0, 2)).toEqual(ids);
  await win.getByRole('button', { name: 'Approve storyboard' }).click();
  await expect(win.getByRole('tab', { name: 'Build & preview' })).toHaveAttribute('aria-selected', 'true');

  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  const frame = win.frameLocator('iframe');
  await expect(frame.locator('.gallery__item').first()).toContainText('Salt-glaze jug', { timeout: 30_000 });
  await expect(frame.locator('.scene--cta a.cta')).toHaveText('Book a class');

  // T020 — scoped edit of one scene from the Scenes inspector.
  const picker = win.getByRole('region', { name: 'Scenes' }).or(win.locator('.scene-picker'));
  await expect(picker.first()).toBeVisible();
  await win.locator('.scene-picker__item', { hasText: 'Chapter' }).first().click();
  const editor = win.getByRole('form', { name: /Edit scene/ });
  await editor.getByLabel('Heading').fill('Clay from the shore');
  await editor.getByRole('button', { name: 'Apply to this scene' }).click();
  await expect(win.getByRole('list', { name: 'Version history, newest first' }).getByRole('listitem').first()).toContainText('Edited');
  // The storyboard picked up the scoped edit, so re-approving it would keep the change.
  await win.getByRole('tab', { name: 'Storyboard' }).click();
  await expect.poll(() => win.getByRole('list', { name: 'Storyboard scenes' }).getByLabel('Heading').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toContain('Clay from the shore');
  await win.getByRole('tab', { name: 'Build & preview' }).click();
  // The previous build stays visible, marked out of date until regenerated.
  await expect(win.getByText('Out of date — generate to apply edits')).toBeVisible();
  await expect(win.frameLocator('iframe').locator('h1')).toHaveText('Harbour Kiln', { timeout: 30_000 });
  await win.screenshot({ path: path.join(screenshots, 'desktop-m3-scene-edit.png') });
  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  await expect(win.frameLocator('iframe').locator('h2', { hasText: 'Clay from the shore' })).toBeVisible({ timeout: 30_000 });
  await expect(win.frameLocator('iframe').locator('.gallery__item').first()).toContainText('Salt-glaze jug');
  await expect(win.getByText('Out of date — generate to apply edits')).toHaveCount(0);
  await win.screenshot({ path: path.join(screenshots, 'desktop-m3-preview.png') });

  // T020 — checkpoint rollback from the Versions list: the edit is undone, and kept in history.
  await win.getByRole('button', { name: 'Restore Storyboard approved' }).click();
  const history = win.getByRole('list', { name: 'Version history, newest first' });
  await expect(history.getByRole('listitem').first()).toContainText('Restored “Storyboard approved”');
  await expect(history).toContainText('Edited');
  await expect(win.locator('.scene-picker__item', { hasText: 'Clay from the shore' })).toHaveCount(0);
  await expect(win.getByText('Out of date — generate to apply edits')).toBeVisible();
  // The storyboard follows the rollback, so approving it again cannot bring the edit back.
  await win.getByRole('tab', { name: 'Storyboard' }).click();
  const headings = () => win.getByRole('list', { name: 'Storyboard scenes' }).getByLabel('Heading').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  await expect.poll(async () => (await headings()).length).toBe(4);
  expect(await headings()).not.toContain('Clay from the shore');
  await app.close();
});
