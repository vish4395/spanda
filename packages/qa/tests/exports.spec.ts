import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { artifactsDir } from '../src/sample.ts';

const TARGETS = [
  { name: 'html', env: 'STUDIO_HTML_URL' },
  { name: 'react', env: 'STUDIO_REACT_URL' },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const screenshotsDir = path.join(artifactsDir, 'screenshots');
await mkdir(screenshotsDir, { recursive: true });

/** Collect console errors and failed requests; both must stay empty. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`);
  });
  return errors;
}

async function waitReady(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
}

/** Scroll through the page so scroll-triggered reveals fire before a full-page capture. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800); // reveal transition is 700ms
}

const disableWebGL = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  // @ts-expect-error -- test shim: pretend the device has no WebGL
  HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
    if (/webgl/i.test(type)) return null;
    // @ts-expect-error -- forward to the real implementation
    return original.call(this, type, ...args);
  };
};

for (const target of TARGETS) {
  test.describe(`${target.name} export`, () => {
    const url = () => {
      const value = process.env[target.env];
      if (!value) throw new Error(`${target.env} not set by global setup`);
      return value;
    };

    for (const vp of VIEWPORTS) {
      test(`renders and captures ${vp.name}`, async ({ page, browserName }) => {
        const errors = watchErrors(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(url());
        await waitReady(page);

        await expect(page.locator('h1')).toHaveText('A Place With a Story');
        await expect(page.locator('h2')).toHaveText('Explore the Journey');
        await expect(page.locator('h1')).toBeVisible();

        const webgl = await page.locator('html').getAttribute('data-webgl');
        test.info().annotations.push({ type: 'webgl', description: `${webgl}` });
        if (webgl === 'on') await expect(page.locator('.scene__canvas').first()).toBeVisible();
        else await expect(page.locator('.scene__fallback').first()).toBeVisible();
        if (browserName === 'chromium') expect(webgl, 'Chromium must exercise the 3D path').toBe('on');

        // Layout guard: the 3D layer must overlay the hero, never take space from the copy.
        const heroBox = await page.locator('#hero-01').boundingBox();
        const copyBox = await page.locator('#hero-01 .scene__copy').boundingBox();
        expect(copyBox!.x - heroBox!.x, 'hero copy starts at the left gutter').toBeLessThan(Math.max(160, vp.width * 0.12));
        if (webgl === 'on') {
          const canvasBox = await page.locator('.scene__canvas').first().boundingBox();
          expect(Math.round(canvasBox!.width)).toBe(Math.round(heroBox!.width));
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, 'no horizontal scrolling').toBeLessThanOrEqual(0);

        await scrollThrough(page);
        await expect(page.locator('#chapter-02 .scene__copy')).toHaveCSS('opacity', '1');
        // Assert before capturing: WebKit reports Playwright's own screenshot stylesheet as a CSP violation.
        expect(errors).toEqual([]);
        await page.screenshot({ path: path.join(screenshotsDir, `${target.name}-${browserName}-${vp.name}.png`), fullPage: true, caret: 'initial' });
      });
    }

    test('falls back to static content without WebGL', async ({ page, browserName }) => {
      const errors = watchErrors(page);
      await page.addInitScript(disableWebGL);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(url());
      await waitReady(page);
      await expect(page.locator('html')).toHaveAttribute('data-webgl', 'off');
      await expect(page.locator('.scene__canvas')).toHaveCount(target.name === 'html' ? 1 : 0);
      if (target.name === 'html') await expect(page.locator('.scene__canvas')).toBeHidden();
      await expect(page.locator('#hero-01 .scene__fallback')).toBeVisible();
      await expect(page.locator('#hero-01 .scene__fallback')).toHaveText('A heritage introduction with scenic imagery.');
      await expect(page.locator('h1')).toBeVisible();
      await scrollThrough(page);
      // Assert before capturing: WebKit reports Playwright's own screenshot stylesheet as a CSP violation.
      expect(errors).toEqual([]);
      await page.screenshot({ path: path.join(screenshotsDir, `${target.name}-${browserName}-no-webgl.png`), fullPage: true, caret: 'initial' });
    });

    test('respects reduced motion', async ({ page, browserName }) => {
      const errors = watchErrors(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(url());
      await waitReady(page);
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
      // Content below the fold is already in its final state without scrolling.
      await expect(page.locator('#chapter-02 .scene__copy')).toHaveCSS('opacity', '1');
      await expect(page.locator('#chapter-02 .scene__copy')).toHaveCSS('transform', 'none');
      // Assert before capturing: WebKit reports Playwright's own screenshot stylesheet as a CSP violation.
      expect(errors).toEqual([]);
      await page.screenshot({ path: path.join(screenshotsDir, `${target.name}-${browserName}-reduced-motion.png`), fullPage: true, caret: 'initial' });
    });

    test('is keyboard navigable with a visible skip link', async ({ page, browserName }) => {
      await page.goto(url());
      await waitReady(page);
      // WebKit only tabs to links when "Tab highlights each item" is on; use Alt+Tab there.
      await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
      const skip = page.locator('.skip-link');
      await expect(skip).toBeFocused();
      const box = await skip.boundingBox();
      expect(box && box.y >= 0, 'skip link moves on-screen when focused').toBeTruthy();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });

    test('has semantic structure', async ({ page }) => {
      await page.goto(url());
      await waitReady(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('section[aria-labelledby]')).toHaveCount(2);
      await expect(page.locator('[role="img"][aria-label]')).toHaveCount(1);
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      expect(csp).toContain("script-src 'self'");
    });
  });
}

test('HTML and React exports render the same content', async ({ browser }) => {
  const texts: string[][] = [];
  for (const target of TARGETS) {
    const page = await browser.newPage();
    await page.goto(process.env[target.env]!);
    await waitReady(page);
    texts.push(await page.locator('main :is(h1,h2,p)').allInnerTexts());
    await page.close();
  }
  expect(texts[1]).toEqual(texts[0]);
});
