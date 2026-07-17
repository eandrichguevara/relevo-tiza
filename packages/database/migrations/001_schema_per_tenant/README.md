# 001 — Schema-Per-Tenant Migration

## Objetivo

Migrar de `shared-schema` (todas las tablas en `public` con columna `tenant_id`) a `schema-per-tenant`
(cada tenant tiene su propio schema `tenant_{id}`).

Solo **4 tablas de negocio** se migran a tenant schemas: `evaluations`, `results`, `courses`, `students`.
`users`, `audit_logs` y `tenant_members` se quedan en `public`.

## Arquitectura Objetivo

```
public (global)
├── tenants              → Catálogo global de tenants
├── users                → Personas (email único global, FK → tenants.id)
├── tenant_members       → N:M users↔tenants (FK → users.id, FK → tenants.id)
├── audit_logs           → Trazabilidad cross-tenant
├── user_auth_index      → Índice de autenticación (email → schema)
├── find_user_for_auth() → Función de login (busca en user_auth_index)
└── all_users()          → Función que unifica usuarios (opcional, compatibilidad)

tenant_{tenant_uuid} (por tenant)
├── evaluations          → Evaluaciones (aisladas por schema)
├── results              → Resultados (FK a evaluations)
├── courses              → Cursos (aislados por schema)
└── students             → Estudiantes (FK a courses)
```

### Aislamiento por Schema

El schema ya provee aislamiento total de datos. No se necesita la columna `tenant_id`
en las tablas de tenant schemas — el `search_path` de PostgreSQL garantiza que cada
consulta solo ve los datos del schema del tenant actual.

## ¿Por qué este diseño?

1. **Aislamiento parcial**: evaluations, results, courses, students están aislados por tenant.
   Un error en una query del tenant A nunca expone datos del tenant B.

2. **users globales**: los usuarios pueden pertenecer a múltiples tenants (útil para sostenedores
   que administran varios colegios). El email es único global.

3. **tenant_members global**: la relación N:M entre usuarios y tenants se mantiene en public,
   permitiendo membresías cross-tenant sin FKs dinámicas.

4. **audit_logs global**: trazabilidad centralizada sin necesidad de consultar múltiples schemas.

5. **Performance**: índices más pequeños por schema, queries más rápidas para datos transaccionales
   (evaluaciones, cursos, resultados, estudiantes).

6. **Degradación elegante**: un tenant con datos corruptos no afecta a los demás.

## Trade-offs (ponytail)

- `courses.teacher_id` PIERDE la FK constraint a `public.users`. Es VARCHAR sin FK porque
  es cross-schema. → **Validación a nivel aplicación**.

- Ninguna tabla en tenant schemas tiene `tenant_id`. El schema aísla totalmente los datos
  por tenant. Esto simplifica el modelo de datos y elimina redundancia.

- **Autenticación**: el login primero consulta `public.user_auth_index` (poblado desde
  `public.users`), y luego usa el schema del tenant para operaciones de negocio.

- **Nuevos tenants**: crear un tenant requiere ejecutar DDL (CREATE SCHEMA, CREATE TABLE).
  Se provee `public.setup_new_tenant(tenant_id)` para esto.

## Migraciones Futuras

Cuando se agrega una columna o tabla nueva, se debe aplicar a TODOS los schemas.
Para esto se provee:

```bash
# Aplicar una migración a todos los schemas de tenant
psql -d tiza_dev -f apply_to_all_schemas.sql -v migration_file='path/to/migration.sql'
```

O programáticamente:

```python
# Python: aplicar a todos los schemas de tenant
schemas = await db.execute("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\\_%'")
for schema in schemas:
    await db.execute(f"SET search_path TO {schema.nspname}")
    await db.execute(migration_sql)
```

### Estrategia recomendada

1. **Mantener Prisma Schema** apuntando a un schema específico (ej: plantilla `tenant_template`)
2. **Usar un script** que itera sobre todos los schemas `tenant_%` y aplica la migración
3. **Versionar** los cambios en migraciones numeradas dentro de `packages/database/migrations/`

## Archivos de Migración

| Archivo                              | Paso | Descripción                                      |
| ------------------------------------ | ---- | ------------------------------------------------ |
| `001_preflight.sql`                  | 1    | Verifica estado actual, permisos, conexión       |
| `002_create_infrastructure.sql`      | 2    | Crea funciones helper, tablas de ruteo en public |
| `003_generate_tenant_schemas.sql`    | 3    | CREATE SCHEMA por cada tenant                    |
| `004_create_tenant_tables.sql`       | 4    | CREATE TABLE en cada schema (4 tablas)           |
| `005_migrate_data.sql`               | 5    | INSERT...SELECT de public a cada schema          |
| `006_create_indexes_constraints.sql` | 6    | Índices, constraints, FKs intra-schema           |
| `007_verify.sql`                     | 7    | Verificación post-migración                      |
| `008_cleanup.sql`                    | 8    | DROP tablas viejas de public, setup_new_tenant() |
| `009_rollback.sql`                   | 9    | Rollback completo                                |
| `run_all.sh`                         | -    | Orquestador                                      |

## ⚠️ Pre-requisitos

1. Hacer backup: `pg_dump -U tiza_user -d tiza_dev -F c -f backup_before_schema_migration.dump`
2. Detener la aplicación: `docker compose stop api`
3. Ejecutar en orden numerado desde `psql` o `run_all.sh`
4. Verificar con `007_verify.sql`
5. Actualizar código de la aplicación (ver sección "Cambios en App" en cada paso)
6. Re-iniciar la aplicación y probar

## Cambios Requeridos en la Aplicación

### FastAPI (Python)

1. **`database.py`**: Agregar `search_path` dinámico basado en schema del tenant actual
2. **`middleware/tenant.py`**: Resolver no solo tenant_id sino también schema_name
3. **`routers/auth.py`**: Login usa `public.find_user_for_auth()` en vez de query directa a User
4. **`models/db_models.py`**:
   - `User` → se queda en `public.users` (con tenant_id)
   - `Evaluation` → apunta a `{schema}.evaluations` (SIN tenant_id)
   - `Course` → apunta a `{schema}.courses` (SIN tenant_id)
   - `Result` → apunta a `{schema}.results`
   - `Student` → apunta a `{schema}.students`
   - `AuditLog` → se queda en `public.audit_logs` (con tenant_id)
   - `TenantMember` → se queda en `public.tenant_members` (con tenant_id)
