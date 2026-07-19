# 📋 BACKLOG — RELEVO + TIZA

**Última actualización:** 2026-07-18
**Fuentes:** `RAVEN_QA_REPORT.md`, `RAVEN_QA_REPORT_DUPLICATE_TENANTS.md`, `qa-results/REPORT.md`, `INQUISITOR_AUDIT_ITER4.md`, `REQUISITOS_APROBACION_REGISTRO.md`

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
| B-M07 | `GET /api/tenants` sin paginación; admin ahora puede listar todos                    | @forge         | ✅ Corregido |

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

| ID   | Descripción                                                                                                            | Responsable    | Meta      | Estado          |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | -------------- | --------- | --------------- |
| T-01 | **TIZA-WEB**: subir cobertura a ≥80% statements (actual 28.6% — módulos core ≥95%, faltan hooks)                       | @echo + @nexus | ≥80%      | ⚠️ Parcial      |
| T-02 | **RELEVO-WEB**: suite de tests implementada (204 tests) pero cobertura actual 47.31% — falta alcanzar ≥80%             | @echo + @nexus | ≥80%      | ⚠️ Parcial      |
| T-03 | **E2E**: al menos 1 flujo completo login → dashboard → crear recurso (Playwright)                                      | @echo          | 1 flujo   | ❌ Pendiente    |
| T-04 | Tests de concurrencia: simular 10 requests paralelos con mismo tenant name → 1×201 + 9×409, cero 500                   | @echo          | 1 test    | ✅ Implementado |
| T-05 | **@echo debe entregar reporte formal** de QA automatizado con: tests ejecutados, cobertura, gaps, acciones correctivas | @echo          | 1 reporte | ✅ Entregado    |

---

## 📊 RESUMEN

| Categoría        | Total  | Pendiente/Parcial | Corregido/Implementado |
| ---------------- | ------ | ----------------- | ---------------------- |
| 🔴 Críticos      | 8      | 0                 | 8                      |
| 🟠 Mayores       | 7      | 1                 | 6                      |
| 🟡 Menores / UX  | 10     | 0                 | 10                     |
| 🆕 Nuevas tareas | 8      | 0                 | 8                      |
| 🚀 Features      | 4      | 0                 | 4                      |
| 🧪 Tests         | 5      | 3                 | 2                      |
| **TOTAL**        | **42** | **4**             | **38**                 |

---

## 🗂️ Estado de los QA Gates

| Gate                       | Estado              | Detalle                                                                                          |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| ⛔ QA Gate (@raven)        | **INCOMPLETO** ⚠️   | Raven no ejecutó (prevención de timeout multimodal). Datos de verificación recopilados por Titan |
| 🔍 QA Audit (@inquisitor)  | **INSUFICIENTE** ⛔ | Iteración 4: objeciones pendientes — tests hooks TIZA, tests course RELEVO, reporte Raven        |
| 🛡️ Security Gate (@warden) | **FAIL** ❌         | SEC-1 y SEC-2 pendientes de corrección                                                           |

---

_"Lo que no está en el backlog, no existe. Lo que está en el backlog y no tiene dueño, no se hace."_
