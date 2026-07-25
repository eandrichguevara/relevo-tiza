# Squad Go Security Flow

> **Propósito**: Documentar el flujo optimizado del Squad Go para features que involucran seguridad (autorización, usuarios, crypto, auditoría).

## Antecedentes

El feature "ADMIN puede crear GESTION" (julio 2026) costó **12 tasks y ~$6.15 en tokens de seguridad** porque @warden encontró 6 issues retroactivos que requirieron 2 rondas de fixes. Este flujo busca reducir eso a **3-5 tasks y ~$1.25**.

### Timeline del Caso Histórico

| # | Agente | Tarea | Costo |
|---|--------|-------|-------|
| 1 | @argus | Explorar estructura del proyecto | ~$0.15 |
| 2 | @argus | Identificar creación de usuarios existente | ~$0.15 |
| 3 | @argus | Leer archivos clave (security.py, routers, models) | ~$0.15 |
| 4 | @icarus | Implementar backend (endpoint + lógica) | ~$0.80 |
| 5 | @icarus | Implementar frontend (UI + formulario) | ~$0.80 |
| 6 | @warden | Security gate → encontró 5 issues | ~$0.30 |
| 7 | @icarus | Fix SEC-1 (TenantMember) + SEC-2 (AuditLog) | ~$0.80 |
| 8 | @icarus | Fix SEC-3 (comentario schema) + SEC-5 (crypto.getRandomValues) | ~$0.80 |
| 9 | @icarus | SEC-4: tests | ~$0.80 |
| 10 | @warden | Re-revisión → encontró SEC-NEW-2 (Fisher-Yates) | ~$0.30 |
| 11 | @icarus | Fix SEC-NEW-2 (Fisher-Yates con crypto) | ~$0.80 |
| 12 | @lynx | Validar UI del formulario | ~$0.15 |
| 13 | — | Validar compilación | ~$0.15 |
| | **Total** | **13 acciones** | **~$6.15** |

## El Anti-Patrón: Security Gate Reactivo

```
Tarea → @argus (explorar) → @icarus (impl) → @warden (GATE)
                                                  │
                                       ┌──────────┴──────────┐
                                       │  FAIL (6 issues)     │
                                       └──────────┬──────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                       │                       │
                    @icarus (fix SEC-1&2)   @icarus (fix SEC-3&5)   @icarus (fix SEC-4)
                          │                       │                       │
                          └───────────────────────┼───────────────────────┘
                                                  │
                                          @warden (re-review)
                                                  │
                                       ┌──────────┴──────────┐
                                       │  FAIL (SEC-NEW-2)    │
                                       └──────────┬──────────┘
                                                  │
                                          @icarus (fix)
                                                  │
                                       @lynx (UI validate)
                                       @compile (validate)
                                                  │
                                               COMPLETE
```

### Costos del Flujo Reactivo

| Agente | Tasks | Costo/task | Subtotal | % del total |
|--------|-------|-----------|----------|-------------|
| @argus (exploración) | 3 | ~$0.15 | ~$0.45 | 7% |
| @icarus (implementación inicial) | 2 | ~$0.80 | ~$1.60 | 26% |
| @icarus (fixes retroactivos) | 4 | ~$0.80 | ~$3.20 | 52% |
| @warden (gate + re-revisión) | 2 | ~$0.30 | ~$0.60 | 10% |
| @lynx (validación UI) | 1 | ~$0.15 | ~$0.15 | 2% |
| Validación (compilación) | 1 | ~$0.15 | ~$0.15 | 2% |
| **Total** | **13** | | **~$6.15** | **100%** |

> **Insight**: El 52% del costo se fue en fixes retroactivos de seguridad. Cada fix de @icarus costó ~$0.80, mientras que la prevención (pre-check de @argus) cuesta ~$0.15.

## El Nuevo Flujo: Pre-Check + Brief Injection

```
                        ┌─────────────────────────┐
                        │  Tarea sensible detectada │
                        │  (trigger keywords match) │
                        └────────────┬────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 🟢 @argus (PRE-CHECK, ~$0.15, 5-10 min)                    │
│                                                             │
│  ┌─ Output: lista de file:line refs + snippets referencia   │
│  └─ Identifica helpers existentes, patrones a usar          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 🟡 @icarus (IMPLEMENT, ~$0.80, 15-30 min)                   │
│                                                             │
│  ┌─ Security brief inyectado automáticamente por Prometheus │
│  ├─ Lee `.agents/templates/security-patterns.md` ANTES      │
│  ├─ Aplica checklist pre-implementación                     │
│  ├─ Implementa con patrones correctos desde el inicio       │
│  └─ Autoverifica con checklist post-implementación          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 🛡️ @warden (FAST GATE, ~$0.30, 5-10 min)                   │
│                                                             │
│  ┌─ Revisa SOLO el diff (no full scan)                      │
│  ├─ PASS → FIN                                              │
│  └─ FAIL (0-1 issues máx) → @icarus fix rápido (sin re-rev) │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                        COMPLETE
                    (3-5 tasks, ~$1.25)
```

