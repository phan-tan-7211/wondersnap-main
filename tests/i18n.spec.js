import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers.js';

test('delayed translations do not stop rendering; repeated locale changes keep one catalog', async ({ page }) => {
  const noErrors = watchErrors(page);
  let requests = 0;
  await page.route('**/src/locales/*.json', async route => {
    requests++;
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.continue();
  });
  await page.goto('/?autostart=nocamera&n=5000');
  await page.waitForFunction(() => window.wonderSnap?.status().frames > 5);
  await page.locator('#catTabs [data-cat="Anatomy"]').click();
  await page.locator('#catChips .chip:visible').first().click();
  await page.waitForFunction(() => window.wonderSnap.status().state === 'formed');
  const index = await page.evaluate(() => window.wonderSnap.status().index);
  for (const locale of ['vi', 'en', 'vi', 'en', 'vi']) {
    await page.selectOption('#localeSelector', locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#catTabs .tab')).toHaveCount(6);
    await expect(page.locator('#catChips .chip')).toHaveCount(33);
    await expect(page.locator('#catChips .chip:visible')).toHaveCount(10);
    await expect(page.locator('#catChips .chip.active')).toHaveAttribute('data-index', String(index));
    await expect(page.locator('#cat')).toHaveText(locale === 'vi' ? 'Giải phẫu' : 'Anatomy');
    await expect(page.locator('#statePill')).toHaveText(locale === 'vi' ? 'đã tạo hình' : 'formed');
    const frames = await page.evaluate(() => window.wonderSnap.status().frames);
    await page.waitForFunction(previous => window.wonderSnap.status().frames > previous + 5, frames);
  }
  expect(requests).toBe(6);
  noErrors();
});

test('camera continues rendering when switching from a saved Vietnamese locale', async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('wondersnap-locale', 'vi'));
  await page.goto('/?autostart=camera&n=5000');
  await page.waitForFunction(() => window.wonderSnap?.status().camera?.frames > 5);
  await expect(page.locator('#statePill')).toHaveText('chờ');
  await expect(page.locator('#stats')).toContainText('camera bật');
  await page.selectOption('#localeSelector', 'en');
  await expect(page.locator('#stats')).toContainText('camera on');
  const frames = await page.evaluate(() => window.wonderSnap.status().camera.frames);
  await page.waitForFunction(previous => window.wonderSnap.status().camera.frames > previous + 5, frames);
  expect(await page.evaluate(() => window.wonderSnap.app.hasVideo)).toBe(true);
  await page.locator('#bCam').click();
  await expect(page.locator('#stats')).toContainText('camera off');
  noErrors();
});
