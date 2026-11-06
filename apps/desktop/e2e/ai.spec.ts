import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchStudio, screenshots, type FakeReplies } from './launch.ts';

// A scripted stand-in for the `claude` CLI (see launch.ts). It proves the studio's
// wiring: provider choice, jobs, logs, validation and provenance. It is not a real model.
const replies: FakeReplies = [
  { marker: 'connection test', reply: { ok: true, note: 'Hello from the fake CLI.' } },
  {
    marker: 'Story Architect',
    reply: {
      scenes: [
        { type: 'hero', heading: 'Lanterns at the Ghat', body: 'A river festival at dusk.', visualNote: 'warm haze' },
        { type: 'chapter', heading: 'The first flame', body: 'Families light the first lamp together.', visualNote: '' },
        { type: 'gallery', heading: 'Faces of the night', body: '', visualNote: '', items: [{ title: 'Elders', text: 'Keepers of the songs.' }, { title: 'Children', text: 'Paper boats in hand.' }] },
        { type: 'cta', heading: 'Join the river', body: 'One evening, every year.', visualNote: '', cta: { label: 'Plan your evening' } },
      ],
    },
  },
];

test('first run: choose and test an AI provider, then draft a storyboard with it in a cancellable job', async () => {
  const { app, win } = await launchStudio(await mkdtemp(path.join(tmpdir(), 'studio-ai-')), { welcome: 'show', fakeClaude: replies });

  // S01 — the only installed CLI is preselected; the test call runs as a visible job.
  await expect(win.getByRole('heading', { name: 'Welcome to Spanda Studio' })).toBeVisible();
  const providers = win.getByRole('radiogroup', { name: 'AI provider' });
  await expect(providers.getByRole('radio', { name: /Claude Code CLI/ })).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  await expect(providers.getByRole('radio', { name: /Claude Code CLI/ })).toContainText('9.9.9 (fake Claude Code for tests)');
  await win.getByRole('button', { name: 'Test connection' }).click();
  await expect(win.getByRole('region', { name: 'AI task' })).toBeVisible();
  await expect(win.getByText(/Connected \(fake-model\): Hello from the fake CLI\./)).toBeVisible({ timeout: 15_000 });
  await win.screenshot({ path: path.join(screenshots, 'desktop-ai-welcome.png') });
  await win.getByRole('button', { name: 'Use Claude Code CLI' }).click();
  await expect(win.getByRole('tab', { name: 'Build & preview' })).toBeVisible();

  // Settings: per-step choice; turning the storyboard step off makes the planner say why.
  await win.getByRole('button', { name: /AI providers/ }).click();
  await expect(win.getByRole('radiogroup', { name: 'Default AI' }).getByRole('radio', { name: 'Claude Code' })).toHaveAttribute('aria-checked', 'true');
  await expect(win.getByRole('table').getByText('7 of 7 steps')).toBeVisible();
  await win.getByLabel('Storyboard', { exact: true }).selectOption('none');
  await expect(win.getByRole('table').getByText('6 of 7 steps')).toBeVisible();
  await win.screenshot({ path: path.join(screenshots, 'desktop-ai-providers.png') });

  await win.getByRole('button', { name: 'New project' }).click();
  await win.getByLabel('Project name').fill('Ghat Lanterns');
  await win.getByLabel('One-line idea').fill('A riverside lantern festival for families.');
  await win.getByRole('button', { name: 'Create project' }).click();
  for (const label of [/Warm and inviting/, /A place or environment/, /Balanced/, /Short/]) await win.getByRole('button', { name: label }).click();
  await win.getByRole('tab', { name: 'Brief' }).click();
  await win.getByRole('button', { name: 'Approve brief' }).click();
  await expect(win.getByRole('radio', { name: 'Claude Code CLI' })).toBeDisabled();
  await expect(win.getByRole('radio', { name: 'Local planner (no AI)' })).toBeChecked();

  await win.getByRole('button', { name: /AI providers/ }).click();
  await win.getByLabel('Storyboard', { exact: true }).selectOption('default');
  await win.locator('.project-item', { hasText: 'Ghat Lanterns' }).click();
  await win.getByRole('tab', { name: 'Storyboard' }).click();
  await expect(win.getByRole('radio', { name: 'Claude Code CLI' })).toBeChecked();
  await win.getByRole('button', { name: 'Draft storyboard' }).click();
  const activity = win.getByRole('region', { name: 'AI task' });
  await expect(activity).toContainText('Drafting the storyboard with the Claude Code CLI');
  await expect(win.getByRole('button', { name: 'Draft storyboard' })).toBeDisabled();
  await win.screenshot({ path: path.join(screenshots, 'desktop-ai-storyboard-running.png') });
  await expect(activity).toHaveCount(0, { timeout: 30_000 });
  const scenes = win.getByRole('list', { name: 'Storyboard scenes' });
  await expect(scenes.getByRole('listitem')).toHaveCount(4);
  await expect(win.getByLabel('Heading').first()).toHaveValue('Lanterns at the Ghat');
  await expect(win.getByText(/Drafted by your local Claude Code CLI \(fake-model\)/)).toBeVisible();
  await win.screenshot({ path: path.join(screenshots, 'desktop-ai-storyboard.png') });
  await app.close();
});
