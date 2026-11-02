import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { StorySpec } from '@studio/contracts';
import { artifactsDir, BENCHMARKS, repoRoot, SAMPLES } from '../src/sample.ts';

// M3 exit: every benchmark brief exports to both native targets, builds, and runs cleanly.
const TARGETS = ['html', 'react'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
const shots = path.join(artifactsDir, 'screenshots');
const urls = () => JSON.parse(process.env.STUDIO_BENCHMARKS!) as Record<string, Record<(typeof TARGETS)[number], string>>;
const specOf = (name: string) => JSON.parse(readFileSync(path.join(repoRoot, SAMPLES[name as keyof typeof SAMPLES]), 'utf8')) as StorySpec;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
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

for (const name of BENCHMARKS) {
  const spec = specOf(name);
  const scenes = spec.pages[0]!.scenes;
  const hero = scenes.find((s) => s.type === 'hero')!;

  test.describe(`benchmark: ${name}`, () => {
    for (const target of TARGETS) {
      for (const vp of VIEWPORTS) {
        test(`${target} runs cleanly (${vp.name})`, async ({ page, browserName }) => {
          const errors = watchErrors(page);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await open(page, urls()[name]![target]);
          await expect(page.locator('h1')).toHaveText(hero.content.heading);
          for (const scene of scenes) {
            await expect(page.locator(`#${scene.id}`)).toBeAttached();
            await expect(page.locator(`#${scene.id}`)).toContainText(scene.content.heading);
          }
          for (const scene of scenes.filter((s) => s.content.cta)) {
            await expect(page.locator(`#${scene.id} a.cta`)).toHaveAttribute('href', scene.content.cta!.href);
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, 'no horizontal page scroll').toBeLessThanOrEqual(0);
          await scrollThrough(page);
          expect(errors).toEqual([]);
          await page.screenshot({ path: path.join(shots, `benchmark-${name}-${target}-${browserName}-${vp.name}.png`), fullPage: true, caret: 'initial' });
        });
      }

      test(`${target} works with reduced motion and without WebGL`, async ({ browser }) => {
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          // @ts-expect-error -- test shim: pretend the device has no WebGL
          HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
            if (/webgl/i.test(type)) return null;
            // @ts-expect-error -- forward to the real implementation
            return original.call(this, type, ...args);
          };
        });
        const errors = watchErrors(page);
        await open(page, urls()[name]![target]);
        await expect(page.locator('html')).toHaveAttribute('data-webgl', 'off');
        // With reduced motion every scene's content is visible without scrolling it into view.
        for (const scene of scenes) await expect(page.locator(`#${scene.id}`).getByText(scene.content.heading, { exact: true }).first()).toBeVisible();
        expect(errors.filter((e) => !/webgl/i.test(e))).toEqual([]);
        await context.close();
      });
    }

    test('HTML and React expose the same content', async ({ browser }) => {
      const texts: string[][] = [];
      for (const target of TARGETS) {
        const page = await browser.newPage();
        await open(page, urls()[name]![target]);
        texts.push(await page.locator('main :is(h1,h2,h3,p,a,li)').allInnerTexts());
        await page.close();
      }
      expect(texts[1]).toEqual(texts[0]);
    });
  });
}
