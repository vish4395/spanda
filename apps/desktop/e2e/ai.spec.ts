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
    marker: 'You are the Discovery Director',
    reply: {
      projectType: 'Festival invitation',
      summary: 'Invite local families to an evening lantern festival by the river.',
      facts: ['It is a riverside lantern festival.', 'It is for families.'],
      assumptions: ['It happens once a year.'],
      nextSteps: [
        { title: 'Answer three questions', detail: 'They set the mood and the closing invitation.' },
        { title: 'Approve the brief', detail: 'Then draft the storyboard.' },
      ],
      core: { tone: 'warm', subject: 'place', motion: 'balanced', length: 'short' },
      questions: [
        { prompt: 'Who is the festival mainly for?', reason: 'Sets the voice of the copy.', options: [{ label: 'Young families', explanation: 'Playful and simple.' }, { label: 'Everyone in town', explanation: 'Broad and welcoming.' }], recommended: 0, why: 'The idea names families.' },
        { prompt: 'Which moment should open the site?', reason: 'Chooses the hero image.', options: [{ label: 'First lantern on the water', explanation: 'Quiet and magical.' }, { label: 'The crowd at dusk', explanation: 'Busy and warm.' }], recommended: 0, why: 'A single light reads well in 3D.' },
        { prompt: 'What should visitors do at the end?', reason: 'Sets the call to action.', options: [{ label: 'Plan their evening', explanation: 'Time and place.' }, { label: 'Make a lantern', explanation: 'A workshop sign-up.' }], recommended: 0, why: 'Most visitors need the when and where.' },
      ],
    },
  },
  {
    marker: 'Propose 3 ORIGINAL',
    reply: {
      directions: [
        {
          name: 'River Ember',
          description: 'Ink-blue night with marigold lantern light.',
          colors: { background: '#0d1424', foreground: '#f4efe6', accent: '#f2a93b', secondary: '#9fb6d9' },
          headingFont: 'didone',
          bodyFont: 'humanist',
          style: { mode: 'dark', scale: 'monumental', headingCase: 'normal', headingWeight: 'light', radius: 'soft', texture: 'grain', density: 'airy', reveal: 'blur', easing: 'dramatic', heroArt: 'particles', panelArt: 'arcs' },
          composition: { hero: 'centered', chapterLayouts: ['full-bleed', 'split'], steps: 'timeline', showcase: 'stage', gallery: 'mosaic', cta: 'banner' },
          rationale: 'Lanterns read best against a deep night sky.',
        },
        {
          name: 'Paper Boat',
          description: 'Rice-paper cream with vermilion ink.',
          colors: { background: '#f6f0e4', foreground: '#1f1a14', accent: '#a8321c', secondary: '#6b5a44' },
          headingFont: 'classic-serif',
          bodyFont: 'book-serif',
          style: { mode: 'light', scale: 'editorial', headingCase: 'normal', headingWeight: 'regular', radius: 'sharp', texture: 'none', density: 'balanced', reveal: 'mask', easing: 'gentle', heroArt: 'ribbons', panelArt: 'stripes' },
          composition: { hero: 'split', chapterLayouts: ['editorial'], steps: 'cards', showcase: 'split', gallery: 'grid', cta: 'card' },
          rationale: 'A daylight, handmade feel for families planning ahead.',
        },
      ],
    },
  },
  {
    marker: 'Write the creative brief',
    reply: { audience: 'Local families with young children', tone: 'Warm, magical, unhurried', motion: 'calm', chapters: 2, notes: 'Show the first lantern on the water.', reasons: 'Young children and evening reading call for a calm pace.' },
  },
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

  // Kickoff starts by itself: a plan from the name and idea, then questions made for this project.
  await expect(win.getByRole('region', { name: 'AI task' })).toContainText('Planning “Ghat Lanterns” with the Claude Code CLI');
  const plan = win.getByRole('region', { name: 'Studio plan' });
  await expect(plan).toContainText('Festival invitation', { timeout: 30_000 });
  await expect(plan).toContainText('Assumptions to check');
  await expect(plan.getByRole('listitem').filter({ hasText: 'Approve the brief' })).toBeVisible();
  await expect(win.getByText(/Question 1 of 3/)).toBeVisible();
  await expect(win.getByRole('heading', { name: 'Who is the festival mainly for?' })).toBeVisible();
  await win.screenshot({ path: path.join(screenshots, 'desktop-ai-plan.png') });
  await win.getByRole('button', { name: 'You decide' }).click();
  await win.getByRole('button', { name: /The crowd at dusk/ }).click();
  await win.getByRole('button', { name: /Plan their evening/ }).click();
  await expect(win.getByText('Studio decides: Young families — The idea names families.')).toBeVisible();
  await win.getByRole('tab', { name: 'Brief' }).click();

  // Art directions from AI join the studio's own; contrast is enforced by the studio.
  await win.getByRole('button', { name: 'Suggest directions with AI' }).click();
  const directions = win.getByRole('radiogroup', { name: 'Art direction' });
  await expect(directions.getByRole('radio', { name: /River Ember/ })).toBeVisible({ timeout: 30_000 });
  await expect(directions.getByRole('radio', { name: /Paper Boat/ })).toContainText('A daylight, handmade feel');
  await directions.getByRole('radio', { name: /River Ember/ }).click();
  await win.getByRole('button', { name: 'Save draft' }).click();
  await win.getByRole('button', { name: 'Fill brief with AI' }).click();
  await expect(win.getByLabel('Audience')).toHaveValue('Local families with young children', { timeout: 30_000 });
  await expect(win.getByText(/Filled by AI \(Claude Code\): Young children and evening reading/)).toBeVisible();
  await expect(directions.getByRole('radio', { name: /River Ember/ })).toHaveAttribute('aria-checked', 'true');
  await win.screenshot({ path: path.join(screenshots, 'desktop-ai-brief.png') });
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
