const { chromium } = require('playwright');
const CHROME_PATH = '/home/eandrich/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

async function debugLogin() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const page = await browser.newPage();
  
  // Monitor network
  page.on('response', response => {
    const url = response.url();
    if (url.includes('login') || url.includes('auth') || url.includes('token') || url.includes('api')) {
      console.log('RESPONSE:', response.status(), url);
    }
  });
  
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  console.log('Initial URL:', page.url());
  
  // Fill and submit
  await page.fill('#email', 'prof.leng1.andes@sim.cl');
  await page.fill('#contraseña', 'sim123');
  
  const responsePromise = page.waitForResponse(r => {
    const u = r.url();
    return u.includes('login') || u.includes('auth') || u.includes('token') || u.includes('/api/');
  }, { timeout: 5000 }).catch(() => null);
  
  await page.click('button[type="submit"]');
  const resp = await responsePromise;
  
  if (resp) {
    const body = await resp.text().catch(() => 'no body');
    console.log('LOGIN RESPONSE:', resp.status(), resp.url());
    console.log('BODY:', body.substring(0, 500));
  }
  
  await page.waitForTimeout(3000);
  console.log('Final URL:', page.url());
  
  // Check for error messages in UI
  const bodyText = await page.textContent('body');
  if (bodyText.includes('Error') || bodyText.includes('error') || bodyText.includes('incorrect') || bodyText.includes('inválid') || bodyText.includes('credencial')) {
    console.log('Found error text!');
    // Find the error element
    const errorEls = await page.$$('[class*="error" i], [class*="alert" i], [role="alert"], .toast');
    for (const el of errorEls) {
      const t = await el.textContent();
      if (t && t.trim().length > 0 && t.trim().length < 200) console.log('Error element:', t.trim());
    }
  }
  
  await browser.close();
}

debugLogin().catch(console.error);