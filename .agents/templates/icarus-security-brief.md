# 🛡️ SECURITY BRIEF — OBLIGATORIO antes de implementar

> **Este bloque es inyectado por Prometheus (orquestador) en CUALQUIER delegación a @icarus que involucre:**
> - Autorización / roles
> - Creación de usuarios / tenants
> - Generación de valores aleatorios (passwords, tokens, codes)
> - Mezcla aleatoria de elementos
> - Cambios de estado auditables

## Pre-implementación (checklist obligatorio)

Antes de escribir código, verifica:

- [ ] ¿Leí `.agents/templates/security-patterns.md` completo?
- [ ] ¿Identifiqué qué helpers YA EXISTEN y NO debo reinventar?
  - Auth: `apps/api/utils/security.py` (`require_role`, `require_admin_or_gestion`, `require_super_admin`, `verify_tenant_access`)
  - Audit: modelo `AuditLog` en `apps/api/models/db_models.py:113-129`
  - Crypto FE: `crypto.getRandomValues()` (NUNCA `Math.random()`)
  - Crypto BE: `secrets.choice()`, `secrets.token_hex()` (Python stdlib)
  - Shuffle: Fisher-Yates con crypto (NUNCA `sort(() => Math.random() - 0.5)`)

## Reglas no negociables

1. **Autorización**: Usa `Depends(require_role("GESTION"))` — NUNCA checks inline.
2. **TenantMember**: Si creas un GESTION/ADMIN, crea `TenantMember` con `role="owner"` en la MISMA transacción.
3. **AuditLog**: SIEMPRE emite con `tenant_id`, `user_id`, `action` (whitelist), `resource`, `resource_id`, `details` (con metadata), `ip_address`.
4. **Crypto**: `crypto.getRandomValues()` (FE) o `secrets` (BE). `Math.random()` SOLO para UI no-segura (ej. animación).
5. **Shuffle**: Fisher-Yates con crypto. Prohibido `Array.sort(() => Math.random() - 0.5)`.

## Anti-patterns que BLOQUEAN el merge

```python
# ❌ BLOQUEADO: JWT decode manual
user = jwt.decode(token, SECRET, algorithms=["HS256"])

# ❌ BLOQUEADO: tenant desde header
tenant_id = request.headers.get("X-Tenant-Id")

# ❌ BLOQUEADO: User sin TenantMember
user = User(email=..., role="GESTION", ...)
db.add(user)
await db.commit()  # FALTA TenantMember
```

```typescript
// ❌ BLOQUEADO
const password = chars[Math.floor(Math.random() * chars.length)];

// ❌ BLOQUEADO
arr.sort(() => Math.random() - 0.5);
```

## Post-implementación (autoverificación)

Antes de reportar "implementación completa":

- [ ] ¿Cada endpoint protegido usa `Depends(require_role(...))`?
- [ ] ¿Los nuevos GESTIONs tienen su `TenantMember` creado?
- [ ] ¿Cada cambio de estado emite `AuditLog` con metadata completa?
- [ ] ¿Ningún `Math.random()` en código de seguridad?
- [ ] ¿Ningún shuffle con `Array.sort` + random?
- [ ] ¿Pasaron los tests de seguridad existentes?

## Si encuentras código legacy inseguro

- NO lo corrijas en este PR (a menos que sea trivial).
- Reporta a Prometheus con: `file:line` + SEC-NEW-N + fix propuesto.
- Warden (@warden) revisará en el security gate.

---

**Snippets completos**: Ver `.agents/templates/security-patterns.md`
**Security gate**: El equipo de @warden revisará este cambio. Ahorra re-trabajo siguiendo este brief.
