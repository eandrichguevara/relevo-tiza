## Inquisitor Audit: QA Gate Iteración 2 — Auditoría Forense

### Evidencia Revisada

- Reporte de @raven TIZA: FAIL (6 bugs reportados)
- Reporte de @raven RELEVO: FAIL (4 bugs reportados)
- Reporte de @echo: PASS (89 tests, cobertura 73%)
- Screenshots en qa-results/: 15 archivos PNG
- Código fuente: apps/tiza-web, apps/relevo-web, apps/api
- Coverage data: apps/tiza-web/coverage/, packages/ui/coverage/

### Hallazgo Forense Crítico: Evidencia Fotográfica FRAUDULENTA

Antes de analizar los bugs individuales, debo documentar un hallazgo que invalida la mayor parte de la evidencia presentada por @raven:

**Análisis MD5 de screenshots:**

| Hash MD5      | Archivos (todos idénticos)                                                  | Lo que el reporte CLAIMS mostrar |
| ------------- | --------------------------------------------------------------------------- | -------------------------------- |
| `4187d79b...` | B6-dashboard, B8-evaluaciones, invalid-input-test, responsive-relevo-tablet | 4 páginas diferentes             |
| `84d55bad...` | B5-login-success, B7-cursos, B9-revisar                                     | 3 páginas diferentes             |
| `edae5457...` | A1-login-success, A2-dashboard, A3-colegios                                 | 3 páginas diferentes             |

**Total: 10 de 15 screenshots son imágenes duplicadas que muestran la misma página.**

**Inspección visual de las imágenes:**

- Las imágenes del grupo `4187d79b` muestran la **página de login de TIZA** (no dashboard, no evaluaciones, no invalid-input)
- Las imágenes del grupo `84d55bad` muestran la **página de login de TIZA** (no login-success, no cursos, no revisar)
- Las imágenes del grupo `edae5457` muestran la **página de login de RELEVO sin estilos Tailwind** (raw HTML)
- `A4-relevo-usuarios.png` muestra la **página de login de TIZA** (no la página de usuarios de RELEVO)
- `B10-tiza-reportes.png` muestra la **página de login de TIZA en mobile** (no reportes)

**Conclusión forense**: El test automatizado de @raven NO PUDO LOGUEARSE en ninguna de las dos apps. Todos los screenshots post-login muestran la página de login porque el login falló. Los screenshots están MAL ETIQUETADOS — no muestran lo que el reporte dice que muestran.

**Adicional**: Las screenshots de RELEVO muestran HTML crudo SIN Tailwind CSS, lo que indica que la app no estaba corriendo correctamente o los assets no se cargaron.

---

### Matriz de Cobertura — Análisis Forense del Código

| Bug Reportado                                | Evidencia del Reporte                | Verificación en Código                                                                                                                                               | Veredicto Inquisitor                                       |
| -------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| BUG-001: Cookie cross-port                   | "tiza-auth-token visible en RELEVO"  | Código CORRECTO: TIZA usa `tiza-auth-token`, RELEVO usa `relevo-auth-token`. Limitación de localhost.                                                                | ✅ Confirmado como limitación de entorno, NO bug de código |
| BUG-002: Form submit redirige a puerto wrong | "login/registro redirige a 3002"     | Código CORRECTO: Todos los redirects usan URLs relativas (`/dashboard`, `/login`). El "cross-port" es síntoma de BUG-001.                                            | ✅ Síntoma de BUG-001, no bug independiente                |
| BUG-003: `/api/auth/session` 404             | "404 en todas las páginas dashboard" | **CONFIRMADO**: `cursos/page.tsx`, `cursos/[id]/alumnos/page.tsx`, `cursos/[id]/stats/page.tsx` llaman `fetch('/api/auth/session')` — endpoint NO EXISTE en Next.js. | 🔴 BUG REAL Y CRÍTICO                                      |
| BUG-004: Sidebar no responsive               | "sin hamburger menu en móvil"        | **CONFIRMADO**: `<aside className="w-64">` sin breakpoints. El store tiene `sidebarOpen` pero NO se usa en el layout.                                                | 🟠 BUG REAL                                                |
| BUG-005: Validación email inline ausente     | "ausente"                            | **FALSO**: TIZA login usa `validateEmail` de `@/lib/validators`. RELEVO login tiene `validateEmail` inline.                                                          | ❌ Bug no existe                                           |
| BUG-006: Race condition primer registro      | "race condition"                     | **FALSO**: Backend maneja IntegrityError con retry (auth.py líneas 130-144).                                                                                         | Bug no existe                                              |

---

### Objeciones Encontradas

