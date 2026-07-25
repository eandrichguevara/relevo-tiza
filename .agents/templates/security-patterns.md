# Security Patterns — RELEVO/TIZA

> **USO**: @icarus DEBE leer este archivo antes de implementar cualquier feature que involucre:
> - Autorización por roles
> - Creación de usuarios / tenants
> - Generación de datos aleatorios (passwords, tokens, codes)
> - Mezcla/orden aleatorio de elementos
> - Cualquier cambio de estado que requiera auditoría

---

## 1. AUTORIZACIÓN (Backend Python FastAPI)

### ✅ PATRÓN CORRECTO — Usar helpers existentes

**Helper location:** `apps/api/utils/security.py`

#### `require_role(role)` — línea 131-137

```python
def require_role(role: str):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != role and current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail=f"Se requiere rol {role}")
        return current_user

    return role_checker
```

#### `require_super_admin` — línea 140-148

```python
async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Strict super_admin dependency — only ADMIN role allowed, no bypass."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren privilegios de administrador para esta operación.",
        )
    return current_user
```

#### `require_admin_or_gestion` — línea 150-161

```python
async def require_admin_or_gestion(current_user: User = Depends(get_current_user)) -> User:
    """Allows ADMIN or GESTION roles. Used for tenant-scoped approval endpoints.
    
    ADMIN can approve/reject users across all tenants.
    GESTION can only approve/reject TEACHERs within their own tenant.
    """
    if current_user.role not in ("ADMIN", "GESTION"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren privilegios de administrador o director para esta operación.",
        )
    return current_user
```

#### `get_current_user` — línea 65-128

```python
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    # Check user status — block non-active users from accessing protected endpoints
    if user.status != "active":
        if user.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas acceder.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif user.status == "rejected":
            reason = f" Motivo: {user.rejection_reason}" if user.rejection_reason else ""
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Tu cuenta ha sido rechazada.{reason}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif user.status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tu cuenta ha sido suspendida. Contacta al administrador.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Force password change for provisional passwords
    if user.must_change_password:
        path = request.url.path if request else ""
        allowed_paths = {
            "/api/auth/change-password",
            "/api/auth/change-password/",
            "/api/auth/session",
            "/api/auth/session/",
            "/api/auth/me",
            "/api/auth/me/",
        }
        if path not in allowed_paths:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Debes cambiar tu contraseña provisoria antes de acceder a la plataforma.",
            )

    return user
```

#### `verify_tenant_access` — línea 197-234

```python
async def verify_tenant_access(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verify the authenticated user has access to the resolved tenant.

    Used as a FastAPI dependency. Must be called AFTER get_current_user.
    Injects: request.state.tenant_id and request.state.brand via TenantMiddleware.

    Raises:
        404: No tenant context available
        403: User does not have access to this tenant
    """
    tenant_id = get_tenant_id(request)

    # Admin can access everything
    if current_user.role == "ADMIN":
        return current_user

    # Direct tenant match (user's default tenant)
    if current_user.tenant_id == tenant_id:
        return current_user

    # Multi-tenant: check TenantMember membership
    membership = await db.execute(
        select(TenantMember).where(
            TenantMember.tenant_id == tenant_id,
            TenantMember.user_id == current_user.id,
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado a este colegio",
        )

    return current_user
```

### ❌ ANTI-PATRÓN — NUNCA hacer esto

```python
# ❌ MAL: decodificar JWT manual
user = jwt.decode(token, SECRET)

# ❌ MAL: check de rol inline
if user.role != "ADMIN":
    raise HTTPException(403)

# ❌ MAL: aceptar X-Tenant-Id header
tenant_id = request.headers.get("X-Tenant-Id")
```

### ✅ EJEMPLO COMPLETO — Endpoint protegido

```python
@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    request: Request,
    current_user: User = Depends(require_role("GESTION")),
    db: AsyncSession = Depends(get_db),
):
    # ... lógica
```

---

## 2. CREACIÓN DE USUARIOS + TENANTMEMBER

### ✅ PATRÓN CORRECTO — Transacción única

Snippet de `apps/api/routers/users.py:97-106`:

```python
    # SEC-1: Create TenantMember for GESTION so they can operate within the tenant
    if resolved_role == "GESTION":
        member = TenantMember(
            tenant_id=body.tenant_id,
            user_id=user.id,
            role="owner",
        )
        db.add(member)
```

Snippet de `apps/api/routers/auth.py:162-168` (registro):

```python
    # Add user as a member of their tenant (tenant isolation)
    member = TenantMember(
        tenant_id=tenant_id,
        user_id=user.id,
        role="owner" if resolved_role in ("GESTION", "ADMIN") else "member",
    )
    db.add(member)
```

### ❌ ANTI-PATRÓN — NUNCA olvidar TenantMember

```python
# ❌ MAL: crear User sin TenantMember
user = User(email=..., role="GESTION", ...)
db.add(user)
await db.commit()
# FALTA: crear TenantMember → GESTION no puede operar en el tenant
```

### 📋 REGLAS

