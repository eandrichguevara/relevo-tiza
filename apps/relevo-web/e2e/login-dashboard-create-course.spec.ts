import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Flujo completo RELEVO (GESTION)
 *
 * 1. Autenticarse contra la API (director@demo.cl / demo123 — GESTION)
 * 2. Verificar redirección al dashboard
 * 3. Navegar a Cursos
 * 4. Seleccionar colegio "Colegio Demo"
 * 5. Crear un nuevo curso
 * 6. Verificar que el curso aparece en la lista
 */

const API_URL = 'http://localhost:8000';
const TEST_EMAIL = 'director@demo.cl';
const TEST_PASSWORD = 'demo123';

/**
 * Helper: autenticar contra la API real y configurar la sesión
 * en el navegador imitando el flujo real del frontend:
 *
 * 1. POST /api/auth/login  → obtiene JWT
 * 2. POST /api/auth/me     → obtiene perfil
 * 3. POST /api/auth/set-token → establece HttpOnly cookie via Next.js
 * 4. localStorage.setItem('relevo-auth-user', ...) → cachea perfil
 */
async function loginViaApi(page: Page): Promise<void> {
  // 1. Autenticar contra el backend
  const loginRes = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { access_token } = await loginRes.json();
  expect(access_token).toBeDefined();

  // 2. Obtener perfil de usuario
  const meRes = await page.request.get(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  expect(meRes.ok()).toBeTruthy();
  const user = await meRes.json();

  // 3. Navegar a la raíz para tener un contexto de página
  await page.goto('/');

  // 4. Imitar el flujo real: POST a set-token (Next.js API route)
  //    Esto establece la HttpOnly cookie correctamente
  await page.evaluate(async (token) => {
    await fetch('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  }, access_token);

  // 5. Guardar usuario en localStorage (igual que el login real)
  await page.evaluate((userData) => {
    localStorage.setItem(
      'relevo-auth-user',
      JSON.stringify({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: userData.status ?? 'active',
        rejectionReason: userData.rejection_reason,
        tenantId: userData.tenant_id,
      })
    );
  }, user);

  // 6. Ahora navegar al dashboard — la sesión está completa
  await page.goto('/dashboard');
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('RELEVO — Flujo GESTION: login → dashboard → crear curso', () => {
  const COURSE_NAME = `E2E Test Course ${Date.now()}`;

  test('login vía API y llegar al dashboard con sesión', async ({ page }) => {
    await loginViaApi(page);

    // Verificar que estamos en el dashboard con la UI cargada
    await expect(page.getByText('Dashboard ejecutivo')).toBeVisible({ timeout: 15_000 });

    // Verificar que los elementos del sidebar están presentes
    await expect(page.getByRole('link', { name: 'Cursos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Colegios' })).toBeVisible();
    await expect(page.getByText('Cerrar sesión')).toBeVisible();
  });

  test('navegar a cursos y crear un nuevo curso', async ({ page }) => {
    // ── Login vía API ──────────────────────────────────────
    await loginViaApi(page);

    // ── Navegar a Cursos ──────────────────────────────────
    await page.getByRole('link', { name: 'Cursos' }).click();
    await page.waitForURL(/\/dashboard\/cursos/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Cursos' })).toBeVisible();

    // ── Seleccionar colegio ───────────────────────────────
    const tenantSelect = page.locator('#tenant-select');
    await expect(tenantSelect).toBeVisible({ timeout: 10_000 });

    // Esperar a que carguen los tenants desde la API
    await page.waitForTimeout(2_000);

    // Seleccionar "Colegio Demo"
    await tenantSelect.selectOption({ label: 'Colegio Demo' });

    // Esperar a que se carguen los cursos (o el empty state)
    await page.waitForTimeout(2_000);

    // ── Abrir modal de nuevo curso ────────────────────────
    // Puede ser "Nuevo curso" (botón header) o "Crear curso" (botón empty state)
    const nuevoCursoBtn = page.getByRole('button', { name: /Nuevo curso|Crear curso/ });
    await expect(nuevoCursoBtn).toBeVisible({ timeout: 10_000 });
    await nuevoCursoBtn.click();

    // ── Llenar el formulario del modal ────────────────────
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Nuevo curso')).toBeVisible();

    // Nombre del curso
    const nameInput = page.getByLabel('Nombre del curso');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(COURSE_NAME);

    // Seleccionar nivel
    const gradeSelect = page.locator('#course-grade');
    await expect(gradeSelect).toBeVisible();
    await gradeSelect.selectOption('1° básico');

    // Asignaturas: "Lenguaje" y "Matemáticas" vienen pre-seleccionadas
    await expect(page.getByLabel('Lenguaje')).toBeChecked();
    await expect(page.getByLabel('Matemáticas')).toBeChecked();

    // ── Seleccionar profesores para cada asignatura ───────
    const teacherLenguaje = page.locator('#course-teacher-Lenguaje');
    const teacherMatematicas = page.locator('#course-teacher-Matemáticas');

    // Intentar seleccionar el primer profesor disponible
    const teacherLenguajeOptions = await teacherLenguaje.locator('option').all();
    if (teacherLenguajeOptions.length > 1) {
      await teacherLenguaje.selectOption({ index: 1 });
    }

    const teacherMatematicasOptions = await teacherMatematicas.locator('option').all();
    if (teacherMatematicasOptions.length > 1) {
      await teacherMatematicas.selectOption({ index: 1 });
    }

    // ── Enviar formulario ─────────────────────────────────
    await page.getByRole('button', { name: 'Crear curso' }).click();

    // ── Verificar que el curso se creó ────────────────────
    // El modal se cierra
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

    // Verificar toast de éxito (tiene role="alert")
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await expect(toast).toContainText(/Curso.*creado exitosamente/);

    // ── Verificar que el curso aparece en la lista ────────
    await expect(page.getByText(COURSE_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test('el modal de crear curso se cierra al cancelar', async ({ page }) => {
    await loginViaApi(page);

    // ── Navegar a Cursos ─────────────────────────────────
    await page.getByRole('link', { name: 'Cursos' }).click();
    await page.waitForURL(/\/dashboard\/cursos/, { timeout: 15_000 });

    // Seleccionar colegio
    const tenantSelect = page.locator('#tenant-select');
    await expect(tenantSelect).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);
    await tenantSelect.selectOption({ label: 'Colegio Demo' });
    await page.waitForTimeout(1_000);

    // Abrir modal
    await page.getByRole('button', { name: /Nuevo curso|Crear curso/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Cancelar
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('login fallido desde la UI muestra error', async ({ page }) => {
    await page.goto('/login');

    // Usar un password que pase validación client-side (8+ chars)
    await page.getByLabel('Email').fill('director@demo.cl');
    await page.getByLabel('Contraseña').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // Esperar mensaje de error del backend
    await expect(page.getByText(/Credenciales incorrectas/)).toBeVisible({ timeout: 15_000 });
  });
});