### Costos del Flujo Preventivo

| Agente | Tasks | Costo/task | Subtotal | % del total |
|--------|-------|-----------|----------|-------------|
| @argus (pre-check) | 1 | ~$0.15 | ~$0.15 | 12% |
| @icarus (implementación con brief) | 1-2 | ~$0.80 | ~$0.80-1.60 | 64% |
| @warden (fast gate) | 1 | ~$0.30 | ~$0.30 | 24% |
| @lynx (validación UI, opcional) | 0-1 | ~$0.15 | ~$0-0.15 | 0-12% |
| **Total** | **3-5** | | **~$1.25-2.05** | **100%** |

## Trigger Keywords

Lista de palabras que activan el flujo seguro (definida en `prometheus/SKILL.md:58-65`):

```
- role, user, admin, gestion, teacher, permission
- tenant, tenantMember, multi-tenant
- password, token, secret, api_key, invite code
- audit, auditLog, log
- auth, authentication, authorization
- crypto, random, shuffle, seed
```

Si el prompt de una tarea contiene alguna de estas palabras, Prometheus DEBE:

1. Activar el flujo de 3 pasos (pre-check → implement con brief → fast gate)
2. Inyectar el security brief al final del prompt de @icarus
3. NO delegar a @icarus sin el brief

## Archivos Involucrados

| Archivo | Líneas | Rol |
|---------|--------|-----|
| `.agents/templates/security-patterns.md` | 442 | Snippets copy-paste por categoría — 8 secciones: autorización, multi-tenant, auditoría, crypto FE/BE, shuffle, checklist, modelo AuditLog, referencias |
| `.agents/templates/icarus-security-brief.md` | 73 | Bloque de inyección para prompts de @icarus — checklist pre/post, anti-patrones, reglas no negociables |
| `~/.config/opencode/.agents/skills/prometheus/SKILL.md` | 137 | Lógica de auto-inyección — trigger keywords (líneas 58-65), flujo seguro en 3 pasos (líneas 67-85), brief template (líneas 87-109) |
| `WARDEN_SECURITY_REPORT.md` | 371 | Reporte histórico de issues — 15 issues (2 altos, 7 medios, 6 bajos), veredicto PASS con remediaciones |

### Dependencias entre archivos

```
prometheus/SKILL.md
  ├── trigger keywords ───────────────→ Detección de tarea sensible
  ├── inyecta brief ──────────────────→ icarus-security-brief.md (73 lines)
  └── referencia a patrones ─────────→ security-patterns.md (442 lines)
        └── referencias código ───────→ apps/api/utils/security.py
                                        apps/api/routers/users.py
                                        apps/api/models/db_models.py
                                        apps/relevo-web/src/lib/crypto.ts
```

## Patrones Cubiertos

### 1. Autorización (Backend Python FastAPI)

**Helpers** en `apps/api/utils/security.py`:

| Helper | Línea | Uso |
|--------|-------|-----|
| `require_role(role)` | 131-137 | Protege endpoints por rol específico |
| `require_super_admin` | 140-148 | Solo ADMIN, sin bypass |
| `require_admin_or_gestion` | 150-161 | ADMIN multi-tenant, GESTION tenant-scoped |
| `get_current_user` | 65-128 | Autenticación base + status checks |
| `verify_tenant_access` | 197-234 | Verifica acceso al tenant resuelto |

**Regla**: Usar `Depends(require_role("GESTION"))` — NUNCA checks inline como `if user.role != "ADMIN"`.

### 2. Multi-tenant (TenantMember + User)

**Snippet** en `apps/api/routers/users.py:97-106`:
```python
if resolved_role == "GESTION":
    member = TenantMember(
        tenant_id=body.tenant_id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)
```

**Regla**: User + TenantMember en la **MISMA transacción** (`db.commit()` único). GESTION/ADMIN → `role="owner"`, TEACHER → `role="member"`.

### 3. Auditoría (AuditLog)

**Modelo** en `apps/api/models/db_models.py:113-129`:
```python
class AuditLog(Base):
    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True))
```

**Regla**: Emitir después de flush, antes de commit. Siempre con `tenant_id`, `user_id`, `action`, `resource`, `resource_id`, `details`, `ip_address`.

### 4. Crypto Frontend (TypeScript)

**Helper** en `apps/relevo-web/src/lib/crypto.ts`:
```typescript
export function secureRandomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! % max;
}
```

**Anti-patrón**: `Math.random()` para contraseñas, tokens, códigos de invitación.

### 5. Crypto Backend (Python)

**Helper** estándar:
```python
import secrets, string
def generate_temp_password(length: int = 14) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%&*"
    return ''.join(secrets.choice(chars) for _ in range(length))
```

### 6. Shuffle (Fisher-Yates con crypto)

**Snippet** en `apps/relevo-web/src/app/(dashboard)/dashboard/usuarios/page.tsx:43-66`:
```typescript
const arr = [...required, ...remaining];
for (let i = arr.length - 1; i > 0; i--) {
  const j = randomIndex(i + 1);
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
```