- **GESTION/ADMIN** → `TenantMember.role = "owner"`
- **TEACHER** → `TenantMember.role = "member"` (o no crear, hereda de `user.tenant_id`)
- **MISMA TRANSACCIÓN**: User + TenantMember en un solo `db.commit()`

---

## 3. AUDIT LOG

### ✅ PATRÓN CORRECTO — Emitir después de flush, antes de commit

Snippet de `apps/api/routers/users.py:108-124`:

```python
    audit = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=body.tenant_id,
        user_id=current_user.id,
        action="user_created",
        resource="user",
        resource_id=user.id,
        details={
            "target_email": user.email,
            "target_role": resolved_role,
            "creator_role": current_user.role,
        },
        ip_address=request.client.host if request.client else "unknown",
    )
    db.add(audit)
    await db.commit()
```

### ❌ ANTI-PATRÓN — NUNCA emitir AuditLog sin metadata

```python
# ❌ MAL: sin details
audit = AuditLog(action="user_created", resource="user")
# FALTA: tenant_id, user_id, resource_id, details
```

### 📋 ACCIONES ESTÁNDAR (whitelist)

| action | resource | Cuándo emitir |
|--------|----------|---------------|
| `user_created` | `user` | POST /users (admin crea usuario) |
| `user_approved` | `user` | POST /admin/users/:id/approve |
| `user_rejected` | `user` | POST /admin/users/:id/reject |
| `password_reset` | `user` | POST /users/:id/reset-password |

**NUEVAS acciones**: agregar a esta tabla antes de usar.

---

## 4. CRYPTO / RANDOM

### ✅ FRONTEND (TypeScript) — `crypto.getRandomValues()`

**Helper copy-paste:**

```typescript
// apps/relevo-web/src/lib/crypto.ts (CREAR si no existe)
export function secureRandomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! % max;
}
```

### ❌ NUNCA usar `Math.random()` para:

- Generación de contraseñas
- Tokens
- Códigos de invitación
- Selección aleatoria de elementos sensibles

```typescript
// ❌ MAL
const password = Array.from({length: 14}, () => chars[Math.floor(Math.random() * chars.length)]).join('');

// ✅ BIEN
const password = Array.from({length: 14}, () => chars[secureRandomIndex(chars.length)]).join('');
```

### ✅ BACKEND (Python) — `secrets` stdlib

```python
import secrets
import string

def generate_temp_password(length: int = 14) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%&*"
    return ''.join(secrets.choice(chars) for _ in range(length))
```

---

## 5. SHUFFLE / MEZCLA ALEATORIA

### ✅ PATRÓN CORRECTO — Fisher-Yates con crypto

Snippet de `apps/relevo-web/src/app/(dashboard)/dashboard/usuarios/page.tsx:43-66`:

```typescript
function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  // Pick random index from a string using crypto.getRandomValues
  const randomIndex = (max: number): number => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0]! % max;
  };

  // Ensure at least one of each category
  const required = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    special[randomIndex(special.length)],
  ];

  // Fill the rest randomly
  const remaining = Array.from({ length: 10 }, () => all[randomIndex(all.length)]);

  // Fisher-Yates shuffle for uniform distribution
  const arr = [...required, ...remaining];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}
```

### ❌ NUNCA usar:

```typescript
// ❌ MAL: sesgo de orden
arr.sort(() => Math.random() - 0.5);

// ❌ MAL: Fisher-Yates con Math.random
for (let i = arr.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));  // predecible
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
```

---

## 6. CHECKLIST PRE-IMPLEMENTACIÓN (para @icarus)

Antes de escribir CUALQUIER endpoint que involucre los puntos anteriores, verificar:

- [ ] ¿Usé `Depends(require_role(...))` en vez de check inline?
- [ ] ¿Creé `TenantMember` si el usuario es GESTION/ADMIN?
- [ ] ¿User + TenantMember en la misma transacción?
- [ ] ¿Emití `AuditLog` con TODOS los campos (tenant_id, user_id, action, resource, resource_id, details, ip_address)?
- [ ] ¿Usé `crypto.getRandomValues()` (frontend) o `secrets` (backend) en vez de `Math.random()`?
- [ ] ¿Usé Fisher-Yates con crypto para shuffles?
- [ ] ¿Mi `action` de AuditLog está en la whitelist o la agregué a la tabla?

Si respondiste NO a cualquiera → **DETENTE** y revisa este template.

---

## 7. MODELO AUDITLOG

Snippet de `apps/api/models/db_models.py:113-129`:

```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_tenant_id", "tenant_id"),
        Index("ix_audit_user_id", "user_id"),
        Index("ix_audit_created_at", "created_at"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

---

## 8. REFERENCIAS

- Warden's security report: `WARDEN_SECURITY_REPORT.md`
- Helpers de auth: `apps/api/utils/security.py`
- Modelo AuditLog: `apps/api/models/db_models.py:113-129`
- Schema Prisma: `packages/database/prisma/schema.prisma`
- Feature reference (ADMIN→GESTION): commits del 2026-07-22 a 2026-07-24
