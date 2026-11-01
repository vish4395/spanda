import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { artifactsDir } from '../src/sample.ts';

// M3 parity: the six-primitive benchmark must render equivalently in both native targets.
const TARGETS = [
  { name: 'html', env: 'STUDIO_BENCH_HTML_URL' },
  { name: 'react', env: 'STUDIO_BENCH_REACT_URL' },
] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
const SCENE_IDS = ['hero-01', 'reveal-02', 'showcase-03', 'chapter-04', 'gallery-05', 'cta-06'];
const shots = path.join(artifactsDir, 'screenshots');

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

for (const target of TARGETS) {
  test.describe(`${target.name} — all primitives`, () => {
    for (const vp of VIEWPORTS) {
      test(`renders all six primitives (${vp.name})`, async ({ page, browserName }) => {
        const errors = watchErrors(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await open(page, process.env[target.env]!);
        for (const id of SCENE_IDS) await expect(page.locator(`#${id}`)).toBeAttached();
        await expect(page.locator('.reveal-step')).toHaveCount(3);
        await expect(page.locator('.gallery__item')).toHaveCount(4);
        await expect(page.locator('#cta-06 a.cta')).toHaveAttribute('href', '#hero-01');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, 'no horizontal page scroll').toBeLessThanOrEqual(0);
        await scrollThrough(page);
        await expect(page.locator('.reveal-step').last()).toHaveCSS('opacity', '1');
        expect(errors).toEqual([]);
        await page.screenshot({ path: path.join(shots, `bench-${target.name}-${browserName}-${vp.name}.png`), fullPage: true, caret: 'initial' });
      });
    }

    test('gallery is keyboard and button operable', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'WebKit only tabs to links/buttons with an OS setting; keyboard path verified in Chromium/Firefox');
      // Reduced motion makes button scrolling instant (and exercises that path), so states settle deterministically.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1024, height: 800 });
      await open(page, process.env[target.env]!);
      const track = page.locator('.gallery__track');
      await track.scrollIntoViewIfNeeded();
      const prev = page.getByRole('button', { name: 'Previous items' });
      const next = page.getByRole('button', { name: 'Next items' });
      await expect(prev).toBeDisabled();
      // Keyboard: the focusable track scrolls with arrow keys.
      await track.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      // Return to the start with the Previous button (waits out the browser's own smooth key scroll).
      await expect(prev).toBeEnabled();
      for (let i = 0; i < 8; i += 1) {
        if (!(await prev.isEnabled())) break;
        await prev.click({ timeout: 2000 });
        await page.waitForTimeout(300);
      }
      await expect(prev).toBeDisabled();
      // Buttons: next scrolls and enables previous; at the end next disables.
      await next.click();
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await expect(prev).toBeEnabled();
      for (let i = 0; i < 6; i += 1) {
        if (!(await next.isEnabled())) break;
        await next.click({ timeout: 2000 });
        await page.waitForTimeout(150);
      }
      await expect(next).toBeDisabled();
    });

    test('model showcase falls back to a static silhouette without WebGL', async ({ page }) => {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        // @ts-expect-error -- test shim
        HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
          if (/webgl/i.test(type)) return null;
          // @ts-expect-error -- forward
          return original.call(this, type, ...args);
        };
      });
      await open(page, process.env[target.env]!);
      await expect(page.locator('html')).toHaveAttribute('data-webgl', 'off');
      const before = await page.locator('.showcase-stage').evaluate((el) => getComputedStyle(el, '::before').display);
      expect(before).not.toBe('none');
      await expect(page.locator('#showcase-03 .scene__fallback')).toBeVisible();
    });
  });
}

test('both targets expose the same content for every primitive', async ({ browser }) => {
  const texts: string[][] = [];
  for (const target of TARGETS) {
    const page = await browser.newPage();
    await open(page, process.env[target.env]!);
    texts.push(await page.locator('main :is(h1,h2,h3,p,a)').allInnerTexts());
    await page.close();
  }
  expect(texts[1]).toEqual(texts[0]);
});
