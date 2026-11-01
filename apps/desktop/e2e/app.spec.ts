import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { launchStudio, screenshots } from './launch.ts';

let app: ElectronApplication;
let win: Page;

test.beforeAll(async () => {
  ({ app, win } = await launchStudio(await mkdtemp(path.join(tmpdir(), 'studio-e2e-'))));
});

test.afterAll(async () => {
  await app?.close();
});

test('renderer is unprivileged and the bridge is minimal', async () => {
  const probe = await win.evaluate(() => ({
    require: typeof (globalThis as { require?: unknown }).require,
    process: typeof (globalThis as { process?: unknown }).process,
    studioKeys: Object.keys((window as unknown as { studio: object }).studio).sort(),
    frozen: Object.isFrozen((window as unknown as { studio: object }).studio),
    origin: location.origin,
  }));
  expect(probe).toEqual({ require: 'undefined', process: 'undefined', studioKeys: ['invoke', 'platform'], frozen: true, origin: 'app://studio' });
  // Unknown channels and malformed payloads are rejected.
  await expect(win.evaluate(() => (window as any).studio.invoke('fs.readFile', { path: '/etc/passwd' }))).rejects.toThrow(/Unknown channel/);
  await expect(win.evaluate(() => (window as any).studio.invoke('story.validate', { projectId: '../../etc' }))).rejects.toThrow(/Invalid request/);
  await expect(win.evaluate(() => (window as any).studio.invoke('preview.start', { projectId: 'demo-heritage', target: 'php' }))).rejects.toThrow(/Invalid request/);
});

test('lists the sample project and validates its StorySpec', async () => {
  await expect(win.locator('.project-item[aria-current="true"]')).toContainText('Heritage Journey');
  await expect(win.getByRole('heading', { level: 1, name: 'Heritage Journey' })).toBeVisible();
  await expect(win.getByText('StorySpec valid')).toBeVisible();
  await expect(win.getByText('No preview yet')).toBeVisible();
  await expect(win.getByRole('button', { name: /AI providers/ })).toBeVisible();
  await win.screenshot({ path: path.join(screenshots, 'desktop-empty.png') });
});

test('generates HTML + React and previews both in an isolated frame', async () => {
  await win.getByRole('button', { name: 'Generate HTML + React' }).click();
  await expect(win.locator('.topbar__status')).toContainText('Generating');
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  await expect(win.getByRole('log')).toContainText('Build complete');

  for (const target of ['HTML', 'React'] as const) {
    await win.getByRole('radio', { name: target }).click();
    const frame = win.frameLocator('iframe');
    await expect(frame.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await expect(frame.locator('h1')).toHaveText('A Place With a Story');
    await expect(win.locator('.preview__label')).toContainText('127.0.0.1');
    await win.waitForTimeout(600);
    await win.screenshot({ path: path.join(screenshots, `desktop-preview-${target.toLowerCase()}.png`) });
  }

  // The preview frame is sandboxed: no access to the studio window or its bridge.
  const iframe = win.frames().find((f) => f.url().startsWith('http://127.0.0.1:'));
  expect(iframe).toBeTruthy();
  const isolation = await iframe!.evaluate(() => {
    let parentReadable = true;
    try {
      void (window.parent as Window).document.title;
    } catch {
      parentReadable = false;
    }
    return { studio: typeof (window as { studio?: unknown }).studio, parentReadable, origin: String(window.origin) };
  });
  expect(isolation).toEqual({ studio: 'undefined', parentReadable: false, origin: 'null' });

  await win.getByRole('radio', { name: 'Mobile' }).click();
  await win.waitForTimeout(600);
  await win.screenshot({ path: path.join(screenshots, 'desktop-preview-react-mobile.png') });
});

test('segmented controls are keyboard operable', async () => {
  const desktop = win.getByRole('radio', { name: 'Desktop' });
  await win.getByRole('radio', { name: 'Mobile' }).focus();
  await win.keyboard.press('ArrowRight');
  await expect(desktop).toHaveAttribute('aria-checked', 'true');
  await expect(desktop).toBeFocused();
});

// Runs last: Playwright keeps waiting on the navigation the app cancels.
test('blocks navigation away from the app and new windows', async () => {
  await win.evaluate(() => {
    // http (not https) so the deny path is exercised without opening the user's browser.
    window.open('http://example.invalid/', '_blank');
    location.href = 'http://example.invalid/';
  });
  await win.waitForTimeout(500);
  expect(win.url()).toBe('app://studio/index.html');
  expect(app.windows()).toHaveLength(1);
});