**Anti-patrón**: `Array.sort(() => Math.random() - 0.5)` — tiene sesgo de orden y no es criptográficamente seguro.

## Métricas Esperadas

| Métrica | Antes (reactivo) | Después (preventivo) | Mejora |
|---------|------------------|----------------------|--------|
| Tasks por feature sensible | 12-13 | 3-5 | -60% |
| SEC fixes retroactivos | 6 | 0-1 | -85% |
| Re-revisiones de @warden | 1-2 | 0-1 | -50% |
| Costo en tokens (USD) | ~$6.15 | ~$1.25 | -80% |
| Tiempo total estimado | ~3-4 horas | ~1-1.5 horas | -60% |

### Fórmula de Cálculo

```
Costo reactivo = (N_argus × $0.15) + (N_icarus × $0.80) + (N_warden × $0.30) + (N_lynx × $0.15)
Caso histórico: (3 × $0.15) + (6 × $0.80) + (2 × $0.30) + (1 × $0.15) = $0.45 + $4.80 + $0.60 + $0.15 = $6.00
(+ validación: $0.15) = ~$6.15

Costo preventivo = (1 × $0.15) + (1 × $0.80) + (1 × $0.30) = $1.25
(con opción de 2do @icarus: $2.05)
```

## Cuando NO Aplicar Este Flujo

- **Features puramente UI** (sin lógica de seguridad, ej: cambiar color de un botón)
- **Refactors de código** que no tocan auth/users/crypto/audit
- **Bug fixes** que no requieren nuevos permisos ni creación de usuarios
- **Cambios de dependencias o infra** (eso va por @vault)
- **Features existentes** donde solo se modifica lógica de negocio interna (sin nuevos endpoints expuestos)

Si hay duda: aplicar el flujo. El pre-check de @argus cuesta solo ~$0.15.

## Onboarding para Nuevos Agentes

### Para @argus

1. **Al recibir una tarea**: verifica si contiene trigger keywords (ver sección arriba)
2. **Si hay match**: ejecuta pre-check:
   - Busca helpers existentes en `apps/api/utils/security.py`
   - Busca snippets relevantes en `.agents/templates/security-patterns.md`
   - Identifica el patrón específico que aplica (autorización, tenant, auditoría, crypto, shuffle)
3. **Output esperado**: `file:line` refs de helpers + snippets + enlace al patrón en el template
4. **NO analices** ni decidas qué patrón usar — solo encuentra y reporta

### Para @icarus

1. **Antes de implementar**: lee SIEMPRE `.agents/templates/security-patterns.md` completo
2. **Aplica checklist pre-implementación** (sección 6 del template):
   - [ ] ¿Usé `Depends(require_role(...))` en vez de check inline?
   - [ ] ¿Creé `TenantMember` si el usuario es GESTION/ADMIN?
   - [ ] ¿User + TenantMember en la misma transacción?
   - [ ] ¿Emití `AuditLog` con TODOS los campos?
   - [ ] ¿Usé `crypto.getRandomValues()` (FE) o `secrets` (BE)?
   - [ ] ¿Usé Fisher-Yates con crypto para shuffles?
3. **Anti-patrones que BLOQUEAN**: `Math.random()`, `sort(() => Math.random())`, JWT decode manual, User sin TenantMember
4. **Post-implementación**: corre el checklist de autoverificación (brief.md:57-62)
5. **Si encuentras código legacy inseguro**: no lo corrijas en este PR — reporta a Prometheus con `file:line` + SEC-NEW-N

### Para @warden

1. **Al recibir un diff con pre-check aplicado**: haz fast gate
2. **Revisa SOLO el diff** — no necesitas full scan si el pre-check fue correcto
3. **Expectativa**: 0-1 issues máximo (vs 6 en el flujo reactivo)
4. **Si hay issues**: escala a @icarus con contexto ya conocido → no requiere re-revisión completa
5. **Si PASS**: informa a Prometheus para cerrar el feature

### Para @lynx

1. **Solo cuando haya cambios UI** que ameriten validación visual
2. **1 task = 1 screenshot** — no mezcles múltiples validaciones en un solo prompt
3. **Analiza, no ejecutes**: solo usas `read` para ver imágenes

## Referencias

- Security patterns detallados: `.agents/templates/security-patterns.md`
- Brief para implementación: `.agents/templates/icarus-security-brief.md`
- Reporte histórico de Warden: `WARDEN_SECURITY_REPORT.md` (371 líneas, 15 issues)
- Orquestación: `~/.config/opencode/.agents/skills/prometheus/SKILL.md` (137 líneas)
- Proyecto general: `AGENTS.md`

## Changelog

| Fecha | Cambio | Detalle |
|-------|--------|---------|
| **2026-07-24** | Flujo creado | Tras feature ADMIN→GESTION. Templates inicializados con 6 patrones. Métricas baseline: 12 tasks, 6 fixes, 1 re-revisión. Costo reactivo documentado: ~$6.15. |
| **2026-07-18** | Reporte Warden | Warden emite reporte de seguridad completo (WARDEN_SECURITY_REPORT.md) con 15 issues — catalizador del nuevo flujo. |
