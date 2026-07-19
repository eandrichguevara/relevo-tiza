# 🐦‍⬛ Raven QA Review: Duplicate Tenants Fix

**Fecha**: 2026-07-12  
**Fase**: QA Gate — Corrección de duplicados en tabla `tenants`  
**Veredicto**: **FAIL** ❌

---

## Setup de Prueba

- **API URL**: http://localhost:8000
- **Base de datos**: PostgreSQL 16 (puerto 5432)
- **Entorno**: Docker Compose local
- **Tests ejecutados**: Pruebas funcionales via curl + race condition tests via httpx async

---

## Resumen

| Categoría                 | Hallazgos                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| Funcionalidades revisadas | 5 (create_tenant, list_tenants, register, login, validaciones duplicados) |
| **Bugs CRÍTICOS**         | **2**                                                                     |
| **Bugs MAYORES**          | **3**                                                                     |
| Bugs MENORES              | 2                                                                         |
| Issues UX                 | 3                                                                         |
| Errores de consola        | 0                                                                         |
| Requests fallidos (5xx)   | **SÍ** (race condition → 500)                                             |

---

## Bugs Encontrados

### 🔴 BUG-1: Race Condition en `create_tenant` — **SEVERIDAD: CRÍTICA**

**Ubicación**: `apps/api/routers/tenants.py:55-58` (bloque `try/except` solo envuelve `commit()`, no `flush()`)  
**Descripción**: Cuando dos requests concurrentes intentan crear un tenant con el **mismo nombre** (subdomains distintos), ambos pasan la validación `SELECT` previa, pero el segundo falla con **500 Internal Server Error** en lugar de **409 Conflict**.  
**Evidencia**:

```bash
Request 1: POST /api/tenants {"name": "Race School", "subdomain": "race-1"} → 201 ✓
Request 2: POST /api/tenants {"name": "Race School", "subdomain": "race-2"} → 500 ✗
```

**Impacto**:

- Rompe la API bajo concurrencia real
- Expone stack traces internos si `debug=true`
- Deja la sesión de BD en estado inconsistente (rollback parcial)
  **Fix esperado**: Mover el `try/except IntegrityError` para que envuelva `await db.flush()` (línea 47), no solo el `commit()`.
  **Responsable sugerido**: @forge

---

### 🔴 BUG-2: Validación de nombre vacío / solo whitespace — **SEVERIDAD: CRÍTICA**

**Ubicación**: `apps/api/models/schemas.py` (CreateTenantRequest) + `apps/api/routers/tenants.py`  
**Descripción**: La API acepta nombres vacíos (`""`) y nombres con solo espacios (`"   "`). No hay validación a nivel de schema ni de endpoint.  
**Evidencia**:

```bash
POST {"name": "", "subdomain": "empty-name"} → 201 ✗ (debería 422)
POST {"name": "   ", "subdomain": "whitespace-name"} → 201 ✗ (debería 422)
```

**Impacto**: Crea tenants inválidos que rompen UI, reportes, búsquedas y lógica de negocio.
**Fix esperado**: Agregar `@field_validator('name')` en `CreateTenantRequest` que rechace strings vacíos o solo whitespace (`min_length=1` tras `strip()`).
**Responsable sugerido**: @forge / @aria

---

### 🟠 BUG-3: Error messages en inglés en producto para mercado chileno — **SEVERIDAD: MAYOR (UX)**

**Ubicación**: `apps/api/routers/tenants.py`, `apps/api/routers/auth.py`  
**Descripción**: Todos los mensajes de error son en inglés:

- `"A tenant with name 'X' already exists"`
- `"Subdomain 'X' is already taken"`
- `"Email already registered"`
- `"Invalid email or password"`
- `"Too many requests. Please try again later."`
  **Impacto**: Usuarios finales (directores, profesores chilenos) no entienden los errores. Deben ser en español.
  **Fix esperado**: Internacionalización (i18n) o al menos mensajes en español por defecto.
  **Responsable sugerido**: @atlas / @forge

---

### 🟠 BUG-4: Usuarios legacy sin `TenantMember` — **SEVERIDAD: MAYOR (Data Integrity)**

**Ubicación**: Datos existentes en BD  
**Descripción**: 16 usuarios existen en `users` pero **no** tienen entrada correspondiente en `tenant_members`. Esto rompe el aislamiento de tenants (tenant isolation) implementado en SEC-7.
**Evidencia**:

```sql
SELECT u.id, u.email, u.tenant_id
FROM users u
LEFT JOIN tenant_members tm ON u.id = tm.user_id AND u.tenant_id = tm.tenant_id
WHERE tm.id IS NULL;
-- 16 filas retornadas
```

