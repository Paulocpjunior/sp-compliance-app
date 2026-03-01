const { chromium } = require('playwright');
(async () => {
  console.log('Initiating Playwright...');
  try {
    const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,800'] });
    console.log('Browser launched successfully.');
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
    console.log('Browser closed.');
  } catch (e) {
    console.error('Failed:', e);
  }
})();