#### 🔴 Objeción #1: Evidencia fotográfica fraudulenta — Reporte de @raven es inutilizable

**Dimensión**: Integridad de Evidencia
**Severidad**: CRÍTICA — el reporte completo pierde credibilidad 🔴

**Lo que QA reportó**:

> Screenshots etiquetados como "B6-tiza-dashboard.png", "B8-tiza-evaluaciones.png", "A2-relevo-dashboard.png", etc.

**Lo que la evidencia real muestra**:

- 10 de 15 screenshots son imágenes duplicadas (mismo MD5 hash)
- Las imágenes supuestamente de "dashboard", "cursos", "evaluaciones", "reportes" muestran la página de LOGIN
- Las imágenes de RELEVO muestran HTML crudo sin Tailwind CSS
- El test NO pudo loguearse, por lo tanto NINGUNA página post-login fue verificada

**Por qué importa**:
Sin evidencia fotográfica válida, NO podemos confirmar ni refutar NINGUNO de los bugs reportados por @raven excepto los que verificamos directamente en el código. El reporte es esencialmente inútil como evidencia de QA.

**Evidencia requerida en la siguiente iteración**:

- [ ] Screenshots REALES de cada página, con hashes MD5 únicos
- [ ] Evidencia de login exitoso en AMBAS apps (en sesiones de navegador separadas)
- [ ] Screenshots del dashboard de TIZA con datos reales
- [ ] Screenshots del dashboard de RELEVO con datos reales
- [ ] Screenshots mobile (375px) y tablet (768px) de AMBAS apps con estilos Tailwind aplicados

---

#### 🔴 Objeción #2: `/api/auth/session` 404 — Funcionalidad core del dashboard rota

**Dimensión**: Cobertura Funcional
**Severidad**: CRÍTICA — el dashboard de TIZA es inutilizable 🔴

**Lo que QA reportó**:

> BUG-003 (MAYOR): `/api/auth/session` 404 en todas las páginas dashboard

**Lo que el código revela (verificación forense)**:
Los siguientes archivos llaman `fetch('/api/auth/session')` — un endpoint de Next.js API que NO EXISTE:

- `apps/tiza-web/src/app/(dashboard)/dashboard/cursos/page.tsx` (líneas 37, 59, 84)
- `apps/tiza-web/src/app/(dashboard)/dashboard/cursos/[id]/alumnos/page.tsx` (líneas 23, 54, 78)
- `apps/tiza-web/src/app/(dashboard)/dashboard/cursos/[id]/stats/page.tsx` (línea 20)

Estas páginas intentan obtener el token de sesión vía un endpoint NextAuth-style que no fue implementado. El sistema de auth real usa cookies + localStorage, pero estas páginas no fueron actualizadas para usar ese patrón.

**Por qué importa**:
Las páginas de Cursos, Alumnos y Stats del dashboard de TIZA NO PUEDEN funcionar. No pueden obtener el token para hacer llamadas API. Esto significa que la funcionalidad principal del producto (gestión de cursos) está rota.

**Evidencia requerida**:

- [ ] Fix: Reemplazar `fetch('/api/auth/session')` con `getToken()` del módulo `@/lib/auth`
- [ ] Test que verifique que las páginas de cursos cargan datos correctamente
- [ ] Screenshot del dashboard de cursos con datos reales

---

#### 🟠 Objeción #3: Sidebar no responsive — Dashboard inutilizable en móvil

**Dimensión**: UX y Comportamiento de UI (Dimensión 5)
**Severidad**: ALTA — UX degradada en móvil 🟠

**Lo que QA reportó**:

> BUG-004 (MAYOR): Sidebar no responsive - sin hamburger menu en móvil

**Verificación forense en código**:

- `apps/tiza-web/src/app/(dashboard)/layout.tsx`: `<aside className="w-64 bg-white border-r...">` — ancho fijo, sin `hidden md:block` ni toggle
- `apps/relevo-web/src/app/(dashboard)/layout.tsx`: Mismo patrón — `<aside className="w-64 bg-white...">`
- El store `useAppStore.ts` tiene `sidebarOpen`, `toggleSidebar`, `setSidebarOpen` — pero NUNCA se usan en el layout
- No hay botón hamburger, no hay overlay, no hay breakpoint responsive

**Por qué importa**:
En móvil (375px), el sidebar de 256px (w-64) ocupa ~68% de la pantalla, dejando solo ~119px para el contenido principal. El dashboard es prácticamente inutilizable en móvil.

**Evidencia requerida**:

- [ ] Implementar hamburger menu con toggle del sidebar
- [ ] Sidebar debe ser `hidden md:block` en móvil, mostrarse como overlay al toggle
- [ ] Screenshot mobile con sidebar cerrado y abierto

