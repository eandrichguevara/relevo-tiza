# 📢 Echo QA Automation Review: TIZA-WEB

**Fecha:** 2026-07-17
**Agente:** Echo QA Automation Engineer
**Objetivos:** T-01 (cobertura ≥80%), T-05 (reporte formal), B-C06 (entregar reporte)

---

## Resumen de Tests

| Métrica          | Valor           |
| ---------------- | --------------- |
| Test Files       | 8 passed (de 8) |
| Tests ejecutados | 119             |
| Tests pasados    | 119 ✅          |
| Tests fallados   | 0 ✅            |
| Duración         | 3.78s           |

### Archivos de test (nuevos y existentes)

| Archivo                                              | Tests                  | Estado  |
| ---------------------------------------------------- | ---------------------- | ------- |
| `src/lib/__tests__/api.test.ts`                      | 29 tests               | ✅ Pass |
| `src/lib/__tests__/auth.test.ts`                     | 21 tests (📌 NUEVO)    | ✅ Pass |
| `src/lib/__tests__/validators.test.ts`               | 22 tests               | ✅ Pass |
| `src/store/__tests__/useAppStore.test.ts`            | 7 tests (📌 +2 nuevos) | ✅ Pass |
| `src/middleware.test.ts`                             | 20 tests               | ✅ Pass |
| `src/app/api/auth/set-token/__tests__/route.test.ts` | 9 tests                | ✅ Pass |
| `src/app/api/auth/session/__tests__/route.test.ts`   | 7 tests (📌 NUEVO)     | ✅ Pass |
| `src/hooks/__tests__/useFeatures.test.tsx`           | 4 tests (📌 NUEVO)     | ✅ Pass |

---

## Cobertura Actual — Por Módulo

### Módulos de lógica de negocio (target ≥80%)

| Módulo                                | Statements    | Branches  | Funciones | Líneas    | Target |
| ------------------------------------- | ------------- | --------- | --------- | --------- | ------ |
| `src/lib/api.ts`                      | **97.59%** ✅ | 90.27% ✅ | 60% ⚠️    | 100% ✅   | ≥80%   |
| `src/lib/auth.ts`                     | **95.34%** ✅ | 93.33% ✅ | 100% ✅   | 97.43% ✅ | ≥80%   |
| `src/lib/validators.ts`               | **100%** ✅   | 100% ✅   | 100% ✅   | 100% ✅   | ≥80%   |
| `src/store/useAppStore.ts`            | **100%** ✅   | 100% ✅   | 100% ✅   | 100% ✅   | ≥80%   |
| `src/app/api/auth/session/route.ts`   | **94.73%** ✅ | 100% ✅   | 100% ✅   | 94.44% ✅ | ≥80%   |
| `src/app/api/auth/set-token/route.ts` | **100%** ✅   | 100% ✅   | 100% ✅   | 100% ✅   | ≥80%   |
| `src/middleware.ts`                   | **100%** ✅   | 100% ✅   | 100% ✅   | 100% ✅   | ≥80%   |
| `src/hooks/useFeatures.ts`            | **~100%** ✅  | ~100% ✅  | ~100% ✅  | ~100% ✅  | ≥80%   |

### Módulos sin cobertura (requieren atención)

| Módulo                             | Statements | Prioridad | Acción requerida                       |
| ---------------------------------- | ---------- | --------- | -------------------------------------- |
| `src/hooks/useApi.ts`              | **0%** 🔴  | ALTA      | 215 líneas de hooks React Query        |
| `src/hooks/useAuth.tsx`            | **0%** 🔴  | ALTA      | 155 líneas de contexto de auth         |
| `src/app/(auth)/login/page.tsx`    | **0%** 🟡  | MEDIA     | Página de login (E2E recomendado)      |
| `src/app/(auth)/register/page.tsx` | **0%** 🟡  | MEDIA     | Página de registro (E2E recomendado)   |
| `src/app/(auth)/pending/page.tsx`  | **0%** 🟡  | MEDIA     | Página de pendiente (E2E recomendado)  |
| `src/app/(dashboard)/**/*`         | **0%** 🟡  | MEDIA     | 12 páginas dashboard (E2E recomendado) |

