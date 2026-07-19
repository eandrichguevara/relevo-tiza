const { chromium } = require('playwright');
const CHROME_PATH = '/home/eandrich/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

async function debugLogin() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  
  // Fill and submit
  await page.fill('#email', 'prof.leng1.andes@sim.cl');
  await page.fill('#contraseña', 'sim123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log('Final URL:', page.url());
  
  // Get all text content
  const bodyText = await page.textContent('body');
  
  // Find error elements
  const errorEls = await page.$$('[class*="error" i], [class*="alert" i], [role="alert"], .toast, [class*="toast" i], [class*="message" i]');
  for (const el of errorEls) {
    const t = await el.textContent();
    if (t && t.trim().length > 0 && t.trim().length < 300) console.log('Error element:', t.trim());
  }
  
  // Also check for inline error messages near inputs
  const inputErrors = await page.$$('input[aria-invalid="true"], .error, .invalid, [class*="error" i]');
  for (const el of inputErrors) {
    const t = await el.textContent();
    if (t && t.trim().length > 0 && t.trim().length < 300) console.log('Input error:', t.trim());
  }
  
  // Print relevant body text around error
  if (bodyText.toLowerCase().includes('error') || bodyText.toLowerCase().includes('incorrect') || bodyText.toLowerCase().includes('credencial') || bodyText.toLowerCase().includes('inválid')) {
    console.log('\n=== BODY CONTAINS ERROR ===');
    const lines = bodyText.split('\n');
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('incorrect') || line.toLowerCase().includes('credencial') || line.toLowerCase().includes('inválid')) {
        console.log(`Line ${i}: ${line.trim()}`);
      }
    });
  }
  
  // Check if there's a redirect happening with JS
  const scripts = await page.$$('script');
  console.log('\nScripts count:', scripts.length);
  
  await browser.close();
}

debugLogin().catch(console.error);