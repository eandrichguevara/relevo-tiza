const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/home/eandrich/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const OUTPUT_DIR = '/home/eandrich/Projects/tiza-project/qa-results';

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function runTests() {
  await ensureDir(OUTPUT_DIR);
  
  // Clean old results
  fs.readdirSync(OUTPUT_DIR).forEach(f => {
    if (f !== '.gitkeep') fs.unlinkSync(path.join(OUTPUT_DIR, f));
  });
  
  const browser = await chromium.launch({ 
    headless: true, 
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = {
    timestamp: new Date().toISOString(),
    apps: {},
    bugs: [],
    uxIssues: [],
    consoleErrors: [],
    networkErrors: []
  };

  const apps = [
    { name: 'tiza-web', url: 'http://localhost:3001', port: 3001, isFrontend: true },
    { name: 'relevo-web', url: 'http://localhost:3002', port: 3002, isFrontend: true },
    { name: 'api', url: 'http://localhost:8000/docs', port: 8000, isFrontend: false }
  ];

  const resolutions = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 }
  ];

  for (const app of apps) {
    console.log(`\n=== Testing ${app.name} (${app.url}) ===`);
    results.apps[app.name] = { pages: {}, resolutions: {} };
    
    for (const res of resolutions) {
      console.log(`  Testing ${res.name} (${res.width}x${res.height})`);
      const context = await browser.newContext({
        viewport: { width: res.width, height: res.height },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      });
      
      const page = await context.newPage();
      
      // Capture console messages
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }));
      
      // Capture network errors
      const networkErrors = [];
      page.on('response', response => {
        if (response.status() >= 400) {
          networkErrors.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText()
          });
        }
      });
      
      try {
        const response = await page.goto(app.url, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });
        
        const title = await page.title();
        const url = page.url();
        const status = response ? response.status() : 'no response';
        
        // Take screenshot
        const screenshotPath = path.join(OUTPUT_DIR, `${app.name}-${res.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // Try accessibility snapshot (optional, don't fail if it doesn't work)
        let snapshotPath = null;
        try {
          const snapshot = await page.accessibility.snapshot();
          snapshotPath = path.join(OUTPUT_DIR, `${app.name}-${res.name}-snapshot.json`);
          fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        } catch (e) {
          console.log(`    ⚠️  Accessibility snapshot failed: ${e.message}`);
        }
        
        // Check for common UI elements
        const bodyText = await page.textContent('body') || '';
        const hasContent = bodyText.length > 100;
        const hasLogin = bodyText.toLowerCase().includes('iniciar') || 
                        bodyText.toLowerCase().includes('login') || 
                        bodyText.toLowerCase().includes('entrar') ||
                        bodyText.toLowerCase().includes('correo') ||
                        bodyText.toLowerCase().includes('email') ||
                        bodyText.toLowerCase().includes('contraseña') ||
                        bodyText.toLowerCase().includes('password');
        const hasError = bodyText.toLowerCase().includes('error') || 
                        bodyText.toLowerCase().includes('falló') ||
                        bodyText.toLowerCase().includes('failed') ||
                        bodyText.toLowerCase().includes('500') ||
                        bodyText.toLowerCase().includes('404');
        
        // Check for forms
        const forms = await page.$$('form');
        const inputs = await page.$$('input');
        const buttons = await page.$$('button');
        const links = await page.$$('a');
        
        // Check for specific elements for frontend apps
        let specificChecks = {};
        if (app.isFrontend) {
          // Check for common Next.js/React elements
          specificChecks = {
            hasNextJSData: await page.$('[data-nextjs]') !== null || await page.$('#__next') !== null,
            hasReactRoot: await page.$('#__next') !== null || await page.$('[data-reactroot]') !== null,
            hasNav: await page.$$('nav').length > 0,
            hasHeader: await page.$$('header').length > 0,
            hasMain: await page.$$('main').length > 0
          };
        }
        
        results.apps[app.name].resolutions[res.name] = {
          title,
          url,
          status,
          screenshot: screenshotPath,
          snapshot: snapshotPath,
          hasContent,
          hasLogin,
          hasError,
          forms: forms.length,
          inputs: inputs.length,
          buttons: buttons.length,
          links: links.length,
          bodyTextLength: bodyText.length,
          consoleErrors: consoleMessages.filter(m => m.type === 'error').length,
          consoleWarnings: consoleMessages.filter(m => m.type === 'warning').length,
          networkErrors: networkErrors.length,
          specificChecks
        };
        
        // Log console errors
        consoleMessages.filter(m => m.type === 'error').forEach(m => {
          results.consoleErrors.push({ app: app.name, resolution: res.name, ...m });
        });
        
        // Log network errors
        networkErrors.forEach(e => {
          results.networkErrors.push({ app: app.name, resolution: res.name, ...e });
        });
        
        console.log(`    ✓ ${title} (${status}) - ${bodyText.length} chars, ${forms.length} forms, ${inputs.length} inputs, ${buttons.length} buttons`);
        if (hasError) {
          console.log(`    ⚠️  Page contains error text!`);
          results.bugs.push({
            severity: 'MAJOR',
            app: app.name,
            resolution: res.name,
            title: 'Page contains error text',
            description: `Page at ${url} contains error-related text`,
            evidence: screenshotPath
          });
        }
        
        // Test keyboard navigation (Tab)
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName || 'none');
        console.log(`    Tab focus: ${focusedElement}`);
        
      } catch (error) {
        console.log(`    ✗ Failed: ${error.message}`);
        results.bugs.push({
          severity: 'CRITICAL',
          app: app.name,
          resolution: res.name,
          title: 'Page load failed',
          description: error.message,
          evidence: null
        });
      }
      
      await context.close();
    }
  }
  
  // Test API endpoints
  console.log('\n=== Testing API endpoints ===');
  const apiContext = await browser.newContext();
  const apiPage = await apiContext.newPage();
  
  const apiEndpoints = [
    'http://localhost:8000/docs',
    'http://localhost:8000/openapi.json',
    'http://localhost:8000/health',
    'http://localhost:8000/api/v1/health'
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await apiPage.goto(endpoint, { waitUntil: 'networkidle', timeout: 10000 });
      console.log(`  ${endpoint}: ${response.status()}`);
      if (response.status() >= 400) {
        results.networkErrors.push({ app: 'api', url: endpoint, status: response.status() });
      }
    } catch (e) {
      console.log(`  ${endpoint}: FAILED - ${e.message}`);
      results.networkErrors.push({ app: 'api', url: endpoint, error: e.message });
    }
  }
  
  await apiContext.close();
  await browser.close();
  
  // Save results
  const resultsPath = path.join(OUTPUT_DIR, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  // Generate markdown report
  const reportPath = path.join(OUTPUT_DIR, 'REPORT.md');
  generateReport(results, reportPath);
  
  console.log('\n=== QA REPORT GENERATED ===');
  console.log(`Results: ${resultsPath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Screenshots: ${OUTPUT_DIR}/*.png`);
  
  return results;
}

function generateReport(results, reportPath) {
  let md = `# 🐦‍⬛ Raven QA Report\n\n`;
  md += `**Generated:** ${results.timestamp}\n\n`;
  
  // Summary
  const totalBugs = results.bugs.length;
  const criticalBugs = results.bugs.filter(b => b.severity === 'CRITICAL').length;
  const majorBugs = results.bugs.filter(b => b.severity === 'MAJOR').length;
  const minorBugs = results.bugs.filter(b => b.severity === 'MINOR').length;
  const consoleErrors = results.consoleErrors.length;
  const networkErrors = results.networkErrors.length;
  
  md += `## Summary\n\n`;
  md += `| Metric | Count |\n|--------|-------|\n`;
  md += `| Apps Tested | ${Object.keys(results.apps).length} |\n`;
  md += `| Total Bugs | ${totalBugs} |\n`;
  md += `| Critical Bugs | ${criticalBugs} |\n`;
  md += `| Major Bugs | ${majorBugs} |\n`;
  md += `| Minor Bugs | ${minorBugs} |\n`;
  md += `| Console Errors | ${consoleErrors} |\n`;
  md += `| Network Errors | ${networkErrors} |\n\n`;
  
  // Apps detail
  md += `## Apps Tested\n\n`;
  for (const [appName, appData] of Object.entries(results.apps)) {
    md += `### ${appName}\n\n`;
    for (const [resName, resData] of Object.entries(appData.resolutions)) {
      md += `#### ${resName} (${resData.url})\n\n`;
      md += `- **Title:** ${resData.title}\n`;
      md += `- **Status:** ${resData.status}\n`;
      md += `- **Content:** ${resData.hasContent ? '✅' : '❌'} (${resData.bodyTextLength} chars)\n`;
      md += `- **Login Form:** ${resData.hasLogin ? '✅' : '❌'}\n`;
      md += `- **Error Text:** ${resData.hasError ? '⚠️ YES' : '✅ No'}\n`;
      md += `- **Forms:** ${resData.forms}, **Inputs:** ${resData.inputs}, **Buttons:** ${resData.buttons}, **Links:** ${resData.links}\n`;
      md += `- **Console Errors:** ${resData.consoleErrors}, **Warnings:** ${resData.consoleWarnings}\n`;
      md += `- **Network Errors:** ${resData.networkErrors}\n`;
      
      if (resData.specificChecks && Object.keys(resData.specificChecks).length > 0) {
        md += `- **Framework Checks:** `;
        const checks = [];
        for (const [key, val] of Object.entries(resData.specificChecks)) {
          checks.push(`${key}: ${val ? '✅' : '❌'}`);
        }
        md += checks.join(', ') + '\n';
      }
      
      md += `- **Screenshot:** \`${path.basename(resData.screenshot)}\`\n`;
      if (resData.snapshot) md += `- **Snapshot:** \`${path.basename(resData.snapshot)}\`\n`;
      md += `\n`;
    }
  }
  
  // Bugs
  if (results.bugs.length > 0) {
    md += `## Bugs Found\n\n`;
    for (const bug of results.bugs) {
      md += `### ${bug.severity}: ${bug.title}\n\n`;
      md += `- **App:** ${bug.app} (${bug.resolution})\n`;
      md += `- **Description:** ${bug.description}\n`;
      if (bug.evidence) md += `- **Evidence:** \`${path.basename(bug.evidence)}\`\n`;
      md += `\n`;
    }
  } else {
    md += `## Bugs Found\n\n✅ No bugs found.\n\n`;
  }
  
  // Console errors
  if (results.consoleErrors.length > 0) {
    md += `## Console Errors\n\n`;
    for (const err of results.consoleErrors) {
      md += `- **${err.app}** (${err.resolution}): [${err.type}] ${err.text}\n`;
    }
    md += `\n`;
  }
  
  // Network errors
  if (results.networkErrors.length > 0) {
    md += `## Network Errors\n\n`;
    for (const err of results.networkErrors) {
      md += `- **${err.app}**: ${err.url || err.endpoint} - ${err.status || err.error}\n`;
    }
    md += `\n`;
  }
  
  // Verdict
  md += `## Verdict\n\n`;
  if (criticalBugs > 0 || majorBugs > 0) {
    md += `❌ **FAIL** - ${criticalBugs} critical, ${majorBugs} major bugs block progression.\n\n`;
    md += `### Blocking Issues:\n`;
    results.bugs.filter(b => b.severity === 'CRITICAL' || b.severity === 'MAJOR').forEach(b => {
      md += `- [ ] ${b.severity}: ${b.title} (${b.app})\n`;
    });
  } else {
    md += `✅ **PASS** - No critical or major bugs found.\n\n`;
  }
  
  fs.writeFileSync(reportPath, md);
}

runTests().catch(console.error);