-- ============================================================
-- STEP 3: Generate Tenant Schemas
-- ============================================================
-- Crea un schema `tenant_{id}` por cada tenant en la tabla tenants.
BEGIN;
SELECT '=== STEP 3: CREATE SCHEMAS ===' AS step;

DO $$
DECLARE
    rec RECORD;
    schema_name VARCHAR;
BEGIN
    FOR rec IN SELECT id, subdomain, name FROM public.tenants ORDER BY subdomain
    LOOP
        schema_name := 'tenant_' || rec.id;

        -- Crear schema si no existe
        EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

        -- Asignar owner al usuario de la app
        EXECUTE format('ALTER SCHEMA %I OWNER TO tiza_user', schema_name);

        RAISE NOTICE '✓ Created schema: % (tenant: %)', schema_name, rec.subdomain;
    END LOOP;

    RAISE NOTICE '✓ All tenant schemas created';
END $$;

-- Verificar
SELECT nspname AS created_schemas
FROM pg_namespace
WHERE nspname LIKE 'tenant\_%'
ORDER BY nspname;

COMMIT;
