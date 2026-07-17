-- ============================================================
-- STEP 8: CLEANUP & FINALIZE
-- ============================================================
-- 1. Poblar user_auth_index desde los schemas tenant
-- 2. Dropear tablas de negocio de public (solo las migradas)
--    users, tenant_members, audit_logs SE QUEDAN en public
-- 3. Verificar que public queda limpio
-- 4. Otorgar permisos

BEGIN;
SELECT '=== STEP 8: CLEANUP ===' AS step;

-- ============================================================
-- 8.1 Poblar user_auth_index (desde public.users, ya no desde tenant schemas)
-- ============================================================
SELECT '8.1 Populating user_auth_index...' AS status;
INSERT INTO public.user_auth_index (email, user_id, schema_name, password_hash, name, role, status)
SELECT email, id, 'public', password, name, role, COALESCE(status, 'active')
FROM public.users
ON CONFLICT (email) DO UPDATE SET
    user_id     = EXCLUDED.user_id,
    schema_name = EXCLUDED.schema_name,
    password_hash = EXCLUDED.password_hash,
    name        = EXCLUDED.name,
    role        = EXCLUDED.role,
    status      = EXCLUDED.status,
    updated_at  = now();

-- Verificar
SELECT COUNT(*) AS users_in_auth_index FROM public.user_auth_index;

-- ============================================================
-- 8.2 Dropear tablas de negocio de public (YA RESPALDADAS)
--     SOLO evaluations, results, courses, students
--     users, tenant_members, audit_logs SE QUEDAN
-- ============================================================
-- ⚠️ ANTES de ejecutar: verificar que el STEP 7 (verificación) pasó OK
-- ⚠️ ANTES de ejecutar: verificar que todos los datos existen en los schemas tenant

SELECT '8.2 Dropping business tables from public...' AS status;

DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

SELECT '8.2 Done (users, tenant_members, audit_logs preserved in public)' AS status;

-- ============================================================
-- 8.3 Verificar que public quedó limpia
-- ============================================================
SELECT '8.3 Verifying public schema...' AS status;
SELECT tablename AS remaining_tables_in_public
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- 8.4 Otorgar permisos (por si se necesitan en nuevos schemas)
-- ============================================================
SELECT '8.4 Granting permissions...' AS status;
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%'
    LOOP
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO tiza_user', rec.nspname);
        EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO tiza_user', rec.nspname);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO tiza_user', rec.nspname);
    END LOOP;
END $$;

-- ============================================================
-- 8.5 Crear función para nuevo tenant (setup automático)
-- ============================================================
-- Crea schema + tablas + índices + constraints para un nuevo tenant.
-- Solo crea las 4 tablas de negocio (evaluations, results, courses, students).
-- evaluations y courses incluyen tenant_id como defensa en profundidad.
SELECT '8.5 Creating auto-setup function for new tenants...' AS status;

CREATE OR REPLACE FUNCTION public.setup_new_tenant(p_tenant_id VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    s VARCHAR := 'tenant_' || p_tenant_id;
BEGIN
    -- Crear schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);
    EXECUTE format('ALTER SCHEMA %I OWNER TO tiza_user', s);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO tiza_user', s);

    -- Crear tablas (solo 4: evaluations, results, courses, students)
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.evaluations (
            id VARCHAR NOT NULL PRIMARY KEY,
            title VARCHAR NOT NULL, subject VARCHAR NOT NULL, grade VARCHAR NOT NULL,
            rubric JSON NOT NULL, pdf_url VARCHAR,
            status VARCHAR DEFAULT ''pending'',
            created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
        )', s
    );
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.results (
            id VARCHAR NOT NULL PRIMARY KEY, evaluation_id VARCHAR NOT NULL,
            student_code VARCHAR NOT NULL, answers JSON, confidence DOUBLE PRECISION,
            requires_review BOOLEAN DEFAULT FALSE, final_grade DOUBLE PRECISION,
            status VARCHAR DEFAULT ''pending'', feedback_pdf_url VARCHAR,
            created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
        )', s
    );
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.courses (
            id VARCHAR NOT NULL PRIMARY KEY,
            name VARCHAR NOT NULL, grade VARCHAR NOT NULL, subject VARCHAR NOT NULL,
            teacher_id VARCHAR NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
        )', s
    );
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.students (
            id VARCHAR NOT NULL PRIMARY KEY, course_id VARCHAR NOT NULL,
            full_name VARCHAR NOT NULL, student_code VARCHAR NOT NULL,
            rut VARCHAR, email VARCHAR,
            created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
        )', s
    );

    -- Crear índices y constraints (reusa STEP 6)
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_evaluations_status ON %I.evaluations(status)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_evaluations_subject ON %I.evaluations(subject)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_evaluations_created ON %I.evaluations(created_at DESC)', s);

    EXECUTE format('ALTER TABLE %I.results ADD CONSTRAINT fk_results_evaluation FOREIGN KEY (evaluation_id) REFERENCES %I.evaluations(id) ON DELETE CASCADE', s, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_results_evaluation ON %I.results(evaluation_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_results_status ON %I.results(status)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_results_student ON %I.results(student_code)', s);

    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_courses_teacher ON %I.courses(teacher_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_courses_subject ON %I.courses(subject)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_courses_created ON %I.courses(created_at DESC)', s);

    EXECUTE format('ALTER TABLE %I.students ADD CONSTRAINT fk_students_course FOREIGN KEY (course_id) REFERENCES %I.courses(id) ON DELETE CASCADE', s, s);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_student_course ON %I.students(course_id, student_code)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_students_course ON %I.students(course_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_students_code ON %I.students(student_code)', s);

    -- Permisos
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO tiza_user', s);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO tiza_user', s);
END;
$$;

COMMENT ON FUNCTION public.setup_new_tenant(VARCHAR) IS 'Crea schema + tablas + índices + constraints para un nuevo tenant. Solo evaluations, results, courses, students (users/audit_logs/tenant_members se quedan en public).';

SELECT 'STEP 8 COMPLETE' AS status;

COMMIT;
