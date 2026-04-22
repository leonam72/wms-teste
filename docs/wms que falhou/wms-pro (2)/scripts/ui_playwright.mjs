import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:8000';
const credentials = { username: 'admin_test', password: 'Teste@12345' };
const navPages = ['depot','depots','conference','conference-cards','unloads','unload-review','saidas','products','floorplan','quality','indicators','outbound','qr','history','settings','help'];
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('console', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('pageerror', err.message));
  page.on('response', res => { if (res.status() >= 400) console.log('bad-response', res.status(), res.url()); });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-username', credentials.username);
  await page.fill('#login-password', credentials.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('#login-btn'),
  ]);
  for (const pageKey of navPages) {
    const selector = `button[data-page="${pageKey}"]`;
    if (await page.locator(selector).count()) {
      await page.click(selector);
      await page.waitForTimeout(400);
    }
  }
  const drawer = page.locator('.drawer[data-key]').first();
  if (await drawer.count()) {
    await drawer.click();
    await page.waitForTimeout(300);
    if (await page.locator('#products-add-btn').count()) {
      await page.click('#products-add-btn');
      await page.waitForTimeout(300);
      await page.click('#product-form-modal .close-btn');
    }
  }
  if (await page.locator('#shipping-finalize-modal').count()) {
    await page.click('button[data-page="saidas"]');
    await page.waitForTimeout(300);
    if (await page.locator('#shipping-operation-type').count()) {
      await page.click('#shipping-operation-type');
      await page.click('#shipping-finalize-modal .close-btn');
    }
  }
  await page.screenshot({ path: `/home/leonamramosfoli/Documentos/wms/run/ui-after-layout.png`, fullPage: true, timeout: 5000 }).catch(() => {});
  await browser.close();
  console.log('ui smoke completed');
})().catch(err => { console.error(err); process.exit(1); });