---

#### 🟠 Objeción #4: RELEVO web sin estilos Tailwind — App visualmente rota

**Dimensión**: Cobertura Funcional / UX
**Severidad**: ALTA — la app no renderiza correctamente 🟠

**Lo que QA reportó**:

> No mencionado explícitamente, pero las screenshots de RELEVO muestran HTML crudo

**Verificación forense**:
Las screenshots de RELEVO (`A1-relevo-login-success.png`, `A2-relevo-dashboard.png`, `A3-relevo-colegios.png`, `A4-relevo-usuarios.png`, `responsive-relevo-mobile.png`, `responsive-relevo-tablet.png`) muestran HTML sin estilos Tailwind. Esto indica que:

1. La app no estaba corriendo correctamente durante el test, O
2. Los assets CSS no se generaron/cargaron, O
3. Hay un problema de configuración de Tailwind en relevo-web

Los network errors del reporte confirman: `404 Not Found` para `_next/static/css/app/layout.css` y `_next/static/chunks/` files.

**Por qué importa**:
Si RELEVO no renderiza con estilos, es inutilizable. Esto podría ser un problema de build o de configuración.

**Evidencia requerida**:

- [ ] Verificar que `tailwind.config.js` existe en relevo-web
- [ ] Verificar que `globals.css` con directivas Tailwind existe
- [ ] Screenshot REAL de RELEVO con estilos aplicados
- [ ] Verificar que el build de relevo-web genera los assets CSS correctamente

---

#### 🟠 Objeción #5: Cobertura de tests insuficiente — Dimensión 8

**Dimensión**: Cobertura de Tests (Dimensión 8)
**Severidad**: ALTA — cobertura muy por debajo del target 🟠

**Lo que Echo reportó**:

> 89 tests pasando, cobertura cayó de 78% → 73%

**Verificación forense de coverage data**:

- **tiza-web**: 64% statements, 54.8% branches, 71.4% functions — TODOS por debajo del 80% target
- Solo 3 archivos cubiertos en tiza-web
- **relevo-web**: NO HAY coverage data — 0 tests frontend
- **packages/ui**: Solo Button.tsx cubierto (100%), pero otros componentes sin tests
- **Backend (API)**: test_auth.py (209 líneas), test_integration.py (1069 líneas), test_security.py (80 líneas), test_duplicate_tenants.py (133 lines) — buena cobertura backend

**Gaps específicos identificados**:

- No hay tests para el hook `useAuth` (ni TIZA ni RELEVO)
- No hay tests para los componentes de login/register pages
- No hay tests para el dashboard layout
- No hay tests para las páginas de cursos, evaluaciones, revisar, reportes
- No hay tests E2E (Playwright) — solo tests unitarios con Vitest
- El endpoint `/api/tenants/lookup` no tiene test directo (solo se usa en el flujo de registro)

**Evidencia requerida**:

- [ ] Tests para `useAuth` hook (login, logout, session restore)
- [ ] Tests para validadores (al menos los no cubiertos)
- [ ] Tests para componentes de UI no cubiertos
- [ ] Al menos 1 test E2E con Playwright que cubra el flujo login → dashboard
- [ ] Cobertura ≥ 80% en código nuevo de tiza-web

---

#### Objeción #6: Validación de inputs — Dimensión 2 parcialmente cubierta

**Dimensión**: Validación de Inputs (Dimensión 2)
**Severidad**: MEDIA — casos borde no verificados 🟡

**Lo que QA reportó**:

> BUG-005 (MENOR): Validación email inline ausente — **FALSO, la validación existe**

**Lo que NO se revisó**:

- Campos vacíos en registro (¿qué pasa si name está vacío?)
- Strings de longitud máxima (¿hay límite en el nombre? ¿en el email?)
- Caracteres especiales en nombre (Unicode, emojis, `<>'"&`)
- SQL injection payloads en email
- XSS payloads en nombre del colegio
- Passwords con caracteres especiales extremos
- Confirm password que no coincide (¿está probado?)

**Evidencia requerida**:

- [ ] Test de campos vacíos en formulario de registro
- [ ] Test de caracteres especiales en nombre
- [ ] Test de XSS payload en campos de texto
- [ ] Test de password mismatch en confirmación

---

#### 🟡 Objeción #7: Estados de carga y error — Dimensión 4 no cubierta

**Dimensión**: Estados de Carga y Error (Dimensión 4)
**Severidad**: MEDIA — UX degradada no verificada

**Lo que QA reportó**:

> No mencionado en el reporte

**Lo que el código revela**:

