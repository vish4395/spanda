import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { launchStudio, screenshots } from './launch.ts';

let app: ElectronApplication;
let win: Page;

type ItemInfo = { label: string; role: string | undefined; enabled: boolean; checked: boolean; type: string };

/** Click a menu-bar item by id, exactly as a user selecting it would. */
const clickMenu = (id: string) =>
  app.evaluate(({ Menu }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
    if (!item) throw new Error(`menu item ${itemId} not found`);
    item.click();
  }, id);

const menuItem = (id: string) =>
  app.evaluate(({ Menu }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
    return item ? { enabled: item.enabled, checked: item.checked, label: item.label } : null;
  }, id);

const topLevel = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map((i) => i.label.replace(/&/g, '')) ?? []);

/** Context menus are captured instead of shown, so their items can be inspected and clicked. */
async function lastContextMenu(): Promise<ItemInfo[]> {
  await expect.poll(() => app.evaluate(() => Boolean((globalThis as { __menu?: unknown }).__menu))).toBe(true);
  return app.evaluate(() =>
    ((globalThis as unknown as { __menu: { items: { label: string; role?: string; enabled: boolean; checked: boolean; type: string }[] } }).__menu.items).map((i) => ({ label: i.label, role: i.role, enabled: i.enabled, checked: i.checked, type: i.type })),
  );
}
const clickContext = (label: string) =>
  app.evaluate((_e, text) => {
    const menu = (globalThis as unknown as { __menu: { items: { label: string; click: () => void }[] } }).__menu;
    const item = menu.items.find((i) => i.label === text);
    if (!item) throw new Error(`context item ${text} not found`);
    item.click();
  }, label);
const resetContext = () => app.evaluate(() => void ((globalThis as { __menu?: unknown }).__menu = undefined));

test.beforeAll(async () => {
  ({ app, win } = await launchStudio(await mkdtemp(path.join(tmpdir(), 'studio-menus-'))));
  await app.evaluate(({ Menu }) => {
    Menu.prototype.popup = function capture(this: unknown) {
      (globalThis as { __menu?: unknown }).__menu = this;
    };
  });
  await expect(win.getByRole('heading', { level: 1, name: 'Heritage Journey' })).toBeVisible();
});
test.afterAll(() => app?.close());

test('menu bar has the platform menus and edit roles', async () => {
  const labels = await topLevel();
  for (const name of ['File', 'Edit', 'View', 'Project', 'Window', 'Help']) expect(labels).toContain(name);
  if (process.platform === 'darwin') expect(labels[0]).toBe('Electron'); // app menu (named after the bundle in dev)
  const roles = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items.find((i) => i.label.replace(/&/g, '') === 'Edit')!.submenu!.items.map((i) => i.role).filter(Boolean));
  expect(roles).toEqual(expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectall']));
});

