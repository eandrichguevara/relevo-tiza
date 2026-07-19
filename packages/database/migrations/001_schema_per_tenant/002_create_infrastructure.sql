-- ============================================================
-- STEP 2: Infrastructure — Funciones helper y tabla de ruteo
-- ============================================================
BEGIN;
SELECT '=== STEP 2: INFRASTRUCTURE ===' AS step;

-- ============================================================
-- 2.1 Tabla de índice de autenticación (para login routing)
-- ============================================================
-- Almacena las credenciales mínimas para autenticar usuarios
-- a través de todos los schemas tenant. El email es único global.
--
-- Se mantiene sincronizada:
--   - Al migrar: se puebla con populate_user_auth_index()
--   - En producción: triggers AFTER INSERT/UPDATE ON cada tenant.users
--     o la aplicación la mantiene al crear/actualizar usuarios
CREATE TABLE IF NOT EXISTS public.user_auth_index (
    email           VARCHAR NOT NULL PRIMARY KEY,
    user_id         VARCHAR NOT NULL,
    schema_name     VARCHAR NOT NULL,
    password_hash   VARCHAR NOT NULL,
    name            VARCHAR NOT NULL DEFAULT '',
    role            VARCHAR,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_auth_schema ON public.user_auth_index(schema_name);
CREATE INDEX IF NOT EXISTS ix_user_auth_user_id ON public.user_auth_index(user_id);

COMMENT ON TABLE public.user_auth_index IS 'Índice global de autenticación. Mapea email → schema + credenciales.';
COMMENT ON COLUMN public.user_auth_index.schema_name IS 'Schema tenant_{id} donde reside el usuario';

-- ============================================================
-- 2.2 Función de autenticación — login lookup
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_user_for_auth(p_email VARCHAR)
RETURNS TABLE(
    auth_user_id    VARCHAR,
    auth_schema     VARCHAR,
    auth_email      VARCHAR,
    auth_name       VARCHAR,
    auth_password   VARCHAR,
    auth_role       VARCHAR,
    auth_status     VARCHAR(20)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Buscar en el índice de autenticación (rápido, O(1))
    RETURN QUERY
    SELECT
        uai.user_id,
        uai.schema_name,
        uai.email,
        uai.name,
        uai.password_hash,
        uai.role,
        uai.status::VARCHAR(20)
    FROM public.user_auth_index uai
    WHERE uai.email = p_email
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.find_user_for_auth(VARCHAR) IS 'Busca credenciales de usuario por email en user_auth_index. Rápido O(1).';

-- ============================================================
-- 2.3 Función helper: schema_name desde tenant_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.tenant_schema_name(p_tenant_id VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT 'tenant_' || p_tenant_id;
$$;

COMMENT ON FUNCTION public.tenant_schema_name(VARCHAR) IS 'Convierte tenant_id a nombre de schema: tenant_{uuid}';

-- ============================================================
-- 2.4 Función: poblar user_auth_index desde datos existentes
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_user_auth_index()
RETURNS TABLE(schema_name VARCHAR, users_processed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    rec RECORD;
    cnt INT;
BEGIN
    FOR rec IN
        SELECT nspname FROM pg_namespace
        WHERE nspname LIKE 'tenant\_%'
        ORDER BY nspname
    LOOP
        EXECUTE format(
            'INSERT INTO public.user_auth_index (email, user_id, schema_name, password_hash, name, role, status)
             SELECT email, id, %L, password, name, role, COALESCE(status, ''active'')
             FROM %I.users
             ON CONFLICT (email) DO UPDATE SET
                 user_id     = EXCLUDED.user_id,
                 schema_name = EXCLUDED.schema_name,
                 password_hash = EXCLUDED.password_hash,
                 name        = EXCLUDED.name,
                 role        = EXCLUDED.role,
                 status      = EXCLUDED.status,
                 updated_at  = now()',
            rec.nspname, rec.nspname
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        schema_name := rec.nspname;
        users_processed := cnt;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.populate_user_auth_index() IS 'Puebla/actualiza user_auth_index desde todos los schemas tenant.';

-- ============================================================
-- 2.5 Función: obtener todos los usuarios (admin/global)
-- ============================================================
CREATE OR REPLACE FUNCTION public.all_users()
RETURNS TABLE(
    id              VARCHAR,
    email           VARCHAR,
    name            VARCHAR,
    role            VARCHAR,
    status          VARCHAR(20),
    schema_name     VARCHAR,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT nspname FROM pg_namespace
        WHERE nspname LIKE 'tenant\_%'
        ORDER BY nspname
    LOOP
        RETURN QUERY EXECUTE format(
            'SELECT id, email, name, role, COALESCE(status, ''active'')::VARCHAR(20),
                    %L::VARCHAR AS schema_name, created_at, updated_at
             FROM %I.users',
            rec.nspname, rec.nspname
        );
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.all_users() IS 'Retorna todos los usuarios de todos los tenants. Útil para administración global.';

SELECT 'STEP 2 COMPLETE' AS status;

COMMIT;
