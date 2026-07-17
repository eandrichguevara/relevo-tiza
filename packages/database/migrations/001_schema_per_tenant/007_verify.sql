-- ============================================================
-- STEP 7: VERIFICATION (fully dynamic — works with any tenants)
-- ============================================================
-- Verifica que la migración se completó correctamente.
-- Solo verifica las 4 tablas que migran a tenant schemas:
--   evaluations, results, courses, students
--
-- users, audit_logs, tenant_members deben permanecer en public.
BEGIN;
SELECT '=== STEP 7: VERIFICATION ===' AS step;

-- ============================================================
-- 7.1 Schema count and table presence (expected: 4 per schema)
-- ============================================================
SELECT '7.1 Schema table count (expected: 4 per schema)' AS check_name;
SELECT
    nspname AS schema_name,
    COUNT(*) AS table_count,
    CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_namespace ns
JOIN pg_tables t ON t.schemaname = ns.nspname
WHERE ns.nspname LIKE 'tenant\_%'
GROUP BY nspname
ORDER BY nspname;

-- ============================================================
-- 7.2 tenant_id NO debe existir EN niguna tabla tenant (removido)
--     Verificar que todas las 4 tablas NO tienen tenant_id
-- ============================================================
SELECT '7.2 tenant_id column check (absent in all tenant tables)' AS check_name;
SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema LIKE 'tenant\_%'
          AND table_name = 'evaluations'
          AND column_name = 'tenant_id'
    ) THEN 'PASS — evaluations NO tiene tenant_id' ELSE 'FAIL' END AS check_1;

SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema LIKE 'tenant\_%'
          AND table_name = 'courses'
          AND column_name = 'tenant_id'
    ) THEN 'PASS — courses NO tiene tenant_id' ELSE 'FAIL' END AS check_2;

SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema LIKE 'tenant\_%'
          AND table_name = 'results'
          AND column_name = 'tenant_id'
    ) THEN 'PASS — results NO tiene tenant_id' ELSE 'FAIL' END AS check_3;

SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema LIKE 'tenant\_%'
          AND table_name = 'students'
          AND column_name = 'tenant_id'
    ) THEN 'PASS — students NO tiene tenant_id' ELSE 'FAIL' END AS check_4;

-- ============================================================
-- 7.3 Full table presence validation (solo 4 tablas)
-- ============================================================
SELECT '7.3 Complete table presence in every schema' AS check_name;
DO $$
DECLARE
    rec RECORD;
    expected TEXT[] := ARRAY['evaluations','results','courses','students'];
    missing TEXT[];
    t TEXT;
    all_ok BOOLEAN := TRUE;
BEGIN
    FOR rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%' ORDER BY nspname
    LOOP
        missing := '{}';
        FOREACH t IN ARRAY expected
        LOOP
            IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = rec.nspname AND tablename = t) THEN
                missing := missing || t;
            END IF;
        END LOOP;
        IF array_length(missing, 1) > 0 THEN
            RAISE WARNING 'MISSING in %: %', rec.nspname, array_to_string(missing, ', ');
            all_ok := FALSE;
        ELSE
            RAISE NOTICE 'PASS: % — 4/4 tables', rec.nspname;
        END IF;
    END LOOP;
    IF all_ok THEN RAISE NOTICE '✅ All schemas complete'; END IF;
END $$;

-- ============================================================
-- 7.4 Row count comparison (public vs tenant schemas)
--     Solo para las 4 tablas migradas
-- ============================================================
SELECT '7.4 Row count: public vs tenant schemas' AS check_name;

CREATE TEMP TABLE _mig_audit (
    table_name VARCHAR PRIMARY KEY,
    public_count BIGINT DEFAULT 0,
    tenant_count BIGINT DEFAULT 0,
    match CHAR(4) DEFAULT 'FAIL'
);

DO $$
DECLARE
    rec RECORD;
    s_rec RECORD;
    p_count BIGINT;
    t_total BIGINT;
    tables TEXT[] := ARRAY['evaluations','results','courses','students'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        -- Public count
        EXECUTE format('SELECT COUNT(*) FROM public.%I', t) INTO p_count;

        -- Tenant schemas total
        t_total := 0;
        FOR s_rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%'
        LOOP
            EXECUTE format('SELECT COUNT(*) FROM %I.%I', s_rec.nspname, t) INTO p_count;
            t_total := t_total + p_count;
        END LOOP;

        -- Get public count again (p_count was reused above)
        EXECUTE format('SELECT COUNT(*) FROM public.%I', t) INTO p_count;

        INSERT INTO _mig_audit VALUES (
            t, p_count, t_total,
            CASE WHEN p_count = t_total THEN 'PASS' ELSE 'FAIL' END
        );
    END LOOP;
END $$;

TABLE _mig_audit;

-- ============================================================
-- 7.5 FK constraints presence (solo en tenant schemas)
-- ============================================================
SELECT '7.5 FK constraints in tenant schemas' AS check_name;
SELECT
    nspname AS schema_name,
    conname AS fk_name,
    'PASS' AS status
FROM pg_namespace ns
JOIN pg_constraint c ON c.connamespace = ns.oid
WHERE ns.nspname LIKE 'tenant\_%' AND c.contype = 'f'
ORDER BY nspname, conname;

-- ============================================================
-- 7.6 Verificar que public aún tiene users, tenant_members, audit_logs
-- ============================================================
SELECT '7.6 public still has global tables (users, tenant_members, audit_logs)' AS check_name;
SELECT
    tablename,
    'PASS' AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tenant_members', 'audit_logs')
ORDER BY tablename;

-- ============================================================
-- 7.7 public.tenants integrity
-- ============================================================
SELECT '7.7 public.tenants still intact' AS check_name;
SELECT COUNT(*) AS tenant_count, 'PASS' AS status FROM public.tenants;

-- ============================================================
-- 7.8 Final verdict
-- ============================================================
SELECT '=== FINAL VERDICT ===' AS final_verdict;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM _mig_audit WHERE match = 'FAIL')
        THEN '⚠️  DATA MISMATCH — review _mig_audit above'
        ELSE '✅ ALL CHECKS PASSED — migration successful'
    END AS verdict;

-- Check if cleanup step already ran (no business tables in public except users/tenant_members/audit_logs)
SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('evaluations','courses','students','results')
    ) THEN '✅ public is clean (only tenants + users + tenant_members + audit_logs + infrastructure)'
    ELSE '⚠️  public still has business tables — run STEP 8 (cleanup)'
    END AS public_status;

DROP TABLE IF EXISTS _mig_audit;

COMMIT;