test('View menu switches tabs, preview target and device, with live checks', async () => {
  await expect.poll(() => menuItem('tab.build')).toMatchObject({ checked: true, enabled: true });
  await clickMenu('tab.discover');
  await expect(win.getByRole('tab', { name: 'Discover' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await menuItem('tab.discover'))?.checked).toBe(true);
  await clickMenu('tab.brief');
  await expect(win.getByRole('tab', { name: 'Brief' })).toHaveAttribute('aria-selected', 'true');
  await clickMenu('target.react');
  await expect(win.getByRole('tab', { name: 'Build & preview' })).toHaveAttribute('aria-selected', 'true');
  await expect(win.getByRole('radio', { name: 'React' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await menuItem('target.react'))?.checked).toBe(true);
  await clickMenu('device.mobile');
  await expect(win.getByRole('radio', { name: 'Mobile' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await menuItem('device.mobile'))?.checked).toBe(true);
  await clickMenu('device.desktop');
  await clickMenu('target.html');
  // T019: the reduced-motion checkbox mirrors the toolbar toggle both ways.
  const motion = win.getByRole('button', { name: 'Reduced motion' });
  await clickMenu('preview.reducedMotion');
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await menuItem('preview.reducedMotion'))?.checked).toBe(true);
  await motion.click();
  await expect.poll(async () => (await menuItem('preview.reducedMotion'))?.checked).toBe(false);
});

test('Project menu generates, cancels and reloads the preview; enabled states follow', async () => {
  await expect.poll(async () => (await menuItem('project.cancel'))?.enabled).toBe(false);
  await expect.poll(async () => (await menuItem('preview.reload'))?.enabled).toBe(false); // nothing built yet
  await clickMenu('project.generate');
  await expect(win.locator('.topbar__status')).toContainText('Generating');
  await expect.poll(async () => (await menuItem('project.generate'))?.enabled).toBe(false);
  await expect.poll(async () => (await menuItem('project.cancel'))?.enabled).toBe(true);
  await clickMenu('project.cancel');
  await expect(win.locator('.topbar__status')).toContainText('Cancelled', { timeout: 30_000 });
  await clickMenu('project.generate');
  await expect(win.locator('.topbar__status')).toContainText('Ready', { timeout: 200_000 });
  await expect(win.frameLocator('iframe').locator('h1')).toHaveText('A Place With a Story', { timeout: 30_000 });
  await expect.poll(async () => (await menuItem('preview.reload'))?.enabled).toBe(true);
  const before = await win.locator('iframe').evaluate((el) => (el as HTMLIFrameElement & { __id?: number }).__id = Math.random());
  await clickMenu('preview.reload');
  await expect.poll(() => win.locator('iframe').evaluate((el) => (el as HTMLIFrameElement & { __id?: number }).__id)).not.toBe(before);
  await expect(win.frameLocator('iframe').locator('h1')).toHaveText('A Place With a Story', { timeout: 30_000 });
});

test('File menu: snapshot, new project; items disable outside a project', async () => {
  await expect.poll(async () => (await menuItem('project.snapshot'))?.enabled).toBe(true);
  await clickMenu('project.snapshot');
  await expect(win.getByRole('status').filter({ hasText: 'Snapshot saved' })).toHaveCount(1);
  await clickMenu('project.new');
  await expect(win.getByRole('heading', { level: 1, name: 'New project' })).toBeVisible();
  await expect.poll(async () => (await menuItem('project.generate'))?.enabled).toBe(false);
  await expect.poll(async () => (await menuItem('project.snapshot'))?.enabled).toBe(false);
  await expect.poll(async () => (await menuItem('tab.build'))?.enabled).toBe(false);
  await clickMenu('view.skills');
  await expect(win.getByRole('heading', { level: 1, name: 'Skills' })).toBeVisible();
  await clickMenu('view.providers');
  await expect(win.getByRole('heading', { level: 1, name: 'AI providers' })).toBeVisible();
});

test('project context menu: open, copy ID, snapshot and generate target the right project', async () => {
  await resetContext();
  await win.locator('.project-item', { hasText: 'Heritage Journey' }).click({ button: 'right' });
  const items = await lastContextMenu();
  expect(items.filter((i) => i.type !== 'separator').map((i) => i.label)).toEqual(['Open', 'Generate HTML + React', 'Save Snapshot', process.platform === 'darwin' ? 'Reveal in Finder' : process.platform === 'win32' ? 'Show in Explorer' : 'Open Containing Folder', 'Copy Project ID']);
  await clickContext('Copy Project ID');
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('demo-heritage');
  await clickContext('Open');
  await expect(win.getByRole('heading', { level: 1, name: 'Heritage Journey' })).toBeVisible();
  // Keyboard users: Shift+F10 opens the same menu on the focused item.
  await resetContext();
  await win.locator('.project-item', { hasText: 'Heritage Journey' }).focus();
  await win.keyboard.press('Shift+F10');
  expect((await lastContextMenu()).some((i) => i.label === 'Copy Project ID')).toBe(true);
});

test('version context menu restores a version and copies its hash', async () => {
  const versions = win.getByRole('list', { name: 'Version history, newest first' });
  await expect(versions.getByRole('listitem')).toHaveCount(1); // snapshot of unchanged spec was deduplicated
  await resetContext();
  await versions.getByRole('listitem').first().click({ button: 'right' });
  const items = await lastContextMenu();
  expect(items[0]).toMatchObject({ label: 'Current version', enabled: false });
  await clickContext('Copy Content Hash');
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toMatch(/^[0-9a-f]{64}$/);
});

test('default context menus: editable fields, selections and the preview frame', async () => {
  const items = (params: Record<string, unknown>) =>
    app.evaluate(({ BrowserWindow }, p) => {
      (globalThis as { __menu?: unknown }).__menu = undefined;
      const wc = BrowserWindow.getAllWindows()[0]!.webContents;
      wc.emit('context-menu', { preventDefault() {} }, { x: 10, y: 10, selectionText: '', frameURL: 'app://studio/index.html', isEditable: false, editFlags: { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: true, canSelectAll: true }, ...p });
      const menu = (globalThis as unknown as { __menu?: { items: { label: string; role?: string; enabled: boolean }[] } }).__menu;
      return menu ? menu.items.map((i) => ({ label: i.label, role: i.role, enabled: i.enabled })) : [];
    }, params);
  const editable = await items({ isEditable: true });
  expect(editable.filter((i) => i.role).map((i) => [i.role, i.enabled])).toEqual([['undo', false], ['redo', false], ['cut', false], ['copy', false], ['paste', true], ['selectall', true]]);
  expect((await items({ selectionText: 'Heritage' })).map((i) => i.role)).toContain('copy');
  const preview = await items({ frameURL: 'http://127.0.0.1:5555/0123456789abcdef0123456789abcdef/index.html' });
  expect(preview.map((i) => i.label)).toEqual(expect.arrayContaining(['Reload Preview', 'Copy Preview Link', 'Open Preview in Browser']));
  // Non-preview remote frames never get "open in browser".
  const other = await items({ frameURL: 'https://evil.example/' });
  expect(other.map((i) => i.label)).not.toContain('Open Preview in Browser');
  await win.screenshot({ path: path.join(screenshots, 'desktop-menus.png') });
});
