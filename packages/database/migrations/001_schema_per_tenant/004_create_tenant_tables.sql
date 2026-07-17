-- ============================================================
-- STEP 4: Create Tables in Each Tenant Schema
-- ============================================================
-- Para CADA schema tenant_{id}, crea las 4 tablas de negocio
-- que se migran desde public.
--
-- Las tablas users, audit_logs y tenant_members se quedan en
-- public (NO se crean en tenant schemas).
--
-- evaluations y courses tienen columna tenant_id VARCHAR como
-- defensa en profundidad (SIN FK a public.tenants).
BEGIN;
SELECT '=== STEP 4: CREATE TABLES ===' AS step;

DO $$
DECLARE
    rec RECORD;
    s VARCHAR;  -- schema name
BEGIN
    FOR rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%' ORDER BY nspname
    LOOP
        s := rec.nspname;

        -- ============================================================
        -- 4.1 evaluations (sin tenant_id — el schema aísla los datos)
        -- ============================================================
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.evaluations (
                id          VARCHAR NOT NULL PRIMARY KEY,
                title       VARCHAR NOT NULL,
                subject     VARCHAR NOT NULL,
                grade       VARCHAR NOT NULL,
                rubric      JSON NOT NULL,
                pdf_url     VARCHAR,
                status      VARCHAR DEFAULT ''pending'',
                created_at  TIMESTAMPTZ DEFAULT now(),
                updated_at  TIMESTAMPTZ DEFAULT now()
            )', s
        );

        -- ============================================================
        -- 4.2 results (sin tenant_id — hereda contexto via FK a evaluations)
        -- ============================================================
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.results (
                id               VARCHAR NOT NULL PRIMARY KEY,
                evaluation_id    VARCHAR NOT NULL,
                student_code     VARCHAR NOT NULL,
                answers          JSON,
                confidence       DOUBLE PRECISION,
                requires_review  BOOLEAN DEFAULT FALSE,
                final_grade      DOUBLE PRECISION,
                status           VARCHAR DEFAULT ''pending'',
                feedback_pdf_url VARCHAR,
                created_at       TIMESTAMPTZ DEFAULT now(),
                updated_at       TIMESTAMPTZ DEFAULT now()
            )', s
        );

        -- ============================================================
        -- 4.3 courses (sin tenant_id — el schema aísla los datos)
        -- teacher_id es VARCHAR sin FK — referencia a public.users
        -- (no existe FK cross-schema)
        -- ============================================================
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.courses (
                id          VARCHAR NOT NULL PRIMARY KEY,
                name        VARCHAR NOT NULL,
                grade       VARCHAR NOT NULL,
                subject     VARCHAR NOT NULL,
                teacher_id  VARCHAR NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT now(),
                updated_at  TIMESTAMPTZ DEFAULT now()
            )', s
        );

        -- ============================================================
        -- 4.4 students (sin tenant_id — hereda contexto via FK a courses)
        -- ============================================================
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.students (
                id           VARCHAR NOT NULL PRIMARY KEY,
                course_id    VARCHAR NOT NULL,
                full_name    VARCHAR NOT NULL,
                student_code VARCHAR NOT NULL,
                rut          VARCHAR,
                email        VARCHAR,
                created_at   TIMESTAMPTZ DEFAULT now(),
                updated_at   TIMESTAMPTZ DEFAULT now()
            )', s
        );

        RAISE NOTICE '✓ Created 4 tables in schema: %', s;
    END LOOP;

    RAISE NOTICE '✓ All tenant tables created successfully';
END $$;

-- Verificar conteo de tablas por schema (esperado: 4)
SELECT
    nspname AS schema_name,
    COUNT(*) AS table_count
FROM pg_namespace ns
JOIN pg_tables t ON t.schemaname = ns.nspname
WHERE ns.nspname LIKE 'tenant\_%'
GROUP BY nspname
ORDER BY nspname;

COMMIT;
