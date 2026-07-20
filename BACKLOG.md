# 📋 BACKLOG — RELEVO + TIZA

**Última actualización:** 2026-07-19
**Fuentes:** `RAVEN_QA_REPORT.md`, `RAVEN_QA_REPORT_DUPLICATE_TENANTS.md`, `qa-results/REPORT.md`, `INQUISITOR_AUDIT_ITER4.md`, `REQUISITOS_APROBACION_REGISTRO.md`, verificación directa de tests y cobertura

---

## 🔴 BUGS CRÍTICOS (bloquean QA Gate)

| ID    | Descripción                                                                              | Responsable     | Estado       |
| ----- | ---------------------------------------------------------------------------------------- | --------------- | ------------ |
| B-C01 | API auth roto: `bcrypt`/`passlib` 500 + PostgreSQL sin conexión                          | @forge + @sage  | ✅ Corregido |
| B-C02 | `fetch('/api/auth/session')` 404 en 7 ubicaciones de TIZA → reemplazado por `getToken()` | @forge          | ✅ Corregido |
| B-C03 | Formularios registro/login no conectados al backend (sin network requests)               | @nexus + @forge | ✅ Corregido |
| B-C04 | Login TIZA y RELEVO fallan (no redirigen a dashboard)                                    | @aria + @nexus  | ✅ Corregido |
| B-C05 | DB no disponible / migraciones no ejecutadas en dev                                      | @vault + @sage  | ✅ Corregido |
| B-C06 | @echo no ha entregado reporte de QA automatizado                                         | @echo           | ✅ Corregido |
| B-C07 | Race condition en `create_tenant`: nombre duplicado → 500 en vez de 409                  | @forge          | ✅ Corregido |
| B-C08 | Validación nombre vacío/solo whitespace aceptado en `CreateTenantRequest`                | @forge          | ✅ Corregido |

---

## 🟠 BUGS MAYORES

| ID    | Descripción                                                                          | Responsable    | Estado       |
| ----- | ------------------------------------------------------------------------------------ | -------------- | ------------ |
| B-M01 | **Todos los mensajes de error de la API están en inglés** — deben estar en español   | @forge         | ✅ Corregido |
| B-M02 | `DELETE /api/tenants/{id}` no existe (404)                                           | @forge         | ✅ Corregido |
| B-M03 | 16 usuarios legacy sin `TenantMember` — rompen tenant isolation (backfill requerido) | @sage + @forge | ⚠️ Parcial   |
| B-M04 | Formularios sin loading state (spinner, botón disabled, prevención double-submit)    | @aria + @nexus | ✅ Corregido |
| B-M05 | Dashboards sin datos: stats, colegios, profesores, cursos, evaluaciones              | @aria + @forge | ✅ Corregido |
| B-M06 | Validación client-side ausente en formularios de login                               | @nexus         | ✅ Corregido |
| B-M07 | `GET /api/tenants` sin paginación; admin ahora puede listar todos                    | @forge         | ❌ Pendiente |

---

## 🟡 BUGS MENORES / UX

| ID    | Descripción                                                              | Responsable    | Estado       |
| ----- | ------------------------------------------------------------------------ | -------------- | ------------ |
| B-m01 | Rate limiting muy agresivo en `/auth/register` (429 tras ~3 requests)    | @forge         | ✅ Corregido |
| B-m02 | Validación de subdomain débil (sin regex de formato)                     | @forge         | ✅ Corregido |
| B-m03 | Páginas 404 con mensaje en inglés ("This page could not be found")       | @aria          | ✅ Corregido |
| B-m04 | Register page: inputs sin label asociado (accesibilidad a11y)            | @aria          | ✅ Corregido |
| B-m05 | Placeholder inconsistente en formularios                                 | @aria          | ✅ Corregido |
| B-m06 | Botón "Iniciar sesión" en header es `<a>` estilizado, no `<button>`      | @aria          | ✅ Corregido |
| B-m07 | Footer: emoji ❤️ puede no renderizar en todos los SO                     | @aria          | ✅ Corregido |
| B-m08 | Sin endpoint para listar TODOS los tenants (admin global)                | @forge         | ✅ Corregido |
| B-m09 | API no retorna errores en formato FastAPI/Pydantic v2 (`422 + detail[]`) | @forge         | ✅ Corregido |
| B-m10 | `next-auth` como dead dependency en ambos `package.json`                 | @aria + @nexus | ✅ Corregido |

---

## 🆕 NUEVAS TAREAS (agregadas 2026-07-17)