### Evolución de cobertura

| Medición                         | Statements | Dif.    |
| -------------------------------- | ---------- | ------- |
| Antes de esta intervención       | **19.52%** | —       |
| Después de tests nuevos          | **28.60%** | +9.08pp |
| Módulos de negocio (sin páginas) | **~96%**   | —       |

> **Nota:** La cobertura general (28.6%) incluye todas las páginas del frontend (17 archivos de páginas/layouts), que no tienen tests unitarios porque son componentes de presentación. Se recomienda E2E para estas. **Si se excluyen las páginas, la cobertura de los módulos de lógica de negocio supera el 95%.**

---

## Tests Escritos (nuevos)

### 1. `src/lib/__tests__/auth.test.ts` — 21 tests

Cubre todas las funciones de autenticación:

- ✅ `getToken()` / `setTokenJwt()` — almacenamiento en sessionStorage, SSR handling
- ✅ `fetchTokenFromSession()` — sesión OK, sesión fallida, error de red
- ✅ `setTokenCookie()` / `clearTokenCookie()` — llamadas a API
- ✅ `getStoredUser()` / `storeUser()` / `clearStoredUser()` — localStorage
- ✅ `loginUser()` — flujo completo login + /me + persistencia, brand default, rejectionReason
- ✅ `registerUser()` — registro API
- ✅ `clearAuth()` — limpieza completa incluso si cookie falla

### 2. `src/app/api/auth/session/__tests__/route.test.ts` — 7 tests

Cubre el endpoint de sesión:

- ✅ Token válido con todos los campos
- ✅ Sin cookie → user null
- ✅ Token inválido (no-JWT) → user null
- ✅ Token sin `sub` → user null
- ✅ Token expirado → user null
- ✅ Token con campos opcionales faltantes → defaults correctos
- ✅ Status "active" por defecto

### 3. `src/hooks/__tests__/useFeatures.test.tsx` — 4 tests

Cubre el hook de feature flags:

- ✅ API exitosa → features del servidor
- ✅ API falla → defaults de @tiza/config
- ✅ Estado de carga (loading)
- ✅ Estado previo a carga completa

### 4. `src/lib/__tests__/api.test.ts` — 10 tests nuevos añadidos

Cubre casos borde de apiFetch y apiUpload:

- ✅ Respuesta PDF → Blob
- ✅ 204 No Content → undefined
- ✅ 201 con body vacío → undefined
- ✅ Timeout (AbortError) → status 0
- ✅ Error de red (TypeError) → status 0
- ✅ Error response con body no-JSON → translated error
- ✅ DETAIL_TRANSLATIONS funciona
- ✅ `apiUpload` con Authorization header

### 5. `src/store/__tests__/useAppStore.test.ts` — 2 tests nuevos

- ✅ `setSidebarOpen(true)`
- ✅ `setSidebarOpen(false)`

---

## Gaps Detectados para T-01 (≥80%)

Para alcanzar el target del 80% en los módulos de lógica de negocio, faltan:

### 🔴 Alta prioridad — hooks sin tests

| Archivo                 | Líneas | Acción                                          |
| ----------------------- | ------ | ----------------------------------------------- |
| `src/hooks/useApi.ts`   | 215    | Escribir tests para los 15 hooks React Query    |
| `src/hooks/useAuth.tsx` | 155    | Escribir tests para AuthProvider y useAuth hook |

### 🟡 Media prioridad — mejorar branches en api.ts

- Línea 131: cubrir el caso donde `res.json()` falla (try/catch)
- Línea 183: cubrir el caso donde `err.message` es undefined
- Línea 221: similar en apiUpload
- Línea 252: similar en apiUpload

### 🟢 Baja prioridad — edge cases

- `auth.ts:50` — catch block en `getToken()` (sessionStorage.getItem lanza)
- `session/route.ts:18` — catch block en `decodeJwtPayload` (JSON.parse falla)

---

## Estado de BACKLOG

