-- ============================================================
-- STEP 1: Preflight — Verificar estado actual
-- ============================================================
-- Este script verifica que la BD está en el estado esperado
-- antes de comenzar la migración.

BEGIN;
SELECT '=== PREFLIGHT CHECK ===' AS step;

-- 1.1 Verificar que existan las tablas esperadas en public
DO $$
DECLARE
    missing_tables TEXT[] := '{}';
    expected_tables TEXT[] := ARRAY['tenants', 'users', 'evaluations', 'results', 'courses', 'students', 'audit_logs', 'tenant_members'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            missing_tables := missing_tables || t;
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'FALTAN tablas en public: %', array_to_string(missing_tables, ',');
    END IF;
END $$;

-- 1.2 Verificar que NO existan schemas tenant_ (migración limpia)
DO $$
DECLARE
    existing_schemas INT;
BEGIN
    SELECT COUNT(*) INTO existing_schemas
    FROM pg_namespace
    WHERE nspname LIKE 'tenant\_%';

    IF existing_schemas > 0 THEN
        RAISE WARNING 'Ya existen % schemas tenant_% — posible migración ya ejecutada', existing_schemas;
    END IF;
END $$;

-- 1.3 Verificar que hay tenants para migrar
DO $$
DECLARE
    tenant_count INT;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM public.tenants;
    IF tenant_count = 0 THEN
        RAISE EXCEPTION 'No hay tenants en la tabla tenants. La migración no tiene sentido.';
    END IF;
    RAISE NOTICE '✓ % tenants encontrados para migrar', tenant_count;
END $$;

-- 1.4 Verificar permisos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tiza_user') THEN
        RAISE EXCEPTION 'El rol tiza_user no existe';
    END IF;
    RAISE NOTICE '✓ Rol tiza_user verificado';
END $$;

-- 1.5 Mostrar resumen
SELECT 'PREFLIGHT OK' AS status, COUNT(*) AS tenant_count FROM public.tenants;

COMMIT;