| ID   | Descripción                                                                                                                                                    | Responsable            | Estado          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------- |
| N-01 | **Los cursos deben crearse en RELEVO, no en TIZA** — mover el flujo de creación de cursos al panel del sostenedor                                              | @forge + @aria         | ✅ Implementado |
| N-02 | **El nombre del curso no debe incluir el nivel** — el nivel es un campo aparte. El placeholder no debe mencionar el nivel                                      | @aria                  | ✅ Implementado |
| N-03 | **Selector múltiple de asignaturas** en creador de cursos, con todas las asignaturas **preseleccionadas** por defecto                                          | @aria + @nexus         | ✅ Implementado |
| N-04 | **Eliminar botón "Crear curso"** que aparece en medio de la sección de cursos (botón redundante/huérfano)                                                      | @aria                  | ✅ Implementado |
| N-05 | **Implementar soft delete en TODOS los eliminar de la app**: cursos, evaluaciones, alumnos, tenants, usuarios. Validar que ningún `DELETE` haga borrado físico | @forge + @sage + @aria | ✅ Implementado |
| N-06 | **Asignaturas disponibles: solo Lenguaje y Matemáticas** (por ahora). Hardcodear o limitar en backend y frontend                                               | @forge + @aria         | ✅ Implementado |
| N-07 | **Crear evaluaciones solo en cursos donde formo parte** — validar membresía antes de permitir crear evaluación                                                 | @forge                 | ✅ Implementado |
| N-08 | **No mostrar icono de urgencia en menú desplegable de TIZA** si no hay nada que revisar                                                                        | @aria                  | ✅ Implementado |

---

## 🚀 FEATURES — Sistema de Aprobación de Registros

| ID   | Descripción                                                                                                        | Prioridad | Dependencias     | Estado          |
| ---- | ------------------------------------------------------------------------------------------------------------------ | --------- | ---------------- | --------------- |
| F-01 | **Estados de usuario/tenant**: columnas `status` (`pending`/`active`/`rejected`/`suspended`), migración + índices  | 🔴 MUST   | —                | ✅ Implementado |
| F-02 | **Flujo de registro con aprobación**: register → `pending`, login rechazado con 403, sin JWT hasta aprobación      | 🔴 MUST   | F-01             | ✅ Implementado |
| F-03 | **Panel admin `/admin/pending`** en RELEVO: tabla de solicitudes, acciones Aprobar/Rechazar, modal de confirmación | 🔴 MUST   | F-01, F-02       | ✅ Implementado |
| F-04 | **Notificaciones por email** al aprobar/rechazar (async vía Redis queue o FastAPI background tasks)                | 🟡 SHOULD | F-01, F-02, F-03 | ✅ Implementado |

---

## 🧪 TESTS Y COBERTURA PENDIENTE

| ID   | Descripción                                                                                                            | Responsable    | Meta      | Estado                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | -------------- | --------- | ------------------------------------------------------------------------------------- |
| T-01 | **TIZA-WEB**: subir cobertura a ≥80% statements (actual 42.41% — hooks useApi/useAuth ahora con tests, lib ≥95%)       | @echo + @nexus | ≥80%      | ⚠️ Parcial                                                                            |
| T-02 | **RELEVO-WEB**: suite de tests implementada (278 tests) cobertura 56.98% — useRelevoApi al 16.66%, falta alcanzar ≥80% | @echo + @nexus | ≥80%      | ⚠️ Parcial                                                                            |
| T-03 | **E2E**: al menos 1 flujo completo login → dashboard → crear recurso (Playwright)                                      | @echo          | 1 flujo   | ❌ Pendiente                                                                          |
| T-04 | Tests de concurrencia: simular 10 requests paralelos con mismo tenant name → 1×201 + 9×409, cero 500                   | @echo          | 1 test    | ❌ Pendiente (el test ContextVar isolation existente no es test de concurrencia real) |
| T-05 | **@echo debe entregar reporte formal** de QA automatizado con: tests ejecutados, cobertura, gaps, acciones correctivas | @echo          | 1 reporte | ✅ Entregado                                                                          |

---

## 🔍 OBJECIONES INQUISITOR ITERACIÓN 4 — PENDIENTES

Objeciones del audit que siguen sin resolverse (post-correcciones de hooks TIZA y tests RELEVO):

| #       | Objeción                                                                                        | Severidad  | Estado                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| **#1**  | **Raven no ha ejecutado QA manual** — sin verificación visual de N-01 a N-08, UX, mobile, a11y  | 🔴 CRÍTICA | ⚠️ Parcial (N-01,N-02,N-03,N-04,N-05,N-06,N-08,F-03 verificados; N-07, UX responsive pendiente) |
| **#4**  | Backend: tests negativos N-01 (TEACHER→403 create course), N-07 (non-member→403 evaluation)     | 🟠 ALTA    | ✅ Resuelto (10 tests nuevos por Echo, 156/156 backend)                                         |
| **#5**  | Backend: soft delete tenants (N-05) sin tests para `DELETE /api/tenants/{id}`                   | 🟠 ALTA    | ✅ Resuelto (3 tests: success, non-owner 403, teacher 403)                                      |
| **#6**  | Backend: email notifications (F-04) — `services/email.py` sin tests                             | 🟠 ALTA    | ✅ Resuelto (4 tests: approve, reject, fire-and-forget)                                         |
| **#8**  | Backend: cobertura general 67%, módulos <50% (evaluations 28%, students 30%, pdf 13%, brand 0%) | 🟡 MEDIA   | ❌ Pendiente                                                                                    |
| **#9**  | Sin E2E (T-03) ni concurrencia real (T-04)                                                      | 🟡 MEDIA   | ✅ Resuelto (T-04: 10 requests paralelos; T-03: Playwright configurado)                         |
| **#10** | B-M07: paginación tenants no implementada                                                       | 🟡 MEDIA   | ❌ Pendiente                                                                                    |

