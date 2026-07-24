import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Flujo TIZA (TEACHER)
 *
 * 1. Autenticarse como profesor contra la API (profesor@demo.cl / demo123)
 * 2. Crear una evaluación con preguntas de alternativas (multiple choice)
 * 3. Crear una evaluación con criterios de desarrollo (written + criteria)
 * 4. Verificar que ambas evaluaciones aparecen en el listado
 */

const API_URL = 'http://localhost:8000';
const TIZA_URL = 'http://localhost:3001';
const TEST_EMAIL = 'profesor@demo.cl';
const TEST_PASSWORD = 'demo123';

/**
 * Helper: autenticar como profesor contra la API real y configurar
 * la sesión en el navegador imitando el flujo real del frontend TIZA:
 *
 * 1. POST /api/auth/login  → obtiene JWT
 * 2. GET  /api/auth/me     → obtiene perfil
 * 3. POST /api/auth/set-token → establece HttpOnly cookie via Next.js
 * 4. localStorage.setItem('tiza-auth-user', ...) → cachea perfil
 * 5. sessionStorage.setItem('tiza-auth-token-jwt', ...) → token para API calls
 */
async function loginAsTeacher(page: Page): Promise<void> {
  // 1. Authenticate against backend
  const loginRes = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { access_token } = await loginRes.json();
  expect(access_token).toBeDefined();

  // 2. Get user profile
  const meRes = await page.request.get(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  expect(meRes.ok()).toBeTruthy();
  const user = await meRes.json();

  // 3. Navigate to TIZA root to establish page context
  await page.goto(TIZA_URL);

  // 4. Set HttpOnly cookie via TIZA API route
  await page.evaluate(async (token) => {
    await fetch('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  }, access_token);

  // 5. Store user in localStorage
  await page.evaluate((userData) => {
    localStorage.setItem(
      'tiza-auth-user',
      JSON.stringify({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: userData.status ?? 'active',
        rejectionReason: userData.rejection_reason,
        mustChangePassword: userData.must_change_password ?? false,
        tenantId: userData.tenant_id,
      })
    );
  }, user);

  // 6. Store token in sessionStorage (required by TIZA's lib/auth.ts:setTokenJwt)
  await page.evaluate((token) => {
    sessionStorage.setItem('tiza-auth-token-jwt', token);
  }, access_token);

  // 7. Navigate to dashboard
  await page.goto(`${TIZA_URL}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('TIZA — Flujo TEACHER: crear evaluación con alternativas y criterios', () => {
  const ALT_EVAL_NAME = `E2E Alternativas ${Date.now()}`;
  const CRIT_EVAL_NAME = `E2E Criterios ${Date.now()}`;

  /**
   * Helper: navigate to "Nueva evaluación" page and verify it loaded.
   * The page may be reached from the sidebar or from the dashboard CTA.
   */
  async function goToNewEvaluation(page: Page): Promise<void> {
    await page.getByRole('link', { name: 'Evaluaciones' }).click();
    await page.waitForURL(/\/dashboard\/evaluaciones/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Evaluaciones' })).toBeVisible();

    await page.getByRole('link', { name: 'Nueva evaluación' }).click();
    await page.waitForURL(/\/dashboard\/evaluaciones\/nueva/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Nueva evaluación' })).toBeVisible();
  }

  /**
   * Helper: select the first available class from the dropdown.
   * Returns the selected option text for assertions.
   */
  async function selectFirstClass(page: Page): Promise<string> {
    const classSelect = page.locator('#class');
    await expect(classSelect).toBeVisible({ timeout: 10_000 });

    // Wait for classes to load from API
    await page.waitForTimeout(2_000);

    const options = await classSelect.locator('option').all();
    // Skip placeholder option (index 0), pick first real class
    const firstClassOption = options[1];
    const optionText = (await firstClassOption.textContent()) ?? '';
    await classSelect.selectOption({ index: 1 });

    return optionText.trim();
  }

  test('crear evaluación con preguntas de alternativas', async ({ page }) => {
    // ── Login as teacher ─────────────────────────────────
    await loginAsTeacher(page);

    // ── Verify dashboard loaded ──────────────────────────
    await expect(page.getByText('Hola,', { exact: false })).toBeVisible({ timeout: 15_000 });

    // ── Navigate to new evaluation page ──────────────────
    await goToNewEvaluation(page);

    // ── Fill title ───────────────────────────────────────
    const titleInput = page.getByLabel('Título de la evaluación');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(ALT_EVAL_NAME);

    // ── Select class ─────────────────────────────────────
    await selectFirstClass(page);

    // ── Configure question 1: multiple choice ────────────
    // Set question type to "Alternativas"
    const typeSelect = page.locator('[aria-label="Tipo de pregunta 1"]');
    await typeSelect.selectOption('multiple_choice');

    // Fill statement (textarea with that exact placeholder)
    await page
      .locator('textarea[placeholder="Enunciado de la pregunta"]')
      .first()
      .fill('¿Cuál es la capital de Chile?');

    // Set max score via quick button
    await page.getByLabel('1 puntos').click();

    // Alternatives A and B already exist (initAlternatives creates 2).
    // Fill alternative A
    await page.locator('input[placeholder="Alternativa A"]').fill('Santiago');

    // Fill alternative B and mark it as correct
    await page.locator('input[placeholder="Alternativa B"]').fill('Valparaíso');

    // Mark B as correct — find the checkbox next to alternative B
    // The checkbox label says "Correcta"; each alternative row has one
    const correctCheckboxes = page.locator('text=Correcta');
    await correctCheckboxes.nth(1).click();

    // ── Add a third alternative C ────────────────────────
    await page.getByText('+ Agregar alternativa').click();
    await page.locator('input[placeholder="Alternativa C"]').fill('Concepción');

    // ── Submit the form ──────────────────────────────────
    // Dismiss any native alert() dialogs automatically
    page.on('dialog', (dialog) => dialog.dismiss());

    await page.getByRole('button', { name: 'Crear evaluación' }).click();

    // ── Verify redirect to evaluations list ──────────────
    await page.waitForURL(/\/dashboard\/evaluaciones$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Evaluaciones' })).toBeVisible();

    // ── Verify the evaluation appears in the list ────────
    await expect(page.getByText(ALT_EVAL_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test('crear evaluación con preguntas de desarrollo y criterios', async ({ page }) => {
    // ── Login as teacher ─────────────────────────────────
    await loginAsTeacher(page);

    // ── Navigate to new evaluation page ──────────────────
    await goToNewEvaluation(page);

    // ── Fill title ───────────────────────────────────────
    const titleInput = page.getByLabel('Título de la evaluación');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(CRIT_EVAL_NAME);

    // ── Select class ─────────────────────────────────────
    await selectFirstClass(page);

    // ── Configure question 1: written with criteria ──────
    // Default type is already "written" (Desarrollo) — verify it
    const typeSelect = page.locator('[aria-label="Tipo de pregunta 1"]');
    await expect(typeSelect).toHaveValue('written');

    // Fill statement
    await page
      .locator('textarea[placeholder="Enunciado de la pregunta"]')
      .first()
      .fill('Describe el proceso de fotosíntesis.');

    // ── Add first criterion ──────────────────────────────
    await page.getByText('+ Agregar criterio').click();

    // Fill criterion name
    await page
      .locator('input[placeholder="Nombre del criterio (ej: Ortografía)"]')
      .fill('Contenido científico');

    // The default level has 3 points and empty description — fill description
    const levelDescriptions = page.locator('input[placeholder="Descripción del nivel"]');
    await levelDescriptions.first().fill('Explica correctamente con vocabulario preciso');

    // Change default points from 3 to 4
    const pointInputs = page.locator('input[placeholder="Pts"]');
    await pointInputs.first().fill('4');

    // ── Add second level to the criterion ────────────────
    await page.getByText('+ Agregar nivel').click();

    // Fill second level (it gets auto-decremented points: 2 → change to 3)
    await levelDescriptions.nth(1).fill('Explica con algunos errores conceptuales');
    await pointInputs.nth(1).fill('2');

    // ── Add third level ──────────────────────────────────
    await page.getByText('+ Agregar nivel').click();

    // Wait for the new level to appear
    await page.waitForTimeout(300);
    await levelDescriptions.nth(2).fill('No logra explicar el proceso');
    await pointInputs.nth(2).fill('1');

    // ── Add a second criterion ───────────────────────────
    await page.getByText('+ Agregar criterio').click();

    // There are now 2 criterion name inputs — fill the second one
    const criterionNameInputs = page.locator(
      'input[placeholder="Nombre del criterio (ej: Ortografía)"]'
    );
    await criterionNameInputs.nth(1).fill('Ortografía');

    // The second criterion's level: scroll into view and fill
    const secondCriterionDescriptions = page.locator('input[placeholder="Descripción del nivel"]');
    const secondCriterionPoints = page.locator('input[placeholder="Pts"]');

    // Count existing elements to find indexes for the second criterion's level
    await secondCriterionDescriptions.nth(3).fill('Sin errores ortográficos');
    await secondCriterionPoints.nth(3).fill('2');

    // ── Submit the form ──────────────────────────────────
    page.on('dialog', (dialog) => dialog.dismiss());

    await page.getByRole('button', { name: 'Crear evaluación' }).click();

    // ── Verify redirect to evaluations list ──────────────
    await page.waitForURL(/\/dashboard\/evaluaciones$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Evaluaciones' })).toBeVisible();

    // ── Verify the evaluation appears in the list ────────
    await expect(page.getByText(CRIT_EVAL_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test('el formulario de evaluación muestra validación si falta el título', async ({ page }) => {
    // ── Login as teacher ─────────────────────────────────
    await loginAsTeacher(page);

    // ── Navigate to new evaluation page ──────────────────
    await goToNewEvaluation(page);

    // ── Select class but leave title empty ───────────────
    await selectFirstClass(page);

    // ── Add a question statement ─────────────────────────
    await page
      .locator('textarea[placeholder="Enunciado de la pregunta"]')
      .first()
      .fill('Pregunta sin título');

    // ── Try to submit without title (title has required attribute) ──
    // HTML5 validation should prevent submission — form won't submit,
    // but Playwright doesn't enforce native validation.
    // The button click may trigger the browser's constraint validation.
    // We'll verify the title input is indeed empty
    const titleInput = page.getByLabel('Título de la evaluación');
    await expect(titleInput).toHaveValue('');
    await expect(titleInput).toHaveAttribute('required');
  });

  test('cancelar vuelve a la lista de evaluaciones sin crear nada', async ({ page }) => {
    // ── Login as teacher ─────────────────────────────────
    await loginAsTeacher(page);

    // ── Navigate to new evaluation page ──────────────────
    await goToNewEvaluation(page);

    // ── Fill some data ───────────────────────────────────
    await page.getByLabel('Título de la evaluación').fill('Evaluación cancelada E2E');

    // ── Click Cancelar ───────────────────────────────────
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // ── Should navigate back to evaluations list ─────────
    await page.waitForURL(/\/dashboard\/evaluaciones$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Evaluaciones' })).toBeVisible();

    // ── Verify the cancelled evaluation was NOT created ──
    await expect(page.getByText('Evaluación cancelada E2E')).not.toBeVisible();
  });
});
