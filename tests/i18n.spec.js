import { test, expect } from '@playwright/test';
import { CATALOG } from '../src/models/catalog.js';
import { hasContentTranslation } from '../src/i18n/index.js';

async function openLocalized(page, query = '') {
  await page.goto(`/?manual=1&n=5000&dpr=1&${query}`);
  await page.waitForFunction(() => window.wonderSnap);
  await page.evaluate(async () => { await wonderSnap.ready(); await wonderSnap.advance(1 / 60, null); });
}

test('all model names, facts, categories and visible parts have Vietnamese translations', () => {
  const missing = new Set();
  for (const model of CATALOG) {
    const strings = [model.name, model.fact, model.category];
    for (const part of model.groups?.() || []) {
      if (part.showLabel !== false) strings.push(part.label, part.info);
    }
    for (const value of strings.filter(Boolean)) if (!hasContentTranslation(value)) missing.add(value);
  }
  expect([...missing]).toEqual([]);
});

test('Vietnamese is the default and the startup dialog has an accessible switcher', async ({ page }) => {
  await page.goto('/?n=5000');
  await page.waitForFunction(() => window.wonderSnap);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#bStartCam')).toHaveText('Bắt đầu với camera');
  await page.locator('#startLanguageSelect').selectOption('en');
  await expect(page.locator('#bStartCam')).toHaveText('Start with camera');
  await expect(page.locator('#languageSelect')).toHaveValue('en');
  await page.locator('#bStartNoCam').click();
  await expect(page.locator('#start')).toBeHidden();
});

test('switching language preserves canonical scene IDs, selection, quiz and model cache', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await openLocalized(page, 'lang=vi');
  await page.evaluate(async () => {
    const W = wonderSnap;
    W.select(W.CATALOG.findIndex((m) => m.name === 'Human Brain'), true);
    await W.advance(2, null);
    W.app.selectPart(0);
    W.app.updateHud(W.app.t, 2);
  });
  await expect(page.locator('#partCard .pname')).toHaveText('Thùy trán');
  const before = await page.evaluate(() => ({ ...wonderSnap.status(), cache: [...wonderSnap.app.store.cache.keys()] }));
  await page.evaluate(() => { window.__modelBeforeLocaleChange = wonderSnap.app.model; });
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.locator('#name')).toHaveText('Human Brain');
  await expect(page.locator('#partCard .pname')).toHaveText('Frontal lobe');
  expect(await page.evaluate(() => wonderSnap.app.model === window.__modelBeforeLocaleChange)).toBe(true);
  const after = await page.evaluate(() => ({ ...wonderSnap.status(), cache: [...wonderSnap.app.store.cache.keys()] }));
  for (const key of ['index', 'state', 'selected', 't', 'uploaded']) expect(after[key]).toEqual(before[key]);
  expect(after.cache).toEqual(before.cache);
  await page.evaluate(async () => { wonderSnap.app.startQuiz(); await wonderSnap.advance(0.1); wonderSnap.app.answerQuiz(wonderSnap.app.quiz.target); });
  await page.locator('#languageSelect').selectOption('vi');
  await expect(page.locator('#quiz .qf')).toContainText('Chính xác!');
  expect((await page.evaluate(() => wonderSnap.status())).quiz.score).toBe(1);
  expect(errors).toEqual([]);
});

test('URL overrides storage and a user choice survives reload', async ({ page }) => {
  await openLocalized(page, 'lang=en');
  await expect(page.locator('#bSnap')).toHaveText('🫰 Snap');
  await page.locator('#languageSelect').selectOption('vi');
  expect(await page.evaluate(() => localStorage.getItem('wondersnap.locale'))).toBe('vi');
  await page.reload();
  await page.waitForFunction(() => window.wonderSnap);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await openLocalized(page, 'lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('blocked localStorage does not stop the app', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } }));
  await openLocalized(page);
  await page.locator('#languageSelect').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('keyboard interaction with a language selector does not move the scene', async ({ page }) => {
  await openLocalized(page);
  const before = await page.evaluate(() => wonderSnap.status().index);
  await page.locator('#languageSelect').focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => wonderSnap.status().index)).toBe(before);
});

test('Vietnamese voice input keeps canonical identities', async ({ page }) => {
  await openLocalized(page);
  expect(await page.evaluate(() => wonderSnap.voice('cho tôi xem tim'))).toEqual(['Human Heart']);
  await page.evaluate(() => wonderSnap.advance(2));
  await expect(page.locator('#name')).toHaveText('Tim người');
});