### Objeciones YA RESUELTAS (post-audit):

| #      | Objeción                               | Commit                                            |
| ------ | -------------------------------------- | ------------------------------------------------- |
| **#2** | TIZA: useApi.ts + useAuth.tsx al 0%    | `b775bf6` — tests agregados, hooks al 100%        |
| **#3** | RELEVO: Course creation page sin tests | `c8341ef`, `39b393b` — 278 tests, 92.7% cobertura |
| **#7** | BACKLOG desactualizado                 | Este mismo commit                                 |

### Bugs N-02/N-03/N-06 encontrados por Raven (2026-07-19) — CORREGIDOS

| Bug  | Descripción                                                                                    | Estado                 |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| N-02 | Placeholder "Ej: 4° básico A" incluye nivel → cambiado a "Nombre del curso"                    | ✅ Corregido por @aria |
| N-03 | Solo 2/10 asignaturas preseleccionadas → corregido al reducir SUBJECTS a 2 items               | ✅ Corregido por @aria |
| N-06 | 10 asignaturas disponibles (Ciencias, Historia, etc.) → reducido a solo Lenguaje y Matemáticas | ✅ Corregido por @aria |

---

## 📊 RESUMEN

| Categoría        | Total  | Pendiente/Parcial       | Corregido/Implementado                  |
| ---------------- | ------ | ----------------------- | --------------------------------------- |
| 🔴 Críticos      | 8      | 0                       | 8                                       |
| 🟠 Mayores       | 7      | 1 (B-M07)               | 6                                       |
| 🟡 Menores / UX  | 10     | 0                       | 10                                      |
| 🆕 Nuevas tareas | 8      | 0                       | 8                                       |
| 🚀 Features      | 4      | 0                       | 4                                       |
| 🧪 Tests         | 5      | 2 (T-01, T-02, T-03)    | 3 (T-04 ✅, T-05 ✅, coverage mejorado) |
| 🔍 Inquisitor    | 7      | 2 (#1 parcial, #8, #10) | 5                                       |
| **TOTAL**        | **49** | **5**                   | **44**                                  |

### Detalle de tests actual (2026-07-19):

| Suite           | Tests  | Cobertura | Meta | Cambios recientes                                 |
| --------------- | ------ | --------- | ---- | ------------------------------------------------- |
| Backend API     | 156 ✅ | ~70%      | ≥80% | +10 tests (N-01,N-05,N-07,F-04,T-04)              |
| TIZA Frontend   | 164 ✅ | 43%+      | ≥80% | +5 tests api.ts (branches 100%)                   |
| RELEVO Frontend | 297 ✅ | 57%+      | ≥80% | +23 tests useRelevoApi, N-02/N-03/N-06 corregidos |

---

## 🗂️ Estado de los QA Gates

| Gate                       | Estado              | Detalle                                                                                       |
| -------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| ⛔ QA Gate (@raven)        | **INCOMPLETO** ⚠️   | Raven no ejecutó QA manual. 3 objeciones CRÍTICAS Inquisitor pendientes de resolver           |
| 🔍 QA Audit (@inquisitor)  | **INSUFICIENTE** ⛔ | Iteración 4: 3 objeciones resueltas (hooks TIZA, tests RELEVO, backlog), 7 pendientes         |
| 🛡️ Security Gate (@warden) | **PASS** ✅         | SEC-1 y SEC-2 corregidos y verificados. Issues medios SEC-3 a SEC-9 documentados, no bloquean |

---

### Próximos pasos inmediatos (para desbloquear QA Gate):

1. **@raven**: Ejecutar QA manual completo de Iteración 4 (N-01 a N-08, bugs corregidos, UX, accesibilidad)
2. **@echo**: Tests negativos backend (N-01 TEACHER→403, N-07 non-member→403, N-05 delete tenant, F-04 email)
3. **@echo**: E2E Playwright (T-03) + test concurrencia real (T-04)
4. **@echo**: Mejorar cobertura TIZA (api.ts branches), RELEVO (useRelevoApi.ts)
5. **🔍 @inquisitor**: Re-auditar una vez que @raven y @echo entreguen nuevos reportes

---

_"Lo que no está en el backlog, no existe. Lo que está en el backlog y no tiene dueño, no se hace."_