**Impacto**: Estos usuarios no aparecen en `GET /api/tenants` (filtro por membership), rompen multi-tenancy, y pueden causar accesos no autorizados si el fallback legacy se elimina.
**Fix esperado**: Migración/backfill que cree `TenantMember` para cada usuario existente con rol apropiado.
**Responsable sugerido**: @sage / @forge

---

### 🟠 BUG-5: Falta endpoint `DELETE /api/tenants/{id}` — **SEVERIDAD: MAYOR (Funcionalidad)**

**Ubicación**: `apps/api/routers/tenants.py`  
**Descripción**: No existe endpoint para eliminar tenants. Probado: `DELETE /api/tenants/{id}` → 404 Not Found.
**Impacto**: Operaciones de limpieza/admin requieren SQL manual. No hay forma de borrar tenants de prueba o erróneos via API.
**Fix esperado**: Implementar `DELETE /api/tenants/{id}` con validaciones (solo owner, cascade correcto, auditoría).
**Responsable sugerido**: @forge

---

### 🟡 BUG-6: Validación de subdomain débil — **SEVERIDAD: MENOR**

**Ubicación**: `CreateTenantRequest` schema  
**Descripción**: El subdomain no valida formato (solo alfanumérico + guiones, sin espacios, longitud razonable). Acepta subdomains inválidos para DNS/URLs.
**Fix esperado**: Regex `^[a-z0-9-]{3,63}$` + no iniciar/terminar en guión.

---

### 🟡 BUG-7: Rate limiting agresivo en `/auth/register` — **SEVERIDAD: MENOR**

**Descripción**: 429 Too Many Requests tras ~3 requests en <5 segundos. Dificulta testing automatizado y registro legítimo en picos.
**Fix esperado**: Aumentar límite o diferenciar por IP vs usuario.

---

## Issues de UX

| ID   | Descripción                                                                                      | Severidad |
| ---- | ------------------------------------------------------------------------------------------------ | --------- |
| UX-1 | Mensajes de error en inglés (ver BUG-3)                                                          | 🟠 Mayor  |
| UX-2 | Sin validación frontend-friendly (422 con `detail` array estilo FastAPI/Pydantic v2)             | 🟡 Menor  |
| UX-3 | Sin endpoint para listar TODOS los tenants (solo los del holder actual) — dificulta admin global | 🟡 Menor  |

---

## Lo Que Sí Funciona ✅

1. **Constraint UNIQUE en BD**: `uq_tenants_name` existe y funciona correctamente.
2. **Validación duplicados (happy path)**: `POST /api/tenants` retorna 409 con mensaje claro si nombre/subdomain ya existen **en requests secuenciales**.
3. **Registro HOLDER reutiliza tenant existente**: Dos holders registrándose con mismo `school` comparten tenant (comportamiento correcto en `auth.py`).
4. **Login/Register/GET /auth/me**: Funcionan correctamente.
5. **GET /api/tenants**: Lista tenants del holder autenticado (con fallback legacy).
6. **Validación email duplicado en register**: Retorna 409 correcto.
7. **Rate limiting**: Funciona (aunque agresivo).

---

## Errores de Consola / Red

- **0 errores** en consola del navegador (API only, no frontend testado)
- **500 Internal Server Error** reproducible bajo race condition (BUG-1)

---

## Veredicto Final: **FAIL** ❌

La fase **NO puede avanzar** hasta que se corrijan:

- [ ] **BUG-1** (CRÍTICO): Race condition en `create_tenant` → 500 en lugar de 409
- [ ] **BUG-2** (CRÍTICO): Nombres vacíos / whitespace-only aceptados
- [ ] **BUG-3** (MAYOR): Mensajes de error en inglés
- [ ] **BUG-4** (MAYOR): 16 usuarios huérfanos sin `TenantMember` (backfill requerido)
- [ ] **BUG-5** (MAYOR): Falta `DELETE /api/tenants/{id}`

---

## Recomendaciones Adicionales

1. **Agregar tests automatizados de concurrencia** (Echo): Simular 10 requests paralelos con mismo nombre → esperar 1x 201 + 9x 409, **cero 500**.
2. **Migración de datos**: Script idempotente para crear `TenantMember` faltantes (owner para HOLDERS, member para TEACHERS).
3. **i18n**: Introducir `fastapi-i18n` o dict simple ES/EN para mensajes de error.
4. **Validación en schema**: Usar `Annotated[str, Field(min_length=1, pattern=r'^\S.*\S$|^\S$')]` para name.
5. **OpenAPI tags**: Documentar que `DELETE /tenants` no existe aún (evita confusión a frontend).

---

_"Encontré 2 bugs que tiran 500 bajo carga real. Eso no pasa QA. Arreglen el flush-wrap y la validación de vacíos, y volvemos a hablar."_ 🐦‍⬛

**— Raven, QA Gate**