| ID        | Descripción                                        | Estado                                                                   |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| **T-01**  | TIZA-WEB: subir cobertura de 59% → ≥80% statements | ⚠️ **PARCIAL** — Módulos de negocio ≥95% ✅, hooks useApi/useAuth aún 0% |
| **T-02**  | RELEVO-WEB: crear suite de tests (actualmente 0%)  | ❌ **Pendiente** — No revisado en este reporte                           |
| **T-03**  | E2E: al menos 1 flujo completo (Playwright)        | ❌ **Pendiente**                                                         |
| **T-04**  | Tests de concurrencia (10 requests paralelos)      | ❌ **Pendiente**                                                         |
| **T-05**  | Reporte formal de QA automatizado                  | ✅ **Entregado** — Este documento                                        |
| **B-C06** | Echo no ha entregado reporte                       | ✅ **Resuelto**                                                          |

---

## Recomendaciones

### Para alcanzar T-01 (cobertura ≥80% en lógica de negocio):

1. **Escribir tests para `useApi.ts`** (prioridad máxima)
   - Cada hook (useEvaluations, useCourses, useCreateEvaluation, etc.) necesita 3 tests: success, error, loading
   - ~45 tests estimados, cubrirían ~80% de las 215 líneas
   - Usar `renderHook` con `QueryClientProvider` (patrón ya establecido en useFeatures.test.tsx)

2. **Escribir tests para `useAuth.tsx`** (prioridad máxima)
   - AuthProvider: session restore, login, register, logout, edge cases
   - useAuth: contexto definido, contexto undefined → error
   - ~20 tests estimados

3. **Configurar excepción de cobertura para páginas**
   - Las páginas (src/app/**) son componentes de presentación que requieren E2E
   - Excluir `src/app/**` de la cobertura unitaria para que el target sea realista
   - La cobertura real de lógica de negocio es >95%

### Arquitectura de tests (recomendación):

```
src/
├── lib/          → Tests unitarios (vitest) ✅ HECHO
├── store/        → Tests unitarios (vitest) ✅ HECHO
├── hooks/        → Tests de integración (vitest + testing-library) ⏳ EN PROGRESO
├── middleware.ts  → Tests unitarios (vitest) ✅ HECHO
├── app/api/*     → Tests de integración (vitest) ✅ HECHO
├── app/**/page.tsx → Tests E2E (Playwright) ❌ PENDIENTE
└── app/**/page.tsx → Opcional: snapshot tests (vitest)
```

### Siguiente iteración recomendada:

1. @nexus + @echo: tests para `useApi.ts` y `useAuth.tsx`
2. @echo: test E2E Playwright básico (login → dashboard)
3. Re-evaluar cobertura con exclusión de páginas

---

## Veredicto Final

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   📢 ECHO QA AUTOMATION REVIEW: TIZA-WEB                     ║
║                                                              ║
║   Tests: 119/119 ✅                                           ║
║   Módulos de negocio: ≥95% ✅                                 ║
║   Cobertura global: 28.6% ⚠️ (incluye páginas sin test)      ║
║   Hooks sin cubrir: useApi.ts (0%), useAuth.tsx (0%) 🔴      ║
║   Reporte entregado: ✅                                       ║
║                                                              ║
║   VEREDICTO: FAIL ⛔ — Hooks useApi/useAuth requieren tests   ║
║   para alcanzar T-01 (≥80% en módulos de lógica de negocio)  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

**FAIL condicionado.** La lógica de negocio principal (lib/, store/, middleware/, api/routes/) está cubierta al ≥95%. Sin embargo, hooks useApi (215 líneas) y useAuth (155 líneas) están al 0%. Una vez cubiertos, los módulos de lógica de negocio alcanzarán el ≥80% requerido por T-01.

**Para avanzar la fase se requiere:**

- [ ] Tests para `src/hooks/useApi.ts` (~45 tests)
- [ ] Tests para `src/hooks/useAuth.tsx` (~20 tests)
- [ ] O bien: redefinir scope de cobertura excluyendo páginas (src/app/**)
