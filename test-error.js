const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error')
            console.log(`PAGE ERROR: ${msg.text()}`);
    });

    page.on('pageerror', exception => {
        console.log(`UNCAUGHT EXCEPTION: ${exception}`);
    });

    try {
        // Navigate to the public live URL where the error is happening
        await page.goto('https://b2b.artpar.com/login', { waitUntil: 'networkidle' });

        // We need to login to access dashboard/catalog
        await page.fill('input[type="email"]', 'admin@b2b.com'); // Put a valid credential or we will just try to visit the catalog and see if it crashes before auth redirect
        await page.fill('input[type="password"]', 'admin123'); // We don't have credentials
        await page.click('button[type="submit"]');

        await page.waitForTimeout(3000);
        await page.goto('https://b2b.artpar.com/dashboard/catalog', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
    } catch (e) {
        console.error(e);
    }

    await browser.close();
})();
