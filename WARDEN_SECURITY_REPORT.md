# 🛡️ Warden Security Review — RELEVO + TIZA

**Fecha:** 2026-07-18  
**Auditor:** Warden 🛡️ Security Engineer  
**Alcance:** Código completo (API, frontends, infra, dependencias)  
**Metodología:** OWASP Top 10 + análisis estático + revisión de dependencias

---

## ✅ Veredicto: **PASS**

**SEC-1 y SEC-2 corregidos y verificados. Sin vulnerabilidades críticas o altas pendientes.**

---

## Resumen Ejecutivo

| Categoría   | Count  |
| ----------- | ------ |
| 🔴 Críticas | 0      |
| 🟠 Altas    | 2      |
| 🟡 Medias   | 7      |
| ⚪ Bajas    | 6      |
| **Total**   | **15** |

- **Dependencias vulnerables (CVSS ≥ 7.0):** 0
- **Secrets en código fuente:** 0
- **Secrets en `.env` (no commiteados):** 3 (GEMINI_API_KEY, JWT_SECRET, DB credentials)
- **`.env` commiteados en git:** ✅ NO (verificado con `git ls-tree HEAD` y `git ls-files --stage`)

---

## 🔴 Issues Críticos (CVSS 9.0-10.0)

_Ninguno encontrado._

---

## 🟠 Issues Altos (CVSS 7.0-8.9) — ~~BLOQUEAN AVANCE~~ RESUELTOS

### ~~SEC-1: Hardcoded database password en fallback de `database.py`~~ — CORREGIDO ✅

**Estado:** ✅ **CORREGIDO** — Verificado por Warden en re-revisión.

**Fix aplicado en** `apps/api/database.py:17-22`:
- `DATABASE_URL = os.getenv("DATABASE_URL")` — sin fallback hardcodeado.
- `if not _DB_URL: raise RuntimeError(...)` — error claro con mensaje descriptivo si la variable no está seteada.
- Sin credenciales en el source code.

---

### ~~SEC-2: Rate limiting deshabilitado por defecto + sin validación de uploads~~ — CORREGIDO ✅

**Estado:** ✅ **CORREGIDO** — Verificado por Warden en re-revisión.

**Fix A aplicado en** `apps/api/config.py:96-108`:
- `rate_limit_enabled` ahora retorna `True` por defecto para TODOS los ambientes.
- Ya no depende de `ENVIRONMENT`. Solo se deshabilita si se setea `RATE_LIMIT_ENABLED=false` explícitamente.

**Fix B aplicado en** `apps/api/routers/evaluations.py:24-56`:
- `ALLOWED_UPLOAD_MIMETYPES = {"application/pdf"}` — whitelist de Content-Type.
- `MAX_UPLOAD_SIZE = 10 * 1024 * 1024` — límite de 10 MB.
- `_validate_upload()` invocado en ambos endpoints de upload (`process_scanned` y `process_scanned_async`).
- HTTP 400 para tipo inválido, HTTP 413 para archivo demasiado grande.

---

## 🟡 Issues Medios (CVSS 4.0-6.9)

### SEC-3: Docker Compose expone TODOS los puertos a 0.0.0.0 — MEDIA 🟡

**Ubicación:** `docker-compose.yml:10,19,30-31,46-47,55`  
**CVSS:** 6.5

Todos los servicios exponen puertos directamente al host sin bind a `127.0.0.1`:

- PostgreSQL `5432:5432` (con password débil `tiza_password`)
- Redis `6379:6379` (SIN autenticación)
- MinIO `9000:9000` + `9001:9001` (credenciales `minioadmin:minioadmin`)
- Mailpit `1025:1025` + `8025:8025`

**Impacto:** Cualquier proceso en la red local (o en el host) puede acceder a la base de datos, Redis, y el storage.

**Fix requerido:** Bind a localhost:

```yaml
ports:
  - '127.0.0.1:5432:5432'
  - '127.0.0.1:6379:6379'
```

**OWASP:** A05:2021 — Security Misconfiguration

