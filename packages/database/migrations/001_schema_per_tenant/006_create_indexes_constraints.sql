-- ============================================================
-- STEP 6: CREATE INDEXES & CONSTRAINTS
-- ============================================================
-- Agrega índices, constraints UNIQUE y FKs intra-schema
-- a cada schema tenant_{id}.
--
-- Solo para las 4 tablas que residen en tenant schemas:
--   evaluations, results, courses, students.
--
-- FKs intra-schema:
--   results.evaluation_id   → evaluations.id
--   students.course_id      → courses.id
--
-- NOTA: courses.teacher_id NO tiene FK — referencia a public.users
-- (cross-schema). Es VARCHAR sin constraint.
--
-- UNIQUE constraints:
--   students(course_id, student_code) → único por curso
BEGIN;
SELECT '=== STEP 6: INDEXES & CONSTRAINTS ===' AS step;

DO $$
DECLARE
    rec RECORD;
    s VARCHAR;
BEGIN
    FOR rec IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%' ORDER BY nspname
    LOOP
        s := rec.nspname;
        RAISE NOTICE '--- Adding constraints to schema: %', s;

        -- ==========================================================
        -- 6.1 evaluations constraints & indexes
        -- ==========================================================
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_evaluations_status ON %I.evaluations(status)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_evaluations_subject ON %I.evaluations(subject)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_evaluations_created ON %I.evaluations(created_at DESC)', s);

        -- ==========================================================
        -- 6.2 results constraints & indexes
        -- ==========================================================
        -- evaluation_id → evaluations.id (mismo schema)
        EXECUTE format(
            'ALTER TABLE %I.results ADD CONSTRAINT fk_results_evaluation
             FOREIGN KEY (evaluation_id) REFERENCES %I.evaluations(id) ON DELETE CASCADE',
            s, s
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_results_evaluation ON %I.results(evaluation_id)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_results_status ON %I.results(status)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_results_student ON %I.results(student_code)', s);

        -- ==========================================================
        -- 6.3 courses constraints & indexes
        -- ==========================================================
        -- teacher_id NO tiene FK — referencia a public.users (cross-schema)
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_courses_teacher ON %I.courses(teacher_id)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_courses_subject ON %I.courses(subject)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_courses_created ON %I.courses(created_at DESC)', s);

        -- ==========================================================
        -- 6.4 students constraints & indexes
        -- ==========================================================
        -- course_id → courses.id (mismo schema)
        EXECUTE format(
            'ALTER TABLE %I.students ADD CONSTRAINT fk_students_course
             FOREIGN KEY (course_id) REFERENCES %I.courses(id) ON DELETE CASCADE',
            s, s
        );
        -- Unique: un estudiante aparece una vez por curso
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS uq_student_course ON %I.students(course_id, student_code)',
            s
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_students_course ON %I.students(course_id)', s);
        EXECUTE format('CREATE INDEX IF NOT EXISTS ix_students_code ON %I.students(student_code)', s);

        RAISE NOTICE '✓ All constraints added to %', s;
    END LOOP;

    RAISE NOTICE '✓ All indexes and constraints created successfully';
END $$;

-- Verificar constraints creados
SELECT
    nspname AS schema_name,
    COUNT(*) AS constraint_count
FROM pg_namespace ns
JOIN pg_constraint c ON c.connamespace = ns.oid
WHERE ns.nspname LIKE 'tenant\_%'
GROUP BY nspname
ORDER BY nspname;

COMMIT;
