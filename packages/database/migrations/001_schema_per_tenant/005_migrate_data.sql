-- ============================================================
-- STEP 5: Migrate Data from public to Tenant Schemas
-- ============================================================
-- Para cada tenant, copia los datos de public.{tabla} a
-- tenant_{id}.{tabla}.
--
-- Solo se migran 4 tablas: courses, evaluations, students, results.
-- users, audit_logs y tenant_members se quedan en public.
--
-- evaluations y courses incluyen tenant_id (defensa en profundidad).
--
-- Orden de migración (respetando FKs):
--   1. courses     → referenced by: students
--   2. evaluations → referenced by: results
--   3. students    → depends on courses
--   4. results     → depends on evaluations
BEGIN;
SELECT '=== STEP 5: MIGRATE DATA ===' AS step;

DO $$
DECLARE
    rec RECORD;
    s VARCHAR;       -- schema name
    tid VARCHAR;     -- tenant id
    cnt INT;
    total_courses INT := 0;
    total_evaluations INT := 0;
    total_students INT := 0;
    total_results INT := 0;
BEGIN
    FOR rec IN SELECT id, subdomain FROM public.tenants ORDER BY subdomain
    LOOP
        s := 'tenant_' || rec.id;
        tid := rec.id;

        RAISE NOTICE '--- Migrating tenant: % (schema: %)', rec.subdomain, s;

        -- ==========================================================
        -- 5.1 courses (sin tenant_id — el schema aísla los datos)
        -- teacher_id se migra como VARCHAR (referencia a public.users)
        -- ==========================================================
        EXECUTE format(
            'INSERT INTO %I.courses (id, name, grade, subject, teacher_id, created_at, updated_at)
             SELECT id, name, grade, subject, teacher_id, created_at, updated_at
             FROM public.courses
             WHERE tenant_id = %L',
            s, tid
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_courses := total_courses + cnt;
        RAISE NOTICE '  → courses: % rows', cnt;

        -- ==========================================================
        -- 5.2 evaluations (sin tenant_id — el schema aísla los datos)
        -- ==========================================================
        EXECUTE format(
            'INSERT INTO %I.evaluations (id, title, subject, grade, rubric, pdf_url, status, created_at, updated_at)
             SELECT id, title, subject, grade, rubric, pdf_url, status, created_at, updated_at
             FROM public.evaluations
             WHERE tenant_id = %L',
            s, tid
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_evaluations := total_evaluations + cnt;
        RAISE NOTICE '  → evaluations: % rows', cnt;

        -- ==========================================================
        -- 5.3 students (no tenant_id — join con courses para filtrar)
        -- ==========================================================
        EXECUTE format(
            'INSERT INTO %I.students (id, course_id, full_name, student_code, rut, email, created_at, updated_at)
             SELECT s.id, s.course_id, s.full_name, s.student_code, s.rut, s.email, s.created_at, s.updated_at
             FROM public.students s
             JOIN public.courses c ON c.id = s.course_id
             WHERE c.tenant_id = %L',
            s, tid
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_students := total_students + cnt;
        RAISE NOTICE '  → students: % rows', cnt;

        -- ==========================================================
        -- 5.4 results (no tenant_id — join con evaluations para filtrar)
        -- ==========================================================
        EXECUTE format(
            'INSERT INTO %I.results (id, evaluation_id, student_code, answers, confidence,
                                     requires_review, final_grade, status, feedback_pdf_url,
                                     created_at, updated_at)
             SELECT r.id, r.evaluation_id, r.student_code, r.answers, r.confidence,
                    r.requires_review, r.final_grade, r.status, r.feedback_pdf_url,
                    r.created_at, r.updated_at
             FROM public.results r
             JOIN public.evaluations e ON e.id = r.evaluation_id
             WHERE e.tenant_id = %L',
            s, tid
        );
        GET DIAGNOSTICS cnt = ROW_COUNT;
        total_results := total_results + cnt;
        RAISE NOTICE '  → results: % rows', cnt;

    END LOOP;

    -- Reporte final
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'MIGRATION SUMMARY:';
    RAISE NOTICE '  courses:        % rows', total_courses;
    RAISE NOTICE '  evaluations:    % rows', total_evaluations;
    RAISE NOTICE '  students:       % rows', total_students;
    RAISE NOTICE '  results:        % rows', total_results;
    RAISE NOTICE '  (users, audit_logs, tenant_members: se quedan en public)';
    RAISE NOTICE '==========================================';
END $$;

COMMIT;
