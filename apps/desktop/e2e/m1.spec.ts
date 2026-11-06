import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchStudio, screenshots } from './launch.ts';

test('M1: create, snapshot, restore, settings, and persistence across restart', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'studio-m1-'));
  let { app, win } = await launchStudio(workspace);

  // T006 — create a project with inline validation.
  await win.getByRole('button', { name: 'New project' }).click();
  await expect(win.getByRole('heading', { level: 1, name: 'New project' })).toBeVisible();
  // Check DOM focus directly: OS window focus may belong to another app while tests run.
  await expect.poll(() => win.evaluate(() => document.activeElement?.id)).toBe('project-name');
  await win.getByRole('button', { name: 'Create project' }).click();
  await expect(win.getByText('Give the project a name.')).toBeVisible();
  await expect(win.getByLabel('Project name')).toHaveAttribute('aria-invalid', 'true');
  await win.getByLabel('Project name').fill('Orbital Bakery');
  await win.getByLabel('One-line idea').fill('Introduce a family-run bakery with warm, cinematic scenes.');
  await win.screenshot({ path: path.join(screenshots, 'desktop-m1-new-project.png') });
  await win.getByRole('button', { name: 'Create project' }).click();

  await expect(win.getByRole('heading', { level: 1, name: 'Orbital Bakery' })).toBeVisible();
  await expect(win.getByText('StorySpec valid')).toBeVisible();
  await expect(win.locator('.project-item').first()).toContainText('Orbital Bakery'); // most recent first
  const versions = win.getByRole('list', { name: 'Version history, newest first' });
  await expect(versions.getByRole('listitem')).toHaveCount(1);
  await expect(versions).toContainText('Created');

  // Saving an unchanged spec does not create duplicates.
  await win.getByRole('button', { name: 'Save snapshot' }).click();
  await expect(win.getByRole('status').filter({ hasText: 'Snapshot saved' })).toHaveCount(1);
  await expect(versions.getByRole('listitem')).toHaveCount(1);

  // New projects open on Discover; generate from Build & preview. The run is persisted.
  await expect(win.getByRole('tab', { name: 'Discover' })).toHaveAttribute('aria-selected', 'true');
  await win.getByRole('tab', { name: 'Build & preview' }).click();
  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  await expect(win.frameLocator('iframe').locator('h1')).toHaveText('Orbital Bakery', { timeout: 30_000 });

  // Restore the sample's imported version (on the sample project).
  await win.locator('.project-item', { hasText: 'Heritage Journey' }).click();
  await expect(win.getByRole('heading', { level: 1, name: 'Heritage Journey' })).toBeVisible();
  await expect(versions).toContainText('Imported');

  // T008 — skills registry.
  await win.getByRole('button', { name: 'Skills' }).click();
  const skills = win.getByRole('list', { name: 'Installed skills' });
  await expect(skills.getByRole('listitem')).toHaveCount(4);
  await expect(skills.getByText('Pinned')).toHaveCount(4);
  await expect(skills.getByText('Enabled')).toHaveCount(4);
  await win.screenshot({ path: path.join(screenshots, 'desktop-m1-skills.png') });

  // T007 — provider settings, honest about AI being off after "Set up later".
  await win.getByRole('button', { name: /AI providers/ }).click();
  const table = win.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByText('Off', { exact: true })).toHaveCount(2);
  await expect(win.getByRole('radiogroup', { name: 'Default AI' }).getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
  await expect(win.getByRole('checkbox', { name: 'Allow web research' })).not.toBeChecked();
  await win.getByRole('button', { name: 'Check again' }).click();
  await expect(win.getByRole('button', { name: 'Check again' })).toBeEnabled();
  await win.screenshot({ path: path.join(screenshots, 'desktop-m1-providers.png') });

  // T006/T009 — restart: projects, recency and the last run's log survive.
  await app.close();
  ({ app, win } = await launchStudio(workspace));
  await expect(win.locator('.project-item').first()).toContainText('Heritage Journey'); // opened last
  await win.locator('.project-item', { hasText: 'Orbital Bakery' }).click();
  await expect(win.getByRole('heading', { level: 1, name: 'Orbital Bakery' })).toBeVisible();
  await win.getByRole('tab', { name: 'Build & preview' }).click();
  await expect(win.getByRole('log')).toContainText('Done.');
  await expect(win.locator('.activity__toggle')).toContainText('last run succeeded');
  // Preview of the earlier build is still available after restart.
  await expect(win.frameLocator('iframe').locator('h1')).toHaveText('Orbital Bakery', { timeout: 30_000 });
  await win.screenshot({ path: path.join(screenshots, 'desktop-m1-after-restart.png') });
  await app.close();
});

test('M1: snapshots of an unchanged StorySpec are deduplicated via IPC', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'studio-m1r-'));
  const { app, win } = await launchStudio(workspace);
  const versions = win.getByRole('list', { name: 'Version history, newest first' });
  await expect(versions).toContainText('Imported');
  // Restore itself is covered by apps/desktop/test/services.test.ts (spec editing UI arrives in M3).
  await win.evaluate(() => (window as unknown as { studio: { invoke: (c: string, p: unknown) => Promise<unknown> } }).studio.invoke('versions.snapshot', { projectId: 'demo-heritage', label: 'Checkpoint' }));
  await win.locator('.project-item', { hasText: 'Heritage Journey' }).click();
  await expect(versions.getByRole('listitem')).toHaveCount(1); // identical spec → deduplicated
  await app.close();
});
