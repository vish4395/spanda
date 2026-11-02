import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchStudio, screenshots } from './launch.ts';

test('M2: idea → discovery → brief → storyboard → approved StorySpec → preview', async () => {
  const { app, win } = await launchStudio(await mkdtemp(path.join(tmpdir(), 'studio-m2-')));

  await win.getByRole('button', { name: 'New project' }).click();
  await win.getByLabel('Project name').fill('Lantern Festival');
  await win.getByLabel('One-line idea').fill('Invite families to a riverside lantern festival.');
  await win.getByRole('button', { name: 'Create project' }).click();
  await expect(win.getByRole('tab', { name: 'Discover' })).toHaveAttribute('aria-selected', 'true');

  // T011 — one question at a time, with skip and "you decide".
  await expect(win.getByText('Question 1 of 4')).toBeVisible();
  await expect(win.getByRole('heading', { name: 'How should the story feel?' })).toBeVisible();
  await win.screenshot({ path: path.join(screenshots, 'desktop-m2-discover.png') });
  await win.getByRole('button', { name: /Mysterious and dramatic/ }).click();
  await expect(win.getByText('Question 2 of 4')).toBeVisible();
  await win.getByRole('button', { name: /A place or environment/ }).click();
  await win.getByRole('button', { name: 'You decide' }).click();
  await win.getByRole('button', { name: 'Skip' }).click();
  await expect(win.getByText('Discovery complete')).toBeVisible();
  await expect(win.getByText('Studio decides')).toBeVisible();

  // T012 — unsafe references are refused with an explanation.
  await win.getByLabel('Page URL').fill('http://169.254.169.254/latest/meta-data/');
  await win.getByRole('button', { name: 'Analyse' }).click();
  await expect(win.getByRole('alert')).toContainText('private or reserved');
  await win.getByRole('button', { name: 'Dismiss error' }).click();

  // T013 — brief with original art directions; approval moves on to the storyboard.
  await win.getByRole('tab', { name: 'Brief' }).click();
  const directions = win.getByRole('radiogroup', { name: 'Art direction' });
  await expect(directions.getByRole('radio')).toHaveCount(3);
  await directions.getByRole('radio', { name: /Violet Hour/ }).click();
  await win.getByLabel('Audience').fill('Local families');
  await win.screenshot({ path: path.join(screenshots, 'desktop-m2-brief.png') });
  await win.getByRole('button', { name: 'Approve brief' }).click();
  await expect(win.getByRole('tab', { name: 'Storyboard' })).toHaveAttribute('aria-selected', 'true');

  // T014/T015 — draft with the local planner (no AI), edit, reorder, approve.
  await win.getByRole('button', { name: 'Draft storyboard' }).click();
  const scenes = win.getByRole('list', { name: 'Storyboard scenes' });
  await expect(scenes.getByRole('listitem')).toHaveCount(4); // hero + 3 chapters (standard length)
  await expect(win.getByText(/Structure only \(no AI\)/)).toBeVisible();
  await win.getByLabel('Heading').nth(1).fill('Lanterns on the water');
  await win.getByLabel('Body').nth(1).fill('Hundreds of paper lights drift past the old bridge.');
  await win.getByRole('button', { name: 'Move scene 2 down' }).click();
  await expect(win.getByLabel('Heading').nth(2)).toHaveValue('Lanterns on the water');
  await win.screenshot({ path: path.join(screenshots, 'desktop-m2-storyboard.png') });
  await win.getByRole('button', { name: 'Approve storyboard' }).click();
  await expect(win.getByRole('tab', { name: 'Build & preview' })).toHaveAttribute('aria-selected', 'true');
  await expect(win.getByRole('list', { name: 'Version history, newest first' })).toContainText('Storyboard approved');

  // The approved StorySpec builds and previews in both targets.
  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  const frame = win.frameLocator('iframe');
  await expect(frame.locator('h1')).toHaveText('Lantern Festival', { timeout: 30_000 });
  // Reordering keeps scene IDs stable: the edited scene keeps chapter-02 at its new position.
  await expect(frame.locator('#chapter-02 h2')).toHaveText('Lanterns on the water');
  await win.getByRole('radio', { name: 'React' }).click();
  await expect(win.frameLocator('iframe').locator('#chapter-02 h2')).toHaveText('Lanterns on the water', { timeout: 30_000 });
  await win.waitForTimeout(1200);
  await win.screenshot({ path: path.join(screenshots, 'desktop-m2-preview.png') });
  await app.close();
});
