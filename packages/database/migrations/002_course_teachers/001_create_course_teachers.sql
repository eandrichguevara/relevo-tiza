-- ============================================================
-- MIGRATION 002: Course Teachers (per-subject teacher assignment)
-- ============================================================
-- Creates course_teachers table, migrates existing teacher_id data,
-- then drops the deprecated teacher_id column from courses.
--
-- Execution (for each tenant schema + public):
--   psql -f 001_create_course_teachers.sql
-- ============================================================
BEGIN;

SELECT '=== MIGRATION 002: COURSE TEACHERS ===' AS step;

-- ── Step 1: Create course_teachers table ──────────────────────
CREATE TABLE IF NOT EXISTS {schema}.course_teachers (
    course_id VARCHAR NOT NULL REFERENCES {schema}.courses(id) ON DELETE CASCADE,
    subject VARCHAR NOT NULL,
    teacher_id VARCHAR NOT NULL,
    UNIQUE(course_id, subject)
);

CREATE INDEX IF NOT EXISTS ix_course_teachers_teacher_id
    ON {schema}.course_teachers (teacher_id);

-- ── Step 2: Migrate existing data ─────────────────────────────
-- For each course with a teacher_id, create one row per
-- comma-separated subject. Assumes subject format like
-- "Lenguaje, Matemáticas" (comma+space separated).
INSERT INTO {schema}.course_teachers (course_id, subject, teacher_id)
SELECT
    id,
    unnest(string_to_array(subject, ', ')),
    teacher_id
FROM {schema}.courses
WHERE teacher_id IS NOT NULL;

-- ── Step 3: Remove deprecated column ──────────────────────────
ALTER TABLE {schema}.courses DROP COLUMN IF EXISTS teacher_id;

-- ── Verification ──────────────────────────────────────────────
SELECT
    'course_teachers' AS table_name,
    COUNT(*) AS row_count
FROM {schema}.course_teachers;

COMMIT;
