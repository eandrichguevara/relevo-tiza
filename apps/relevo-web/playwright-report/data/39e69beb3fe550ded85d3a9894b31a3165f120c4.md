# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-dashboard-create-course.spec.ts >> RELEVO — Flujo HOLDER: login → dashboard → crear curso >> el modal de crear curso se cierra al cancelar
- Location: e2e/login-dashboard-create-course.spec.ts:170:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Target crashed 
Call log:
  - waiting for getByRole('link', { name: 'Cursos' })
    - locator resolved to <a href="/dashboard/cursos" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100">…</a>
  - attempting click action
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying

```

# Test source

```ts
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
  90  |     await expect(page.getByText('Cerrar sesión')).toBeVisible();
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
> 174 |     await page.getByRole('link', { name: 'Cursos' }).click();
      |                                                      ^ Error: locator.click: Target crashed 
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
  191 |   });
  192 | 
  193 |   test('login fallido desde la UI muestra error', async ({ page }) => {
  194 |     await page.goto('/login');
  195 | 
  196 |     // Usar un password que pase validación client-side (8+ chars)
  197 |     await page.getByLabel('Email').fill('director@demo.cl');
  198 |     await page.getByLabel('Contraseña').fill('wrong-password-123');
  199 |     await page.getByRole('button', { name: 'Ingresar' }).click();
  200 | 
  201 |     // Esperar mensaje de error del backend
  202 |     await expect(page.getByText(/Credenciales incorrectas/)).toBeVisible({ timeout: 15_000 });
  203 |   });
  204 | });
  205 | 
```