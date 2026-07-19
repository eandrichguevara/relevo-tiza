const { chromium } = require('playwright');
const CHROME_PATH = '/home/eandrich/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

async function debugLogin() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const page = await browser.newPage();
  
  // Monitor ALL network requests
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    if (url.includes('api') || url.includes('auth') || url.includes('login') || url.includes('token') || method === 'POST') {
      console.log('REQUEST:', method, url);
    }
  });
  
  page.on('response', response => {
    const url = response.url();
    const method = response.request().method();
    if (url.includes('api') || url.includes('auth') || url.includes('login') || url.includes('token') || method === 'POST') {
      console.log('RESPONSE:', response.status(), method, url);
    }
  });
  
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  
  // Fill and submit
  await page.fill('#email', 'prof.leng1.andes@sim.cl');
  await page.fill('#contraseña', 'sim123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log('Final URL:', page.url());
  
  await browser.close();
}

debugLogin().catch(console.error);