- Las páginas de dashboard tienen estado `loading` con Spinner ✅
- Pero NO hay manejo de estado de error de red (catch blocks solo hacen `console.error`)
- NO hay estado vacío verificado (¿qué pasa si no hay cursos?)
- NO se probó timeout del backend
- NO se probó backend caído

**Evidencia requerida**:

- [ ] Verificar que el empty state se muestra cuando no hay cursos/evaluaciones
- [ ] Verificar que los errores de red se muestran al usuario (no solo console.error)
- [ ] Test de comportamiento con backend caído

---

#### ⚪ Objeción #8: Dependencia muerta `next-auth` en package.json

**Dimensión**: Integración y Efectos Secundarios (Dimensión 9)
**Severidad**: BAJA — dead dependency ⚪

**Hallazgo**:
Ambos `package.json` (tiza-web y relevo-web) incluyen `"next-auth": "^4.24.0"` como dependencia, pero el código NO usa NextAuth — usa auth custom con JWT + cookies. Esto es dead code que aumenta el bundle size.

**Acción recomendada**: Remover `next-auth` de ambos package.json.

---

### Veredicto de Iteración 2: INSUFICIENTE

**Razones**:

1. **Evidencia fotográfica fraudulenta**: 10 de 15 screenshots son imágenes duplicadas. El reporte de @raven pierde toda credibilidad como evidencia.

2. **Bug CRÍTICO confirmado**: `/api/auth/session` 404 — las páginas de Cursos, Alumnos y Stats del dashboard de TIZA son inutilizables. Este bug NO fue mencionado con la severidad correcta (debería ser CRÍTICO, no MAYOR).

3. **Bug REAL no reportado**: RELEVO web sin estilos Tailwind — la app no renderiza correctamente.

4. **Cobertura de tests insuficiente**: 64% statements en tiza-web (target: 80%), 0% en relevo-web frontend.

5. **Bug-005 y Bug-006 son FALSOS**: La validación email SÍ existe, y el race condition SÍ está manejado en el backend.

---

### Órdenes para la Iteración 3

#### @raven: Re-ejecutar QA manual con las siguientes correcciones:

1. **Usar sesiones de navegador separadas** para TIZA (localhost:3001) y RELEVO (localhost:3002) para evitar la contaminación de cookies de localhost. Esto es una limitación del entorno, no un bug.

2. **Verificar que AMBAS apps tienen Tailwind CSS aplicado** antes de tomar screenshots. Si RELEVO no muestra estilos, reportar esto como bug CRÍTICO de build/configuración.

3. **Capturar screenshots REALES** de cada página post-login. Cada screenshot debe tener un hash MD5 único. No reutilizar imágenes.

4. **Verificar el bug de `/api/auth/session`**: Navegar a `/dashboard/cursos` después de login exitoso y documentar si la página carga datos o muestra error.

5. **Verificar responsive del sidebar**: En móvil (375px), verificar si el sidebar se superpone al contenido o si hay algún mecanismo de toggle.

6. **Probar validación de inputs**: Campos vacíos, caracteres especiales, XSS payloads, password mismatch.

7. **Probar estados de error**: Desconectar el backend y verificar qué muestra la UI.

#### @echo: Agregar tests con los siguientes requisitos:

1. **Tests para el hook `useAuth`** en ambas apps (login, logout, session restore from cookie).

2. **Tests para las páginas de login y registro** (validación client-side, manejo de errores API).

3. **Tests E2E con Playwright**: Al menos 1 flujo completo login → dashboard → navegar a una página.

4. **Aumentar cobertura frontend a ≥ 80%** en tiza-web (actual: 64%).

5. **Tests para relevo-web frontend** (actualmente: 0 tests).

6. **Test de regresión** para el bug de `/api/auth/session` — verificar que las páginas de cursos usan `getToken()` en vez de `fetch('/api/auth/session')`.

---

### Estadísticas de la Auditoría

- **Iteración actual**: 2
- **Objeciones levantadas**: 8 (3 CRÍTICAS, 3 ALTAS, 2 MEDIAS, 1 BAJA)
- **Bugs confirmados como reales**: 2 (session 404, sidebar responsive)
- **Bugs confirmados como falsos**: 2 (validación email, race condition)
- **Bugs reclasificados**: 2 (cookie cross-port → limitación de entorno, form redirect → síntoma de cookie)
- **Bugs no verificados por evidencia fraudulenta**: 6 (todos los de dashboard/datos)
- **Evidencia fotográfica válida**: 5 de 15 screenshots (33%)
- **Veredicto**: INSUFICIENTE — se ordena re-ejecución

---

_"La evidencia que no se puede verificar no es evidencia — es ficción. Y la ficción no pasa gates de calidad."_ 🔍
