# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-dashboard-create-course.spec.ts >> RELEVO — Flujo HOLDER: login → dashboard → crear curso >> login vía API y llegar al dashboard con sesión
- Location: e2e/login-dashboard-create-course.spec.ts:81:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Cerrar sesión')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Cerrar sesión')

```

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * E2E: Flujo completo RELEVO (HOLDER)
  5   |  *
  6   |  * 1. Autenticarse contra la API (director@demo.cl / demo123 — HOLDER)
  7   |  * 2. Verificar redirección al dashboard
  8   |  * 3. Navegar a Cursos
  9   |  * 4. Seleccionar colegio "Colegio Demo"
  10  |  * 5. Crear un nuevo curso
  11  |  * 6. Verificar que el curso aparece en la lista
  12  |  */
  13  | 
  14  | const API_URL = 'http://localhost:8000';
  15  | const TEST_EMAIL = 'director@demo.cl';
  16  | const TEST_PASSWORD = 'demo123';
  17  | 
  18  | /**
  19  |  * Helper: autenticar contra la API real y configurar la sesión
  20  |  * en el navegador imitando el flujo real del frontend:
  21  |  *
  22  |  * 1. POST /api/auth/login  → obtiene JWT
  23  |  * 2. POST /api/auth/me     → obtiene perfil
  24  |  * 3. POST /api/auth/set-token → establece HttpOnly cookie via Next.js
  25  |  * 4. localStorage.setItem('relevo-auth-user', ...) → cachea perfil
  26  |  */
  27  | async function loginViaApi(page: Page): Promise<void> {
  28  |   // 1. Autenticar contra el backend
  29  |   const loginRes = await page.request.post(`${API_URL}/api/auth/login`, {
  30  |     data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  31  |     headers: { 'Content-Type': 'application/json' },
  32  |   });
  33  |   expect(loginRes.ok()).toBeTruthy();
  34  |   const { access_token } = await loginRes.json();
  35  |   expect(access_token).toBeDefined();
  36  | 
  37  |   // 2. Obtener perfil de usuario
  38  |   const meRes = await page.request.get(`${API_URL}/api/auth/me`, {
  39  |     headers: { Authorization: `Bearer ${access_token}` },
  40  |   });
  41  |   expect(meRes.ok()).toBeTruthy();
  42  |   const user = await meRes.json();
  43  | 
  44  |   // 3. Navegar a la raíz para tener un contexto de página
  45  |   await page.goto('/');
  46  | 
  47  |   // 4. Imitar el flujo real: POST a set-token (Next.js API route)
  48  |   //    Esto establece la HttpOnly cookie correctamente
  49  |   await page.evaluate(async (token) => {
  50  |     await fetch('/api/auth/set-token', {
  51  |       method: 'POST',
  52  |       headers: { 'Content-Type': 'application/json' },
  53  |       body: JSON.stringify({ token }),
  54  |     });
  55  |   }, access_token);
  56  | 
  57  |   // 5. Guardar usuario en localStorage (igual que el login real)
  58  |   await page.evaluate((userData) => {
  59  |     localStorage.setItem(
  60  |       'relevo-auth-user',
  61  |       JSON.stringify({
  62  |         id: userData.id,
  63  |         email: userData.email,
  64  |         name: userData.name,
  65  |         role: userData.role,
  66  |         status: userData.status ?? 'active',
  67  |         rejectionReason: userData.rejection_reason,
  68  |         tenantId: userData.tenant_id,
  69  |       })
  70  |     );
  71  |   }, user);
  72  | 
  73  |   // 6. Ahora navegar al dashboard — la sesión está completa
  74  |   await page.goto('/dashboard');
  75  |   await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  76  | }
  77  | 
  78  | test.describe('RELEVO — Flujo HOLDER: login → dashboard → crear curso', () => {
  79  |   const COURSE_NAME = `E2E Test Course ${Date.now()}`;
  80  | 
  81  |   test('login vía API y llegar al dashboard con sesión', async ({ page }) => {
  82  |     await loginViaApi(page);
  83  | 
  84  |     // Verificar que estamos en el dashboard con la UI cargada
  85  |     await expect(page.getByText('Dashboard ejecutivo')).toBeVisible({ timeout: 15_000 });
  86  | 
  87  |     // Verificar que los elementos del sidebar están presentes
  88  |     await expect(page.getByRole('link', { name: 'Cursos' })).toBeVisible();
  89  |     await expect(page.getByRole('link', { name: 'Colegios' })).toBeVisible();
> 90  |     await expect(page.getByText('Cerrar sesión')).toBeVisible();
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  91  |   });
  92  | 
  93  |   test('navegar a cursos y crear un nuevo curso', async ({ page }) => {
  94  |     // ── Login vía API ──────────────────────────────────────
  95  |     await loginViaApi(page);
  96  | 
  97  |     // ── Navegar a Cursos ──────────────────────────────────
  98  |     await page.getByRole('link', { name: 'Cursos' }).click();
  99  |     await page.waitForURL(/\/dashboard\/cursos/, { timeout: 15_000 });
  100 |     await expect(page.getByRole('heading', { name: 'Cursos' })).toBeVisible();
  101 | 
  102 |     // ── Seleccionar colegio ───────────────────────────────
  103 |     const tenantSelect = page.locator('#tenant-select');
  104 |     await expect(tenantSelect).toBeVisible({ timeout: 10_000 });
  105 | 
  106 |     // Esperar a que carguen los tenants desde la API
  107 |     await page.waitForTimeout(2_000);
  108 | 
  109 |     // Seleccionar "Colegio Demo"
  110 |     await tenantSelect.selectOption({ label: 'Colegio Demo' });
  111 | 
  112 |     // Esperar a que se carguen los cursos (o el empty state)
  113 |     await page.waitForTimeout(2_000);
  114 | 
  115 |     // ── Abrir modal de nuevo curso ────────────────────────
  116 |     // Puede ser "Nuevo curso" (botón header) o "Crear curso" (botón empty state)
  117 |     const nuevoCursoBtn = page.getByRole('button', { name: /Nuevo curso|Crear curso/ });
  118 |     await expect(nuevoCursoBtn).toBeVisible({ timeout: 10_000 });
  119 |     await nuevoCursoBtn.click();
  120 | 
  121 |     // ── Llenar el formulario del modal ────────────────────
  122 |     await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  123 |     await expect(page.getByText('Nuevo curso')).toBeVisible();
  124 | 
  125 |     // Nombre del curso
  126 |     const nameInput = page.getByLabel('Nombre del curso');
  127 |     await expect(nameInput).toBeVisible();
  128 |     await nameInput.fill(COURSE_NAME);
  129 | 
  130 |     // Seleccionar nivel
  131 |     const gradeSelect = page.locator('#course-grade');
  132 |     await expect(gradeSelect).toBeVisible();
  133 |     await gradeSelect.selectOption('1° básico');
  134 | 
  135 |     // Asignaturas: "Lenguaje" y "Matemáticas" vienen pre-seleccionadas
  136 |     await expect(page.getByLabel('Lenguaje')).toBeChecked();
  137 |     await expect(page.getByLabel('Matemáticas')).toBeChecked();
  138 | 
  139 |     // ── Seleccionar profesores para cada asignatura ───────
  140 |     const teacherLenguaje = page.locator('#course-teacher-Lenguaje');
  141 |     const teacherMatematicas = page.locator('#course-teacher-Matemáticas');
  142 | 
  143 |     // Intentar seleccionar el primer profesor disponible
  144 |     const teacherLenguajeOptions = await teacherLenguaje.locator('option').all();
  145 |     if (teacherLenguajeOptions.length > 1) {
  146 |       await teacherLenguaje.selectOption({ index: 1 });
  147 |     }
  148 | 
  149 |     const teacherMatematicasOptions = await teacherMatematicas.locator('option').all();
  150 |     if (teacherMatematicasOptions.length > 1) {
  151 |       await teacherMatematicas.selectOption({ index: 1 });
  152 |     }
  153 | 
  154 |     // ── Enviar formulario ─────────────────────────────────
  155 |     await page.getByRole('button', { name: 'Crear curso' }).click();
  156 | 
  157 |     // ── Verificar que el curso se creó ────────────────────
  158 |     // El modal se cierra
  159 |     await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
  160 | 
  161 |     // Verificar toast de éxito (tiene role="alert")
  162 |     const toast = page.getByRole('alert');
  163 |     await expect(toast).toBeVisible({ timeout: 10_000 });
  164 |     await expect(toast).toContainText(/Curso.*creado exitosamente/);
  165 | 
  166 |     // ── Verificar que el curso aparece en la lista ────────
  167 |     await expect(page.getByText(COURSE_NAME)).toBeVisible({ timeout: 10_000 });
  168 |   });
  169 | 
  170 |   test('el modal de crear curso se cierra al cancelar', async ({ page }) => {
  171 |     await loginViaApi(page);
  172 | 
  173 |     // ── Navegar a Cursos ─────────────────────────────────
  174 |     await page.getByRole('link', { name: 'Cursos' }).click();
  175 |     await page.waitForURL(/\/dashboard\/cursos/, { timeout: 15_000 });
  176 | 
  177 |     // Seleccionar colegio
  178 |     const tenantSelect = page.locator('#tenant-select');
  179 |     await expect(tenantSelect).toBeVisible({ timeout: 10_000 });
  180 |     await page.waitForTimeout(2_000);
  181 |     await tenantSelect.selectOption({ label: 'Colegio Demo' });
  182 |     await page.waitForTimeout(1_000);
  183 | 
  184 |     // Abrir modal
  185 |     await page.getByRole('button', { name: /Nuevo curso|Crear curso/ }).click();
  186 |     await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  187 | 
  188 |     // Cancelar
  189 |     await page.getByRole('button', { name: 'Cancelar' }).click();
  190 |     await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
```