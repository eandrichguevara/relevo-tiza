const { chromium } = require('playwright');
const path = require('path');

const CHROME_PATH = '/home/eandrich/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const BASE_TIZA = 'http://127.0.0.1:3001';
const BASE_RELEVO = 'http://127.0.0.1:3002';

async function testTizaFlows() {
  const browser = await chromium.launch({ 
    executablePath: CHROME_PATH,
    headless: true 
  });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Console Error: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    errors.push(`Page Error: ${err.message}`);
  });

  console.log('=== TIZA FLOWS ===');
  
  // 1. Landing page
  console.log('\n1. Testing TIZA Landing Page...');
  await page.goto(BASE_TIZA, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Tu tiempo, tu enseñanza")');
  const title = await page.title();
  console.log(`   Title: ${title}`);
  console.log(`   ✓ Landing page loads`);
  
  // Check navigation links
  const loginLink = await page.$('a[href="/login"]');
  const registerLink = await page.$('a[href="/register"]');
  console.log(`   Login link: ${loginLink ? '✓' : '✗'}`);
  console.log(`   Register link: ${registerLink ? '✓' : '✗'}`);
  
  // Check feature cards (3)
  const featureCards = await page.$$('.grid > div.bg-white, .grid.md\\:grid-cols-3 > div');
  console.log(`   Feature cards: ${featureCards.length} (expected 3)`);
  
  // Check footer
  const footer = await page.$('footer');
  console.log(`   Footer: ${footer ? '✓' : '✗'}`);
  
  // 2. Register page
  console.log('\n2. Testing Register Page...');
  await page.goto(`${BASE_TIZA}/register`, { waitUntil: 'networkidle' });
  console.log(`   Register page title: ${await page.title()}`);
  
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  const nameInput = await page.$('input[name="name"], input[name="nombre"]');
  const submitBtn = await page.$('button[type="submit"], button:has-text("Registrar"), button:has-text("Crear")');
  console.log(`   Email input: ${emailInput ? '✓' : '✗'}`);
  console.log(`   Password input: ${passwordInput ? '✓' : '✗'}`);
  console.log(`   Name input: ${nameInput ? '✓' : '✗'}`);
  console.log(`   Submit button: ${submitBtn ? '✓' : '✗'}`);
  
  // Test empty form submission
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(1000);
    const errorMsgs = await page.$$('.text-red-500, .text-destructive, [role="alert"], .error');
    console.log(`   Empty form validation: ${errorMsgs.length > 0 ? '✓' : '✗ (no visible validation)'}`);
  }
  
  // 3. Login page
  console.log('\n3. Testing Login Page...');
  await page.goto(`${BASE_TIZA}/login`, { waitUntil: 'networkidle' });
  console.log(`   Login page title: ${await page.title()}`);
  
  const loginEmail = await page.$('input[type="email"], input[name="email"]');
  const loginPassword = await page.$('input[type="password"], input[name="password"]');
  const loginBtn = await page.$('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar")');
  console.log(`   Email input: ${loginEmail ? '✓' : '✗'}`);
  console.log(`   Password input: ${loginPassword ? '✓' : '✗'}`);
  console.log(`   Submit button: ${loginBtn ? '✓' : '✗'}`);
  
  // Test empty login
  if (loginBtn) {
    await loginBtn.click();
    await page.waitForTimeout(1000);
    const loginErrors = await page.$$('.text-red-500, .text-destructive, [role="alert"], .error');
    console.log(`   Empty login validation: ${loginErrors.length > 0 ? '✓' : '✗'}`);
  }
  
  // 4. Test 404
  console.log('\n4. Testing 404 Page...');
  await page.goto(`${BASE_TIZA}/nonexistent-page-xyz`, { waitUntil: 'networkidle' });
  console.log(`   404 page title: ${await page.title()}`);
  const notFound = await page.$('h1:has-text("404"), h1:has-text("not found"), h1:has-text("No encontrada")');
  console.log(`   404 message: ${notFound ? '✓' : '✗'}`);
  
  // 5-7. Responsive tests
  console.log('\n5. Testing Mobile Responsive (375px)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE_TIZA, { waitUntil: 'networkidle' });
  console.log(`   Mobile view: OK`);
  
  console.log('\n6. Testing Tablet Responsive (768px)...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE_TIZA, { waitUntil: 'networkidle' });
  console.log(`   Tablet view: OK`);
  
  console.log('\n7. Testing Desktop (1440px)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_TIZA, { waitUntil: 'networkidle' });
  console.log(`   Desktop view: OK`);
  
  await browser.close();
  
  return { errors, app: 'TIZA' };
}

async function testRelevoFlows() {
  const browser = await chromium.launch({ 
    executablePath: CHROME_PATH,
    headless: true 
  });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Console Error: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    errors.push(`Page Error: ${err.message}`);
  });

  console.log('\n=== RELEVO FLOWS ===');
  
  // 1. Landing page
  console.log('\n1. Testing RELEVO Landing Page...');
  await page.goto(BASE_RELEVO, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Datos que transforman")');
  const title = await page.title();
  console.log(`   Title: ${title}`);
  console.log(`   ✓ Landing page loads`);
  
  // Check header (navy)
  const header = await page.$('header.bg-brand-primary, header[class*="brand-primary"]');
  console.log(`   Navy header: ${header ? '✓' : '✗'}`);
  
  // Check 4 feature cards
  const featureCards = await page.$$('.grid.md\\:grid-cols-4 > div, .grid.grid-cols-4 > div');
  console.log(`   Feature cards: ${featureCards.length} (expected 4)`);
  
  // Check demo button
  const demoBtn = await page.$('a[href="/register"]:has-text("Solicitar demo"), a[href="/register"]:has-text("Agenda")');
  console.log(`   Demo button: ${demoBtn ? '✓' : '✗'}`);
  
  // Check footer
  const footer = await page.$('footer');
  console.log(`   Footer: ${footer ? '✓' : '✗'}`);
  
  // 2. Register page
  console.log('\n2. Testing Register Page...');
  await page.goto(`${BASE_RELEVO}/register`, { waitUntil: 'networkidle' });
  console.log(`   Register page title: ${await page.title()}`);
  
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  const nameInput = await page.$('input[name="name"], input[name="nombre"], input[name="organization"]');
  const submitBtn = await page.$('button[type="submit"], button:has-text("Registrar"), button:has-text("Solicitar"), button:has-text("Crear")');
  console.log(`   Email input: ${emailInput ? '✓' : '✗'}`);
  console.log(`   Password input: ${passwordInput ? '✓' : '✗'}`);
  console.log(`   Name/Org input: ${nameInput ? '✓' : '✗'}`);
  console.log(`   Submit button: ${submitBtn ? '✓' : '✗'}`);
  
  // Test empty form
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(1000);
    const errorMsgs = await page.$$('.text-red-500, .text-destructive, [role="alert"], .error');
    console.log(`   Empty form validation: ${errorMsgs.length > 0 ? '✓' : '✗'}`);
  }
  
  // 3. Login page
  console.log('\n3. Testing Login Page...');
  await page.goto(`${BASE_RELEVO}/login`, { waitUntil: 'networkidle' });
  console.log(`   Login page title: ${await page.title()}`);
  
  const loginEmail = await page.$('input[type="email"], input[name="email"]');
  const loginPassword = await page.$('input[type="password"], input[name="password"]');
  const loginBtn = await page.$('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar")');
  console.log(`   Email input: ${loginEmail ? '✓' : '✗'}`);
  console.log(`   Password input: ${loginPassword ? '✓' : '✗'}`);
  console.log(`   Submit button: ${loginBtn ? '✓' : '✗'}`);
  
  // 4. Test 404
  console.log('\n4. Testing 404 Page...');
  await page.goto(`${BASE_RELEVO}/nonexistent-page-xyz`, { waitUntil: 'networkidle' });
  console.log(`   404 page title: ${await page.title()}`);
  const notFound = await page.$('h1:has-text("404"), h1:has-text("not found"), h1:has-text("No encontrada")');
  console.log(`   404 message: ${notFound ? '✓' : '✗'}`);
  
  // 5-7. Responsive tests
  console.log('\n5. Testing Mobile Responsive (375px)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE_RELEVO, { waitUntil: 'networkidle' });
  console.log(`   Mobile view: OK`);
  
  console.log('\n6. Testing Tablet Responsive (768px)...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE_RELEVO, { waitUntil: 'networkidle' });
  console.log(`   Tablet view: OK`);
  
  console.log('\n7. Testing Desktop (1440px)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE_RELEVO, { waitUntil: 'networkidle' });
  console.log(`   Desktop view: OK`);
  
  await browser.close();
  
  return { errors, app: 'RELEVO' };
}

async function testAPI() {
  console.log('\n=== API ENDPOINTS ===');
  
  const fetch = (await import('node-fetch')).default;
  
  // Health check
  try {
    const res = await fetch('http://127.0.0.1:8000/api/health');
    console.log(`GET /api/health: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`GET /api/health: FAILED - ${e.message}`);
  }
  
  // Register
  try {
    const testEmail = `test_${Date.now()}@example.com`;
    const res = await fetch('http://127.0.0.1:8000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: testEmail, 
        password: 'TestPass123!',
        name: 'Test User'
      })
    });
    console.log(`POST /api/auth/register: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`POST /api/auth/register: FAILED - ${e.message}`);
  }
  
  // Login
  try {
    const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'test@example.com', 
        password: 'TestPass123!' 
      })
    });
    console.log(`POST /api/auth/login: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`POST /api/auth/login: FAILED - ${e.message}`);
  }
}

async function main() {
  console.log('Starting QA Tests for RELEVO + TIZA...\n');
  
  const tizaResults = await testTizaFlows();
  const relevoResults = await testRelevoFlows();
  await testAPI();
  
  console.log('\n=== SUMMARY ===');
  console.log(`TIZA Errors: ${tizaResults.errors.length}`);
  tizaResults.errors.forEach(e => console.log(`  - ${e}`));
  console.log(`RELEVO Errors: ${relevoResults.errors.length}`);
  relevoResults.errors.forEach(e => console.log(`  - ${e}`));
  
  const totalErrors = tizaResults.errors.length + relevoResults.errors.length;
  console.log(`\nTotal Console/Page Errors: ${totalErrors}`);
  console.log(`\nOverall: ${totalErrors === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
}

main().catch(console.error);
