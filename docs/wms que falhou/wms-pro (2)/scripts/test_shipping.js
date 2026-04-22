const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('console', msg.type(), msg.text()));
  await page.goto('http://127.0.0.1:8000/login', { waitUntil: 'networkidle' });
  await page.fill('#login-username', 'admin_test');
  await page.fill('#login-password', 'Teste@12345');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.click('#login-btn')]);
  await page.click('button[data-page="saidas"]');
  await page.waitForSelector('#shipping-source-products .shipping-product-row', { timeout: 30000 });
  await page.click('#shipping-source-products .shipping-product-row button[data-shipping-add]');
  await page.waitForSelector('#shipping-add-modal.open', { timeout: 5000 });
  await page.click('#shipping-add-modal .btn.btn-accent');
  await page.waitForSelector('#shipping-cart-list .shipping-cart-row', { timeout: 5000 });
  const cartCount = await page.$$eval('#shipping-cart-list .shipping-cart-row', rows => rows.length);
  console.log('cart rows', cartCount);
  await browser.close();
})();
