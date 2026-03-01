const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
    const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,800', '--ignore-certificate-errors', '--disable-web-security'] });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    console.log('Navigating to regularize...');
    try {
        await page.goto('https://www.regularize.pgfn.gov.br', { waitUntil: 'load', timeout: 30000 });
        console.log('Load complete, taking screenshot...');
        await page.screenshot({ path: path.join(__dirname, 'debug', 'test-pgfn-home.png') });
    } catch(e) {
        console.error("Failed:", e.message);
    }
    await browser.close();
})();