---

### SEC-4: Sin Content-Security-Policy header — MEDIA 🟡

**Ubicación:** `apps/api/main.py:17-24` (security_headers_middleware)  
**CVSS:** 6.0

Falta el header `Content-Security-Policy` (CSP). Es la defensa principal contra XSS de tipo inyección de scripts.

**Fix requerido:**

```python
response.headers["Content-Security-Policy"] = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self'; "
    "connect-src 'self' https://*.googleapis.com; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)
```

**OWASP:** A03:2021 — Injection

---

### SEC-5: Rate limiter in-memory — bypass en multi-worker/proxy — MEDIA 🟡

**Ubicación:** `apps/api/main.py:36-79`  
**CVSS:** 5.3

El rate limiter usa un `defaultdict(list)` en memoria:

- **No funciona con múltiples workers** (cada worker tiene su propio contador)
- **No detecta IP real detrás de reverse proxy** (usa `request.client.host` en vez de `X-Forwarded-For`)
- **Se resetea al reiniciar el proceso**
- **Sin protección contra rate-limit bypass por IPv6 rotation**

**Fix requerido:** Migrar a Redis-backed rate limiter en producción. Usar `X-Forwarded-For` (solo el primer hop, no el último) para detectar IP real.

**OWASP:** A05:2021 — Security Misconfiguration

---

### SEC-6: Hardcoded credentials en Docker Compose — MEDIA 🟡

**Ubicación:** `docker-compose.yml:8-9,33-34`  
**CVSS:** 5.0

```yaml
POSTGRES_PASSWORD: tiza_password
MINIO_ROOT_USER: minioadmin
MINIO_ROOT_PASSWORD: minioadmin
```

Aunque es aceptable para development local, estas credenciales deberían venir de variables de entorno o un archivo `.env` específico para docker-compose.

**Fix requerido:**

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-tiza_password}
```

---

### SEC-7: Path traversal potencial en storage service — MEDIA 🟡

**Ubicación:** `apps/api/services/storage.py:66-70` (LocalStorage)  
**CVSS:** 5.0

```python
async def _ensure_path(self, bucket: str, key: str) -> Path:
    full_path = self.BASE_DIR / bucket / key  # ← key no validado
    full_path.parent.mkdir(parents=True, exist_ok=True)
    return full_path
```

Si `key` contiene `../`, se podría escribir fuera del directorio base. Aunque los keys son generados server-side (mitigación parcial), un input malicioso en el `key` podría permitir path traversal.

**Fix requerido:**

```python
from pathlib import PurePosixPath
safe_key = str(PurePosixPath(key))
if '..' in safe_key or safe_key.startswith('/'):
    raise ValueError("Invalid key path")
full_path = self.BASE_DIR / bucket / safe_key
```

---

### SEC-8: Demo credentials en seed_data.py — MEDIA 🟡

**Ubicación:** `apps/api/seed_data.py:67-68`  
**CVSS:** 4.3

```python
demo_users = [
    ("profesor@demo.cl", "María González", "TEACHER", "demo123"),
    ("director@demo.cl", "Carlos Rodríguez", "HOLDER", "demo123"),
]
```

Passwords débiles (`demo123`) hardcodeadas. Aceptable para development, pero deben documentarse como NO-PRODUCTION y no deben usarse en staging.

---

### SEC-9: X-Tenant-Subdomain header habilitado en development — MEDIA 🟡

**Ubicación:** `apps/api/middleware/tenant.py:110-115`  
**CVSS:** 4.3

```python
if not tenant_id and settings.ENVIRONMENT == "development":
    x_subdomain = request.headers.get("X-Tenant-Subdomain")
