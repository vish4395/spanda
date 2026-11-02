// Render the app icon from the brand SVG into the files each platform needs (outputs are committed).
// Run: pnpm --filter @studio/desktop icons   (needs Playwright's Chromium; .icns needs macOS `iconutil`)
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appDir, '../..');
const source = path.join(repoRoot, 'docs/brand/assets/spanda-icon.svg');
const outDir = path.join(appDir, 'build/icons');

const svg = await readFile(source);
const dataUrl = `data:image/svg+xml;base64,${svg.toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Full-bleed render (Windows, Linux). `macos` adds Apple's grid: 824/1024 artwork, centred, with a soft shadow. */
async function render(size: number, macos = false): Promise<Buffer> {
  const art = macos ? Math.round(size * (824 / 1024)) : size;
  const shadow = macos ? `filter: drop-shadow(0 ${size * 0.01}px ${size * 0.02}px rgb(0 0 0 / 0.35));` : '';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}body{width:${size}px;height:${size}px;display:grid;place-items:center}</style>` +
      `<img src="${dataUrl}" width="${art}" height="${art}" style="${shadow}">`,
  );
  await page.waitForFunction('document.images[0].complete && document.images[0].naturalWidth > 0');
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** ICO container holding PNG images (supported since Windows Vista). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

await mkdir(outDir, { recursive: true });

// Window icon (Linux, Windows dev) and the dev Dock icon on macOS.
await writeFile(path.join(outDir, 'icon.png'), await render(512));
await writeFile(path.join(outDir, 'macos-dock.png'), await render(1024, true));

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
await writeFile(path.join(outDir, 'icon.ico'), ico(await Promise.all(icoSizes.map(async (size) => ({ size, png: await render(size) })))));

if (process.platform === 'darwin') {
  const iconset = path.join(await mkdtemp(path.join(tmpdir(), 'spanda-')), 'icon.iconset');
  await mkdir(iconset);
  for (const base of [16, 32, 128, 256, 512]) {
    await writeFile(path.join(iconset, `icon_${base}x${base}.png`), await render(base, true));
    await writeFile(path.join(iconset, `icon_${base}x${base}@2x.png`), await render(base * 2, true));
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(outDir, 'icon.icns')]);
  await rm(path.dirname(iconset), { recursive: true, force: true });
} else {
  console.warn('Skipped icon.icns: iconutil is macOS-only.');
}

await browser.close();
console.log(`Icons written to ${path.relative(repoRoot, outDir)}`);
