# Echo QA Automation Report — Backend

**Fecha:** 2026-07-17
**Entorno:** Python 3.14.4, pytest 9.1.1, FastAPI (SQLite test DB)
**Comando:** `pytest tests/ -v --tb=short`

---

## Resumen

| Métrica | Valor |
|---------|-------|
| Total tests recolectados | 129 |
| **Pasados** | **125** ✅ |
| **Fallados** | **4** ❌ |
| **Errores** | **0** |
| Tiempo de ejecución | 66.74s |
| Warnings | 4 (DeprecationWarning) |

## Cobertura de Código

| Módulo | Cobertura |
|--------|-----------|
| **Total (backend)** | **67%** |
| routers/admin.py | 92% |
| routers/auth.py | 88% |
| routers/users.py | 87% |
| routers/tenants.py | 60% |
| utils/security.py | 80% |
| database.py | 81% |
| config.py | 89% |
| middleware/tenant.py | 78% |
| tests/ (suite) | 82-100% |

### Módulos con cobertura baja (< 50%)

| Módulo | Cobertura | Riesgo |
|--------|-----------|--------|
| routers/evaluations.py | 28% | 🔴 Alto |
| routers/results.py | 32% | 🔴 Alto |
| routers/students.py | 30% | 🔴 Alto |
| routers/courses.py | 57% | 🟡 Medio |
| routers/dashboard.py | 48% | 🟡 Medio |
| services/evaluation.py | 50% | 🟡 Medio |
| services/gemini.py | 28% | 🔴 Alto |
| services/pdf.py | 13% | 🔴 Alto |
| services/pipeline.py | 32% | 🔴 Alto |
| services/queue.py | 56% | 🟡 Medio |
| services/storage.py | 57% | 🟡 Medio |
| services/ocr/simulation.py | 36% | 🔴 Alto |
| services/llm/gemini_llm.py | 32% | 🔴 Alto |
| main.py | 42% | 🟡 Medio |
| middleware/brand.py | 0% | 🔴 Crítico |

> **Nota:** La cobertura se calculó con `--cov`, que introduce 15 errores adicionales en fixtures setup (`KeyError: 'id'`) — probablemente por interferencia de instrumentación con la BD asíncrona SQLite. El reporte principal usa la ejecución sin `--cov`.

---

## Resultados por Archivo

### `tests/test_admin.py` — 26 tests → 22 ✅ / 4 ❌ / 0 ⚠️
### `tests/test_auth.py` — 19 tests → 19 ✅ / 0 ❌ / 0 ⚠️
### `tests/test_integration.py` — 41 tests → 41 ✅ / 0 ❌ / 0 ⚠️
### `tests/test_schema_per_tenant.py` — 17 tests → 17 ✅ / 0 ❌ / 0 ⚠️
### `tests/test_security.py` — 7 tests → 7 ✅ / 0 ❌ / 0 ⚠️
### `tests/regression/test_duplicate_tenants.py` — 4 tests → 4 ✅ / 0 ❌ / 0 ⚠️
### `test_auth.py` (standalone) — 1 flow → ❌ (Auth flow: health OK, registration already exists, login failed 401)

---

## Issues Encontrados

### ISSUE #1 — `test_list_pending_requires_admin` — FAIL ❌

**Archivo:** `tests/test_admin.py:186`
**Endpoint:** `GET /api/admin/pending-registrations`
**Token usado:** HOLDER role
**Esperado:** `403 Forbidden`
**Obtenido:** `200 OK`

**Causa raíz:**
El endpoint usa `Depends(require_admin_or_holder)` como dependencia de seguridad (línea 52 de `routers/admin.py`), la cual **permite explícitamente** el rol HOLDER (línea 138 de `utils/security.py`). El código filtra resultados por tenant para HOLDER, pero no lo bloquea.

**Diagnóstico:**
- El test asume que el endpoint es solo para ADMIN (`test_list_pending_requires_admin`)
- Pero la implementación permite HOLDER con scope a su propio tenant
- Dos caminos de corrección:
  - **Opción A (cambiar test):** Renombrar test a `test_list_pending_allows_holder_scoped` y ajustar la aserción a 200
  - **Opción B (cambiar código):** Usar `require_super_admin` en vez de `require_admin_or_holder` si la intención es bloquear HOLDER

**Severidad:** 🟡 Medio — La funcionalidad de scoping funciona, pero el permiso es más permisivo de lo que el test espera.

---

### ISSUE #2 — `test_approve_requires_admin` — FAIL ❌

**Archivo:** `tests/test_admin.py:451`
**Endpoint:** `POST /api/admin/approve/{user_id}`
**UUID usado:** `00000000-0000-0000-0000-000000000000` (no existente)
**Token usado:** HOLDER role
**Esperado:** `403 Forbidden`
**Obtenido:** `404 Not Found` → `{"detail":"Usuario no encontrado."}`

**Causa raíz:**
El código verifica existencia del usuario **antes** de verificar permisos de rol (líneas 129-134 de `routers/admin.py`). Al no encontrarlo, retorna 404 antes de llegar a la lógica de scoping de HOLDER (línea 150).

**Diagnóstico:**
- El test espera que un HOLDER reciba 403 al intentar aprobar, incluso con un UUID inválido
- La implementación actual retorna 404 si el usuario no existe, independientemente del rol
- Esto es **inconsistente**: un ADMIN legítimo también recibiría 404 con un UUID inválido
- Consideración de seguridad: el endpoint filtra qué usuarios existen (leak de información)

**Severidad:** 🟡 Medio — Comportamiento no ideal para pruebas de autorización; el test debería crear un usuario real de otro tenant para probar el 403 correctamente.

---

