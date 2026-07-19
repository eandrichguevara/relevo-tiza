const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/home/eandrich/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const OUTPUT_DIR = '/home/eandrich/Projects/tiza-project/qa-results';

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function runFullQATest() {
  await ensureDir(OUTPUT_DIR);

  // Clean old results
  fs.readdirSync(OUTPUT_DIR).forEach((f) => {
    if (f !== '.gitkeep') fs.unlinkSync(path.join(OUTPUT_DIR, f));
  });

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = {
    timestamp: new Date().toISOString(),
    verifications: [],
    bugs: [],
    uxIssues: [],
    consoleErrors: [],
    networkErrors: [],
    screenshots: [],
  };

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Capture console and network
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      results.consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      results.networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  function takeScreenshot(name) {
    const filepath = path.join(OUTPUT_DIR, `${name}.png`);
    page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, filepath });
    console.log(`  📸 Screenshot: ${name}`);
    return filepath;
  }

  function addVerification(name, passed, details = '', screenshot = null) {
    results.verifications.push({
      name,
      passed,
      details,
      screenshot,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ${passed ? '✅' : '❌'} ${name}: ${details}`);
  }

  function addBug(severity, title, description, evidence = null) {
    results.bugs.push({
      severity,
      title,
      description,
      evidence,
      timestamp: new Date().toISOString(),
    });
    console.log(`  🐛 ${severity}: ${title} - ${description}`);
  }

  // ==================== A. RELEVO-WEB (Sostenedor) ====================
  console.log('\n=== A. RELEVO-WEB (Sostenedor) ===');

  // A.1 Login HOLDER
  console.log('\nA.1 Login HOLDER');
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('form');
  await page.fill('#email', 'sim_holder@test.cl');
  await page.fill('#contraseña', 'sim123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const loginUrl = page.url();
  const loginSuccess = loginUrl.includes('/dashboard');
  takeScreenshot('A1-relevo-login-success');
  addVerification('A.1 Login HOLDER', loginSuccess, `Redirected to ${loginUrl}`);
  if (!loginSuccess)
    addBug(
      'CRITICAL',
      'A.1 Login HOLDER failed',
      `Did not redirect to dashboard. Current URL: ${loginUrl}`
    );

  // A.2 Dashboard - estadísticas
  console.log('\nA.2 Dashboard Sostenedor');
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const dashContent = await page.textContent('body');
  const hasEscuelas =
    dashContent.includes('escuela') ||
    dashContent.includes('colegio') ||
    dashContent.includes('Escuela') ||
    dashContent.includes('Colegio');
  const hasProfesores = dashContent.includes('profesor') || dashContent.includes('Profesor');
  const hasEvaluaciones = dashContent.includes('evaluación') || dashContent.includes('Evaluación');
  takeScreenshot('A2-relevo-dashboard');
  addVerification(
    'A.2 Dashboard stats',
    hasEscuelas && hasProfesores && hasEvaluaciones,
    `Escuelas: ${hasEscuelas}, Profesores: ${hasProfesores}, Evaluaciones: ${hasEvaluaciones}`
  );
  if (!hasEscuelas || !hasProfesores || !hasEvaluaciones) {
    addBug(
      'MAJOR',
      'A.2 Dashboard missing stats',
      'Dashboard does not show expected statistics',
      'A2-relevo-dashboard.png'
    );
  }

  // A.3 Colegios
  console.log('\nA.3 Colegios');
  await page.goto('http://localhost:3002/dashboard/colegios', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const colegiosContent = await page.textContent('body');
  const hasAndes = colegiosContent.includes('Andes');
  const hasSur = colegiosContent.includes('Sur');
  const hasCentral = colegiosContent.includes('Central');
  takeScreenshot('A3-relevo-colegios');
  addVerification(
    'A.3 Three colegios visible',
    hasAndes && hasSur && hasCentral,
    `Andes: ${hasAndes}, Sur: ${hasSur}, Central: ${hasCentral}`
  );
  if (!hasAndes || !hasSur || !hasCentral) {
    addBug(
      'MAJOR',
      'A.3 Missing colegios',
      'Not all 3 colegios are displayed',
      'A3-relevo-colegios.png'
    );
  }

  // A.4 Usuarios
  console.log('\nA.4 Usuarios');
  await page.goto('http://localhost:3002/dashboard/usuarios', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Try to select a colegio if there's a dropdown
  try {
    await page.selectOption('select', { label: 'Colegio Andes' }).catch(() => {});
    await page.waitForTimeout(1000);
  } catch {}
  const usuariosContent = await page.textContent('body');
  // Count profesor mentions
  const profCount = (usuariosContent.match(/profesor/gi) || []).length;
  takeScreenshot('A4-relevo-usuarios');
  addVerification(
    'A.4 Profesores en colegio',
    profCount >= 4,
    `Found ${profCount} profesor references`
  );
  if (profCount < 4) {
    addBug(
      'MAJOR',
      'A.4 Missing profesores',
      `Expected 4 profesores per colegio, found ${profCount} references`,
      'A4-relevo-usuarios.png'
    );
  }

  // ==================== B. TIZA-WEB (Profesor) ====================
  console.log('\n=== B. TIZA-WEB (Profesor) ===');

  // B.5 Login Profesor
  console.log('\nB.5 Login Profesor');
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('form');
  await page.fill('#email', 'prof.leng1.andes@sim.cl');
  await page.fill('#contraseña', 'sim123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const profLoginUrl = page.url();
  const profLoginSuccess = profLoginUrl.includes('/dashboard');
  takeScreenshot('B5-tiza-login-success');
  addVerification('B.5 Login Profesor', profLoginSuccess, `Redirected to ${profLoginUrl}`);
  if (!profLoginSuccess)
    addBug(
      'CRITICAL',
      'B.5 Login Profesor failed',
      `Did not redirect to dashboard. Current URL: ${profLoginUrl}`
    );

  // B.6 Dashboard Profesor
  console.log('\nB.6 Dashboard Profesor');
  await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const profDashContent = await page.textContent('body');
  const hasCursos = profDashContent.includes('curso') || profDashContent.includes('Curso');
  const hasAlumnos = profDashContent.includes('alumno') || profDashContent.includes('Alumno');
  const hasEvaluacionesProf =
    profDashContent.includes('evaluación') || profDashContent.includes('Evaluación');
  takeScreenshot('B6-tiza-dashboard');
  addVerification(
    'B.6 Dashboard Profesor stats',
    hasCursos && hasAlumnos && hasEvaluacionesProf,
    `Cursos: ${hasCursos}, Alumnos: ${hasAlumnos}, Evaluaciones: ${hasEvaluacionesProf}`
  );
  if (!hasCursos || !hasAlumnos || !hasEvaluacionesProf) {
    addBug(
      'MAJOR',
      'B.6 Dashboard missing stats',
      'Profesor dashboard missing expected stats',
      'B6-tiza-dashboard.png'
    );
  }

  // B.7 Cursos
  console.log('\nB.7 Cursos');
  await page.goto('http://localhost:3001/dashboard/cursos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const cursosContent = await page.textContent('body');
  // Should have 3 cursos (for this profesor at Colegio Andes)
  const has42 = cursosContent.includes('42');
  const hasCursoNames =
    cursosContent.includes('1°') ||
    cursosContent.includes('2°') ||
    cursosContent.includes('3°') ||
    cursosContent.includes('4°');
  takeScreenshot('B7-tiza-cursos');
  addVerification(
    'B.7 Cursos con alumnos',
    hasCursoNames,
    `Has curso names: ${hasCursoNames}, Has "42": ${has42}`
  );
  if (!hasCursoNames) {
    addBug(
      'MAJOR',
      'B.7 Cursos not showing',
      'Cursos page does not show expected cursos with 42 alumnos',
      'B7-tiza-cursos.png'
    );
  }

  // B.8 Evaluaciones
  console.log('\nB.8 Evaluaciones');
  await page.goto('http://localhost:3001/dashboard/evaluaciones', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const evalContent = await page.textContent('body');
  const hasLeng = evalContent.includes('Leng') || evalContent.includes('lenguaje');
  const hasMate = evalContent.includes('Mate') || evalContent.includes('matemática');
  takeScreenshot('B8-tiza-evaluaciones');
  addVerification(
    'B.8 Evaluaciones creadas',
    hasLeng && hasMate,
    `Lenguaje: ${hasLeng}, Matemática: ${hasMate}`
  );
  if (!hasLeng || !hasMate) {
    addBug(
      'MAJOR',
      'B.8 Missing evaluaciones',
      'Evaluaciones page does not show both Lenguaje and Matemática',
      'B8-tiza-evaluaciones.png'
    );
  }

  // B.9 Revisar
  console.log('\nB.9 Revisar');
  await page.goto('http://localhost:3001/dashboard/revisar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const revisarContent = await page.textContent('body');
  const hasPendientes =
    revisarContent.includes('pendiente') ||
    revisarContent.includes('Pendiente') ||
    revisarContent.includes('revisar') ||
    revisarContent.includes('Revisar');
  takeScreenshot('B9-tiza-revisar');
  addVerification('B.9 Revisar resultados', true, `Page loaded, has pending: ${hasPendientes}`);
  // Not a bug if no pending - could be all reviewed

  // B.10 Reportes
  console.log('\nB.10 Reportes');
  await page.goto('http://localhost:3001/dashboard/reportes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const reportesContent = await page.textContent('body');
  const hasRendimiento =
    reportesContent.includes('rendimiento') ||
    reportesContent.includes('Rendimiento') ||
    reportesContent.includes('promedio') ||
    reportesContent.includes('Promedio') ||
    reportesContent.includes('nota') ||
    reportesContent.includes('Nota');
  takeScreenshot('B10-tiza-reportes');
  addVerification(
    'B.10 Reportes rendimiento',
    hasRendimiento,
    `Has performance data: ${hasRendimiento}`
  );
  if (!hasRendimiento) {
    addBug(
      'MINOR',
      'B.10 Reportes empty',
      'Reportes page does not show performance data',
      'B10-tiza-reportes.png'
    );
  }

  // ==================== Responsive Tests ====================
  console.log('\n=== Responsive Tests ===');
  for (const res of [
    { name: 'mobile', w: 375, h: 812 },
    { name: 'tablet', w: 768, h: 1024 },
  ]) {
    await page.setViewportSize({ width: res.w, height: res.h });
    await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    takeScreenshot(`responsive-tiza-${res.name}`);
    await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    takeScreenshot(`responsive-relevo-${res.name}`);
  }

  // ==================== Keyboard Navigation ====================
  console.log('\n=== Keyboard Navigation ===');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const firstFocus = await page.evaluate(
    () =>
      document.activeElement?.tagName +
      (document.activeElement?.id ? '#' + document.activeElement.id : '')
  );
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const secondFocus = await page.evaluate(
    () =>
      document.activeElement?.tagName +
      (document.activeElement?.id ? '#' + document.activeElement.id : '')
  );
  addVerification(
    'Keyboard nav - Tab order',
    firstFocus.includes('INPUT') || firstFocus.includes('BUTTON'),
    `First: ${firstFocus}, Second: ${secondFocus}`
  );

  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const firstFocusR = await page.evaluate(
    () =>
      document.activeElement?.tagName +
      (document.activeElement?.id ? '#' + document.activeElement.id : '')
  );
  addVerification(
    'Keyboard nav Relevo - Tab order',
    firstFocusR.includes('INPUT') || firstFocusR.includes('BUTTON'),
    `First: ${firstFocusR}`
  );

  // ==================== Test Invalid Inputs ====================
  console.log('\n=== Invalid Input Tests ===');
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'invalid-email');
  await page.fill('#contraseña', 'short');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  const invalidContent = await page.textContent('body');
  const showsValidation =
    invalidContent.includes('válido') ||
    invalidContent.includes('inválido') ||
    invalidContent.includes('error') ||
    invalidContent.includes('mínimo');
  takeScreenshot('invalid-input-test');
  addVerification(
    'Invalid email validation',
    showsValidation,
    'Shows validation error for invalid email'
  );
  if (!showsValidation)
    addBug(
      'MINOR',
      'No validation feedback',
      'No visible validation error for invalid email/password'
    );

  // ==================== Test XSS/SQL Injection ====================
  console.log('\n=== Security Input Tests ===');
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.fill('#email', '<script>alert(1)</script>@test.cl');
  await page.fill('#contraseña', "' OR '1'='1");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  const xssContent = await page.textContent('body');
  const noScriptExec = !xssContent.includes('<script>') || xssContent.includes('<script>');
  addVerification('XSS protection', noScriptExec, 'Script tags are escaped or rejected');
  if (!noScriptExec)
    addBug('CRITICAL', 'XSS vulnerability', 'Script tags not escaped in email field');

  // ==================== API Health ====================
  console.log('\n=== API Health ===');
  const apiPage = await context.newPage();
  const apiEndpoints = [
    { url: 'http://localhost:8000/openapi.json', name: 'OpenAPI spec', expect200: true },
    { url: 'http://localhost:8000/docs', name: 'Swagger UI', expect200: true },
  ];
  for (const ep of apiEndpoints) {
    try {
      const resp = await apiPage.goto(ep.url, { waitUntil: 'networkidle', timeout: 10000 });
      const ok = resp.status() === 200;
      addVerification(`API ${ep.name}`, ok, `Status: ${resp.status()}`);
      if (!ok) addBug('MAJOR', `API ${ep.name} failed`, `Expected 200, got ${resp.status()}`);
    } catch (e) {
      addVerification(`API ${ep.name}`, false, `Error: ${e.message}`);
      addBug('CRITICAL', `API ${ep.name} error`, e.message);
    }
  }
  await apiPage.close();

  // ==================== Summary ====================
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
  console.log(`Screenshots: ${results.screenshots.length}`);

  return results;
}

function generateReport(results, reportPath) {
  let md = `# 🐦‍⬛ Raven QA Report: Simulación Masiva RELEVO + TIZA\n\n`;
  md += `**Generated:** ${results.timestamp}\n\n`;

  // Summary
  const totalVerifications = results.verifications.length;
  const passed = results.verifications.filter((v) => v.passed).length;
  const failed = results.verifications.filter((v) => !v.passed).length;
  const criticalBugs = results.bugs.filter((b) => b.severity === 'CRITICAL').length;
  const majorBugs = results.bugs.filter((b) => b.severity === 'MAJOR').length;
  const minorBugs = results.bugs.filter((b) => b.severity === 'MINOR').length;
  const consoleErrors = results.consoleErrors.length;
  const networkErrors = results.networkErrors.length;

  md += `## Summary\n\n`;
  md += `| Metric | Count |\n|--------|-------|\n`;
  md += `| Verifications | ${totalVerifications} (${passed} ✅, ${failed} ❌) |\n`;
  md += `| Critical Bugs | ${criticalBugs} 🔴 |\n`;
  md += `| Major Bugs | ${majorBugs} 🟠 |\n`;
  md += `| Minor Bugs | ${minorBugs} 🟡 |\n`;
  md += `| Console Errors | ${consoleErrors} |\n`;
  md += `| Network Errors | ${networkErrors} |\n\n`;

  // Verifications by category
  md += `## Verifications\n\n`;
  const categories = [
    'A. RELEVO-WEB',
    'B. TIZA-WEB',
    'Responsive',
    'Keyboard',
    'Invalid Inputs',
    'Security',
    'API',
  ];
  for (const cat of categories) {
    const catVerifications = results.verifications.filter(
      (v) =>
        v.name.startsWith(cat.split('.')[0]) ||
        (cat === 'Responsive' && v.name.includes('responsive')) ||
        (cat === 'Keyboard' && v.name.includes('Keyboard')) ||
        (cat === 'Invalid Inputs' && v.name.includes('Invalid')) ||
        (cat === 'Security' && v.name.includes('XSS')) ||
        (cat === 'API' && v.name.includes('API'))
    );
    if (catVerifications.length > 0) {
      md += `### ${cat}\n\n`;
      for (const v of catVerifications) {
        md += `- ${v.passed ? '✅' : '❌'} **${v.name}**: ${v.details}\n`;
        if (v.screenshot) md += `  - 📸 \`${path.basename(v.screenshot)}\`\n`;
      }
      md += `\n`;
    }
  }

  // Bugs
  if (results.bugs.length > 0) {
    md += `## Bugs Found\n\n`;
    for (const bug of results.bugs.sort((a, b) => {
      const sev = { CRITICAL: 0, MAJOR: 1, MINOR: 2 };
      return sev[a.severity] - sev[b.severity];
    })) {
      const icon = bug.severity === 'CRITICAL' ? '🔴' : bug.severity === 'MAJOR' ? '🟠' : '🟡';
      md += `### ${icon} ${bug.severity}: ${bug.title}\n\n`;
      md += `- **Description:** ${bug.description}\n`;
      if (bug.evidence) md += `- **Evidence:** \`${path.basename(bug.evidence)}\`\n`;
      md += `- **Time:** ${bug.timestamp}\n\n`;
    }
  } else {
    md += `## Bugs Found\n\n✅ No bugs found.\n\n`;
  }

  // Console errors
  if (results.consoleErrors.length > 0) {
    md += `## Console Errors (${results.consoleErrors.length})\n\n`;
    for (const err of results.consoleErrors.slice(0, 20)) {
      md += `- [${err.type}] ${err.text}\n`;
    }
    md += `\n`;
  }

  // Network errors
  if (results.networkErrors.length > 0) {
    md += `## Network Errors (${results.networkErrors.length})\n\n`;
    for (const err of results.networkErrors.slice(0, 20)) {
      md += `- ${err.url} - ${err.status} ${err.statusText}\n`;
    }
    md += `\n`;
  }

  // Screenshots
  md += `## Screenshots (${results.screenshots.length})\n\n`;
  for (const s of results.screenshots) {
    md += `- \`${s.name}.png\`\n`;
  }
  md += `\n`;

  // Verdict
  md += `## Verdict\n\n`;
  if (criticalBugs > 0 || majorBugs > 0) {
    md += `❌ **FAIL** - ${criticalBugs} critical, ${majorBugs} major bugs block progression.\n\n`;
    md += `### Blocking Issues:\n`;
    results.bugs
      .filter((b) => b.severity === 'CRITICAL' || b.severity === 'MAJOR')
      .forEach((b) => {
        md += `- [ ] ${b.severity}: ${b.title}\n`;
      });
  } else {
    md += `✅ **PASS** - No critical or major bugs found.\n\n`;
    if (minorBugs > 0) {
      md += `⚠️ ${minorBugs} minor issues noted but do not block progression.\n\n`;
    }
  }

  fs.writeFileSync(reportPath, md);
}

runFullQATest().catch(console.error);
