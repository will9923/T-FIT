const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.log('PAGE ERROR:', err.message);
    });

    await page.goto('http://localhost:3000'); // Assuming there is no local server running, wait!

    // I need to use the actual URL if possible, or I can just use file:///c:/...
    const url = 'file:///C:/Users/willc/OneDrive/Desktop/tfit%20nova%20versao/index.html';
    await page.goto(url);

    // wait for app to settle
    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