### ISSUE #3 — `test_reject_requires_admin` — FAIL ❌

**Archivo:** `tests/test_admin.py:652`
**Endpoint:** `POST /api/admin/reject/{user_id}`
**UUID usado:** `00000000-0000-0000-0000-000000000000` (no existente)
**Token usado:** HOLDER role
**Esperado:** `403 Forbidden`
**Obtenido:** `404 Not Found` → `{"detail":"Usuario no encontrado."}`

**Causa raíz:**
Mismo patrón que ISSUE #2: el `user not found` check (líneas 239-244) se ejecuta antes del check de permisos HOLDER (línea 253).

**Diagnóstico:**
Misma solución que ISSUE #2. El test necesita un usuario real de otro tenant.

**Severidad:** 🟡 Medio — Mismo caso que #2.

---

### ISSUE #4 — `test_require_super_admin_with_holder_fails` — FAIL ❌

**Archivo:** `tests/test_admin.py:710`
**Endpoint:** `GET /api/admin/pending-registrations`
**Token usado:** HOLDER role
**Esperado:** `403 Forbidden`
**Obtenido:** `200 OK`

**Causa raíz:**
Mismo caso que ISSUE #1. El endpoint usa `require_admin_or_holder` que permite HOLDER. El test `test_require_super_admin` asume que el endpoint rechaza HOLDER porque el nombre del test sugiere que debería usar `require_super_admin`.

**Diagnóstico:**
- El test verifica `require_super_admin` pero el endpoint usa `require_admin_or_holder`
- Esto es un **desajuste entre el nombre del test y la implementación real**
- Solución: corregir el test para reflejar la política real, o cambiar la dependencia del endpoint

**Severidad:** 🟡 Medio — Misma raíz que #1.

---

### ISSUE #5 — Auth Flow Standalone — FAIL ❌

**Archivo:** `test_auth.py`
**Flujo:** Register → Login → Token validation
**Resultado:** El registro falla porque el email `test_forge@example.com` ya existe. Login subsecuente falla con 401.

**Diagnóstico:**
- El test standalone usa emails fijos sin limpieza previa
- Al ejecutarse después de la suite de pytest, los datos ya existen en la BD
- No es un bug del código, sino del diseño del test standalone

**Severidad:** ⚪ Informativo — Test de integración manual, no forma parte de la suite automatizada.

---

### ISSUE #6 — Tests de integración con KeyError: 'id' (bajo --cov)

**Contexto:** Al ejecutar con `--cov`, 15 tests fallan con `KeyError: 'id'` en fixtures de setup.
**Causa probable:** La instrumentación de cobertura interfiere con el manejo asíncrono de SQLite, causando que fixtures no retornen correctamente los IDs creados.
**Impacto:** Solo bajo `--cov`. Sin coverage, los 15 tests pasan.
**Severidad:** 🟡 Medio — Problema de infraestructura de test, no de lógica de negocio.

---

## Tests de Regresión

| Archivo | Tests | Estado |
|---------|-------|--------|
| `tests/regression/test_duplicate_tenants.py` | 4 | ✅ Todos pasan |

Los tests de regresión cubren:
- Nombres duplicados de tenant rechazados
- Mensaje de error genérico (sin leak de existencia)
- Nombres únicos permitidos
- Subdominios duplicados aún rechazados

---

## Análisis de Patrones

### Patrón de Falla: Permisos vs. Implementación

Los 4 tests fallidos comparten una misma raíz: **la implementación es más permisiva de lo que los tests esperan**:

```
Tests esperan:             HOLDER → 403 Forbidden
Implementación actual:     HOLDER → 200 OK (con scope a su tenant)
```

La discrepancia está en:
- `require_admin_or_holder` permite HOLDER (intencional, por diseño)
- `require_super_admin` solo permite ADMIN (stricto)
- Los tests confunden ambos conceptos

### Recomendaciones de Corrección

1. **Para ISSUES #1 y #4:**
   - Evaluar si los endpoints `/api/admin/pending-registrations` deben ser solo ADMIN
   - Si sí: cambiar a `require_super_admin` en el router y actualizar tests
   - Si no (HOLDER debe ver sus propios pendientes): actualizar tests para esperar 200

2. **Para ISSUES #2 y #3:**
   - Crear un fixture que genere un usuario de otro tenant
   - Usar ese UUID real para probar que HOLDER recibe 403
   - Considerar mover el check de existencia DESPUÉS del check de permisos (mejor práctica de seguridad)

---

## Veredicto Final: FAIL ❌

**La fase NO puede avanzar** hasta que:

- [ ] **ISSUES #1-#4**: Corregir los 4 tests fallidos de permisos en `test_admin.py`
- [ ] **Cobertura general < 70%**: Mejorar cobertura en módulos críticos con < 50%
- [ ] **Módulos sin test**: `middleware/brand.py` (0%), `services/email.py` (0%), `services/encryption.py` (0%), `services/pdf.py` (13%)
- [ ] **KeyError bajo `--cov`**: Resolver interferencia coverage + SQLite asíncrono

### Acciones Requeridas

| # | Acción | Responsable | Prioridad |
|---|--------|-------------|-----------|
| 1 | Decidir si HOLDER debe acceder a `pending-registrations` o no | Titan/Atlas | Alta |
| 2 | Corregir tests o código según decisión | Forge | Alta |
| 3 | Agregar tests para approve/reject con usuario real de otro tenant | Echo | Alta |
| 4 | Mejorar cobertura de routers (evaluations, results, students, courses) | Echo/Forge | Media |
| 5 | Agregar tests para middleware/brand.py | Echo | Media |

---

*Reporte generado por Echo 📢 QA Automation Engineer — 2026-07-17*
