-- ============================================================
-- STEP 9: ROLLBACK — Revertir migración schema-per-tenant
-- ============================================================
-- Revierte la migración para las 4 tablas movidas a tenant schemas:
--   evaluations, results, courses, students
--
-- users, tenant_members, audit_logs SIEMPRE estuvieron en public,
-- así que NO necesitan ser restaurados.
--
-- 1. Restaura datos de schemas tenant a public
-- 2. Dropea schemas tenant
-- 3. Dropea infraestructura de migración
-- 4. Restaura índices y constraints originales en public
--
-- ⚠️ Ejecutar SOLO si la migración falló o necesita revertirse
-- ⚠️ Se requiere un backup completo antes de ejecutar

BEGIN;
SELECT '=== STEP 9: ROLLBACK ===' AS step;

-- ============================================================
-- 9.1 Verificar que los datos existen en schemas tenant
-- ============================================================
DO $$
DECLARE
    schema_count INT;
BEGIN
    SELECT COUNT(*) INTO schema_count
    FROM pg_namespace WHERE nspname LIKE 'tenant\_%';

    IF schema_count = 0 THEN
        RAISE EXCEPTION 'No tenant schemas found. Nothing to rollback.';
    END IF;

    RAISE NOTICE 'Found % tenant schemas to rollback', schema_count;
END $$;

-- ============================================================
-- 9.2 Restaurar datos de tenant schemas → public
-- ============================================================
-- Solo para las 4 tablas migradas: evaluations, results, courses, students
-- Primero dropear tablas en public si existen (para evitar duplicados)
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

SELECT 'Restoring data from tenant schemas to public...' AS status;

DO $$
DECLARE
    rec RECORD;
    s VARCHAR;
    total_courses INT := 0;
    total_evaluations INT := 0;
    total_students INT := 0;
    total_results INT := 0;
    cnt INT;
BEGIN
    -- Re-crear tablas en public (sin tenant_id)
    CREATE TABLE public.courses (
        id VARCHAR NOT NULL PRIMARY KEY,
        name VARCHAR NOT NULL,
        grade VARCHAR NOT NULL,
        subject VARCHAR NOT NULL,
        teacher_id VARCHAR NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE public.evaluations (
        id VARCHAR NOT NULL PRIMARY KEY,
        title VARCHAR NOT NULL,
        subject VARCHAR NOT NULL,
        grade VARCHAR NOT NULL,
        rubric JSON NOT NULL,
        pdf_url VARCHAR,
        status VARCHAR DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE public.students (
        id VARCHAR NOT NULL PRIMARY KEY,
        course_id VARCHAR NOT NULL,
        full_name VARCHAR NOT NULL,
        student_code VARCHAR NOT NULL,
        rut VARCHAR,
        email VARCHAR,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE public.results (
        id VARCHAR NOT NULL PRIMARY KEY,
        evaluation_id VARCHAR NOT NULL,
        student_code VARCHAR NOT NULL,
        answers JSON,
        confidence DOUBLE PRECISION,
        requires_review BOOLEAN DEFAULT FALSE,
        final_grade DOUBLE PRECISION,
        status VARCHAR DEFAULT 'pending',
        feedback_pdf_url VARCHAR,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Restaurar datos desde cada schema tenant
    -- users, audit_logs, tenant_members NO se restauran (nunca salieron de public)
    FOR rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%' ORDER BY nspname
    LOOP
        s := rec.nspname;

        -- courses (sin tenant_id)
        EXECUTE format(
            'INSERT INTO public.courses (id, name, grade, subject, teacher_id, created_at, updated_at)
             SELECT id, name, grade, subject, teacher_id, created_at, updated_at
             FROM %I.courses',
            s
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_courses := total_courses + cnt;

        -- evaluations (sin tenant_id)
        EXECUTE format(
            'INSERT INTO public.evaluations (id, title, subject, grade, rubric, pdf_url, status, created_at, updated_at)
             SELECT id, title, subject, grade, rubric, pdf_url, status, created_at, updated_at
             FROM %I.evaluations',
            s
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_evaluations := total_evaluations + cnt;

        -- students (no tenant_id)
        EXECUTE format(
            'INSERT INTO public.students (id, course_id, full_name, student_code, rut, email, created_at, updated_at)
             SELECT id, course_id, full_name, student_code, rut, email, created_at, updated_at
             FROM %I.students',
            s
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_students := total_students + cnt;

        -- results (no tenant_id)
        EXECUTE format(
            'INSERT INTO public.results (id, evaluation_id, student_code, answers, confidence, requires_review, final_grade, status, feedback_pdf_url, created_at, updated_at)
             SELECT r.id, r.evaluation_id, r.student_code, r.answers, r.confidence, r.requires_review, r.final_grade, r.status, r.feedback_pdf_url, r.created_at, r.updated_at
             FROM %I.results r',
            s
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_results := total_results + cnt;
    END LOOP;

    RAISE NOTICE 'Restored: % courses, % evaluations, % students, % results',
        total_courses, total_evaluations, total_students, total_results;
    RAISE NOTICE '(users, tenant_members, audit_logs preserved in public — never migrated)';
END $$;

-- ============================================================
-- 9.3 Restaurar constraints e índices originales en public
--     Solo para las 4 tablas restauradas
-- ============================================================
SELECT 'Restoring original constraints and indexes...' AS status;

-- courses (no tenant_id)
CREATE INDEX IF NOT EXISTS ix_courses_teacher_id ON public.courses(teacher_id);

-- evaluations (no tenant_id)
CREATE INDEX IF NOT EXISTS ix_evaluations_status ON public.evaluations(status);

-- students
ALTER TABLE public.students ADD CONSTRAINT students_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_course ON public.students(course_id, student_code);
CREATE INDEX IF NOT EXISTS ix_students_course_id ON public.students(course_id);

-- results
ALTER TABLE public.results ADD CONSTRAINT results_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_results_evaluation_id ON public.results(evaluation_id);
CREATE INDEX IF NOT EXISTS ix_results_status ON public.results(status);

-- ============================================================
-- 9.4 Dropear schemas tenant
-- ============================================================
SELECT 'Dropping tenant schemas...' AS status;

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%' ORDER BY nspname
    LOOP
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', rec.nspname);
        RAISE NOTICE 'Dropped schema: %', rec.nspname;
    END LOOP;
END $$;

-- ============================================================
-- 9.5 Dropear infraestructura de migración
-- ============================================================
SELECT 'Removing migration infrastructure...' AS status;

DROP TABLE IF EXISTS public.user_auth_index CASCADE;
DROP FUNCTION IF EXISTS public.find_user_for_auth(VARCHAR);
DROP FUNCTION IF EXISTS public.tenant_schema_name(VARCHAR);
DROP FUNCTION IF EXISTS public.populate_user_auth_index();
DROP FUNCTION IF EXISTS public.all_users();
DROP FUNCTION IF EXISTS public.setup_new_tenant(VARCHAR);

-- ============================================================
-- 9.6 Verificar estado post-rollback
-- ============================================================
SELECT '9.6 Post-rollback verification' AS status;
SELECT tablename AS tables_in_public
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT COUNT(*) AS total_tenants FROM public.tenants;
SELECT COUNT(*) AS total_users FROM public.users;
SELECT COUNT(*) AS total_tenant_members FROM public.tenant_members;

SELECT 'ROLLBACK COMPLETE' AS final_status;

COMMIT;