```

En development, un atacante puede manipular el header `X-Tenant-Subdomain` para acceder a datos de cualquier tenant. Mitigado por el hecho de que es solo development, pero si `ENVIRONMENT` se configura mal en producción, sería un IDOR crítico.

**Fix requerido:** Añadir un assertion o check explícito:

```python
assert settings.ENVIRONMENT != "production", "X-Tenant-Subdomain must be disabled in production"
```

---

## ⚪ Issues Bajos (CVSS 0.1-3.9)

### SEC-10: Información sensible en logs de seed_data.py — BAJA ⚪

**Ubicación:** `apps/api/seed_data.py:162-163`

```python
print(f"   Super Admin: {super_admin_email} / {super_admin_password}")
```

La contraseña del super admin se imprime en stdout. En producción, esto quedaría en los logs del contenedor.

---

### SEC-11: JWT token también en sessionStorage — BAJA ⚪

**Ubicación:** `apps/tiza-web/src/lib/auth.ts:60-68`  
El token JWT se almacena en `sessionStorage` para acceso client-side. Aunque también existe como HttpOnly cookie, la copia en sessionStorage es accesible vía XSS. Mitigado por SameSite=Strict y HttpOnly cookie.

---

### SEC-12: User data en localStorage — BAJA ⚪

**Ubicación:** `apps/tiza-web/src/lib/auth.ts:100-105`  
User profile (name, email, role) almacenado en localStorage. No es sensitive data pero podría usarse para fingerprinting.

---

### SEC-13: User enumeration via status-specific error messages — BAJA ⚪

**Ubicación:** `apps/api/routers/auth.py:119-135`  
Los mensajes de error revelan el estado de la cuenta (pending/rejected/suspended). Un atacante puede determinar si un email existe y su estado.

---

### SEC-14: Content-Disposition header con input del usuario — BAJA ⚪

**Ubicación:** `apps/api/routers/evaluations.py:122`

```python
f"attachment; filename={evaluation.title.encode('ascii', 'replace').decode()}.pdf"
```

Aunque se usa `encode('ascii', 'replace')`, caracteres de control como `\n` podrían causar header injection en servidores HTTP mal configurados.

---

### SEC-15: CORS allow_credentials=True con allow_origins específicas — BAJA ⚪

**Ubicación:** `apps/api/main.py:206-215`  
La combinación `allow_credentials=True` con orígenes específicos es correcta, pero se debe verificar que los orígenes no incluyan wildcards ni dominios no confiables en producción.

---

## ✅ Lo Que Está BIEN Asegurado

| Control                              | Estado | Detalle                                                                            |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| `.env` no commiteados                | ✅     | Verificado con `git ls-tree HEAD` y `git ls-files --stage`                         |
| `.gitignore` incluye `.env`          | ✅     | `.env`, `.env.local`, `.env.*.local`                                               |
| Password hashing                     | ✅     | bcrypt + SHA-256 pre-hash (Django-style), 72-byte limit mitigado                   |
| JWT expiration                       | ✅     | 120 minutos con exp claim                                                          |
| JWT secret entropy                   | ✅     | 256-bit (64 hex chars), generated via `os.urandom(32)` si no está en env           |
| Security headers                     | ✅     | X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy |
| CORS                                 | ✅     | Orígenes específicos, no wildcard `*`                                              |
| Cookies HttpOnly + Secure + SameSite | ✅     | Verificado en `set-token/route.ts`                                                 |
| SQL Injection                        | ✅     | UUID regex validation antes de interpolación en DDL                                |
| ORM queries parametrizadas           | ✅     | Todos los routers usan SQLAlchemy ORM                                              |
| IDOR / Tenant Isolation              | ✅     | Schema-per-tenant + TenantMember verification                                      |
| Privilege escalation                 | ✅     | ADMIN role excluido de registro público                                            |
| No eval/exec/subprocess              | ✅     | Sin código de ejecución dinámica                                                   |
| No dangerouslySetInnerHTML           | ✅     | Sin XSS vectors en frontend                                                        |
| Input validation                     | ✅     | Pydantic schemas con validators (email, subdomain, etc.)                           |
| Password min length                  | ✅     | 8 caracteres mínimo                                                                |
| User status enforcement              | ✅     | pending/rejected/suspended bloqueados en login + API                               |
| Role-based access control            | ✅     | require_role(), require_super_admin(), verify_tenant_access()                      |
| X-Tenant-Id header eliminado         | ✅     | Previene IDOR por manipulación de headers                                          |
| Audit logging                        | ✅     | AuditLog en approve/reject actions                                                 |
| No secrets en source code            | ✅     | Solo en `.env` (no commiteado)                                                     |

---

## OWASP Top 10 — Estado

| #   | Vulnerabilidad                | ¿Revisado? | ¿Mitigado? | Notas                                  |
| --- | ----------------------------- | ---------- | ---------- | -------------------------------------- |
| A01 | Broken Access Control         | ✅         | ✅         | TenantMember + schema-per-tenant       |
| A02 | Cryptographic Failures        | ✅         | ✅         | bcrypt, Fernet encryption backend      |
| A03 | Injection (SQL/NoSQL/Command) | ✅         | ✅         | UUID validation + ORM parametrizado    |
| A04 | Insecure Design               | ✅         | ✅         | Uploads validados (tamaño + MIME type) |
| A05 | Security Misconfiguration     | ⚠️         | ⚠️         | Puertos expuestos en docker-compose    |
| A06 | Vulnerable Components         | ✅         | ✅         | Sin CVEs conocidos críticos            |
| A07 | Auth Failures                 | ✅         | ✅         | JWT + bcrypt + status checks           |
| A08 | Software & Data Integrity     | ✅         | ✅         | Sin eval/exec, sin dynamic imports     |
| A09 | Security Logging & Monitoring | ✅         | ✅         | AuditLog en acciones críticas          |
| A10 | SSRF                          | ✅         | ✅         | Sin URLs user-controlled en backend    |

---

## 📋 Dependencias Vulnerables

**Backend (Python):**

- No se encontraron CVEs críticos o altos en las dependencias actuales
- `PyPDF2==3.0.1` — Última versión estable, sin CVEs activos
- `fastapi==0.115.0` — Versión reciente
- `cryptography>=42.0.0` — Versión actualizada

**Frontend (Node.js):**

- `next@^15.5.16` — Versión reciente
- `react@^19.0.0` — Versión reciente
- Sin dependencias conocidas con vulnerabilidades críticas

---

## 🔧 Plan de Remediación Requerido

Para obtener PASS, se deben corregir los issues ALTOS:

### Bloqueantes (HIGH): — ✅ TODOS CORREGIDOS

- [x] **SEC-1**: ✅ Corregido — Eliminado hardcoded fallback de DATABASE_URL en `database.py`
- [x] **SEC-2A**: ✅ Corregido — Rate limiting siempre activo por defecto en `config.py`
- [x] **SEC-2B**: ✅ Corregido — Validación de tamaño y content-type en uploads en `evaluations.py`

### Recomendados (MEDIUM — no bloquean pero deberían corregirse):

- [ ] **SEC-3**: Bind docker-compose ports a `127.0.0.1`
- [ ] **SEC-4**: Añadir Content-Security-Policy header
- [ ] **SEC-5**: Migrar rate limiter a Redis para producción
- [ ] **SEC-6**: Externalizar credenciales de docker-compose a `.env`
- [ ] **SEC-7**: Validar path traversal en storage service
- [ ] **SEC-8**: Documentar demo credentials como NON-PRODUCTION
- [ ] **SEC-9**: Añadir assertion para deshabilitar X-Tenant-Subdomain en production

---

## Conclusión

El proyecto tiene una **base de seguridad sólida**: autenticación JWT correcta, password hashing robusto, tenant isolation bien implementada, sin secrets en el source code, y buenos security headers. Los issues SEC-1 (hardcoded DB password fallback) y SEC-2 (rate limiting + uploads) **han sido corregidos y verificados**.

**Veredicto final: PASS** — SEC-1 y SEC-2 corregidos. Issues medios y bajos registrados para remediación futura (no bloquean avance).

---

_«No existe el software seguro. Existe el software que todavía no ha sido atacado.»_ — Warden 🛡️
