import { test, expect } from '@playwright/test';
const BASE = 'http://127.0.0.1:8000';
const credentials = { username: 'admin_test', password: 'Teste@12345' };
const navPages = ['depot','depots','conference','conference-cards','unloads','unload-review','saidas','products','floorplan','quality','indicators','outbound','qr','history','settings','help'];

test.describe('UI smoke', () => {
  test('cover navigation and modals', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#login-username', credentials.username);
    await page.fill('#login-password', credentials.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#login-btn'),
    ]);
    for (const key of navPages) {
      const button = page.locator(`button[data-page="${key}"]`).first();
      if (await button.count()) {
        await button.click();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(400);
    await page.waitForSelector('.drawer[data-key]:visible', { timeout: 5000 }).catch(() => {});
    const drawer = page.locator('.drawer[data-key]:visible').first();
    if (await drawer.count()) {
      await drawer.scrollIntoViewIfNeeded();
      await drawer.click();
      await page.waitForTimeout(300);
      const addBtn = page.locator('#products-add-btn');
      if (await addBtn.count()) {
        await addBtn.click();
        await page.waitForTimeout(200);
        await page.locator('#product-form-modal .close-btn').click();
      }
    }
    const shippingPanel = page.locator('#shipping-operation-type');
    if (await shippingPanel.count()) {
      await page.click('button[data-page="saidas"]');
      await page.waitForTimeout(300);
      await shippingPanel.click();
    }
    await expect(page.locator('#sync-status-pill')).toBeVisible();
  });
});
