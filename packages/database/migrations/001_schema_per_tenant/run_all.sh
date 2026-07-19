#!/usr/bin/env bash
# ============================================================
# run_all.sh — Orquestador de migración schema-per-tenant
# ============================================================
# Ejecuta los pasos en orden, con verificación entre cada uno.
# Uso: bash run_all.sh [--execute] [--rollback]
#
# Flags:
#   --execute    Ejecuta los pasos destructivos (default: dry-run)
#   --rollback   Ejecuta rollback completo
#   --verify     Solo ejecuta verificación
#
# ⚠️  Siempre hacer backup antes: ./run_all.sh --backup

set -euo pipefail

# ─── Configuración ──────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tiza_dev}"
DB_USER="${DB_USER:-tiza_user}"
DB_PASSWORD="${DB_PASSWORD:-tiza_password}"

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="${MIGRATIONS_DIR}/logs"
STEP_PASSED="${LOG_DIR}/.step_passed"

export PGPASSWORD="${DB_PASSWORD}"
PSQL="psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1 --echo-errors"

# ─── Colores ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Funciones ──────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[FAIL]${NC} $*"; }

step_passed() {
    touch "${STEP_PASSED}.$1"
}

step_is_passed() {
    [ -f "${STEP_PASSED}.$1" ]
}

run_step() {
    local step_num="$1"
    local step_name="$2"
    local sql_file="$3"
    local is_destructive="${4:-false}"

    echo ""
    echo "============================================================"
    echo -e "${BLUE}STEP ${step_num}: ${step_name}${NC}"
    echo "============================================================"

    # Saltar si ya pasó
    if step_is_passed "${step_num}"; then
        info "Step ${step_num} already passed. Skipping."
        return 0
    fi

    # Verificar si el archivo SQL existe
    if [ ! -f "${sql_file}" ]; then
        error "SQL file not found: ${sql_file}"
        return 1
    fi

    # Confirmar pasos destructivos
    if [ "${is_destructive}" = "true" ] && [ "${EXECUTE_MODE}" != "execute" ]; then
        warn "DESTRUCTIVE STEP — requires --execute flag"
        info "  Review: ${sql_file}"
        info "  Run with: bash run_all.sh --execute"
        return 1
    fi

    # Ejecutar
    info "Running: ${sql_file}"
    mkdir -p "${LOG_DIR}"

    if ${PSQL} -f "${sql_file}" > "${LOG_DIR}/step_${step_num}.log" 2>&1; then
        success "Step ${step_num} completed"
        step_passed "${step_num}"
        return 0
    else
        error "Step ${step_num} FAILED"
        warn "Check log: ${LOG_DIR}/step_${step_num}.log"
        tail -50 "${LOG_DIR}/step_${step_num}.log"
        return 1
    fi
}

# ─── Parse flags ─────────────────────────────────────────────
EXECUTE_MODE="dry-run"
ACTION="migrate"

for arg in "$@"; do
    case "$arg" in
        --execute) EXECUTE_MODE="execute" ;;
        --rollback) ACTION="rollback" ;;
        --verify) ACTION="verify" ;;
        --backup) ACTION="backup" ;;
        *) warn "Unknown flag: $arg" ;;
    esac
done

# ─── Main ────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
rm -f "${STEP_PASSED}".*

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Schema-Per-Tenant Migration                     ║${NC}"
echo -e "${BLUE}║  DB: ${DB_NAME}@${DB_HOST}:${DB_PORT}                    ║${NC}"
echo -e "${BLUE}║  Mode: ${EXECUTE_MODE}                                   ║${NC}"
echo -e "${BLUE}║  Action: ${ACTION}                                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

case "${ACTION}" in
    # ==========================================================
    # BACKUP
    # ==========================================================
    backup)
        BACKUP_FILE="${MIGRATIONS_DIR}/backup_${TIMESTAMP}.dump"
        info "Creating backup: ${BACKUP_FILE}"
        pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -F c -f "${BACKUP_FILE}"
        success "Backup created: ${BACKUP_FILE}"
        info "Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
        ;;

    # ==========================================================
    # VERIFY ONLY
    # ==========================================================
    verify)
        run_step "07" "Verification" "${MIGRATIONS_DIR}/007_verify.sql"
        ;;

    # ==========================================================
    # ROLLBACK
    # ==========================================================
    rollback)
        warn "⚠️  ROLLBACK - This will DESTROY all tenant schemas ⚠️"
        warn "⚠️  Data will be restored to public schema       ⚠️"
        echo ""
        if [ "${EXECUTE_MODE}" != "execute" ]; then
            error "Add --execute to confirm rollback"
            exit 1
        fi

        run_step "09" "Rollback" "${MIGRATIONS_DIR}/009_rollback.sql" "true"
        ;;

    # ==========================================================
    # MIGRATE
    # ==========================================================
    migrate|*)
        # STEP 1: Preflight (siempre ejecuta)
        run_step "01" "Preflight" "${MIGRATIONS_DIR}/001_preflight.sql" || exit 1

        # STEP 2: Infrastructure
        run_step "02" "Infrastructure" "${MIGRATIONS_DIR}/002_create_infrastructure.sql" || exit 1

        # STEP 3: Create schemas
        run_step "03" "Create Schemas" "${MIGRATIONS_DIR}/003_generate_tenant_schemas.sql" "true" || exit 1

        # STEP 4: Create tables
        run_step "04" "Create Tables" "${MIGRATIONS_DIR}/004_create_tenant_tables.sql" "true" || exit 1

        # STEP 5: Migrate data
        run_step "05" "Migrate Data" "${MIGRATIONS_DIR}/005_migrate_data.sql" "true" || exit 1

        # STEP 6: Indexes & Constraints
        run_step "06" "Indexes & Constraints" "${MIGRATIONS_DIR}/006_create_indexes_constraints.sql" "true" || exit 1

        # STEP 7: Verify
        run_step "07" "Verification" "${MIGRATIONS_DIR}/007_verify.sql" || exit 1

        # STEP 8: Cleanup (solo si verify pasó)
        run_step "08" "Cleanup" "${MIGRATIONS_DIR}/008_cleanup.sql" "true" || exit 1

        # Verify final
        echo ""
        echo "============================================================"
        echo -e "${GREEN}✅ MIGRATION COMPLETE${NC}"
        echo "============================================================"
        echo ""
        info "Next steps:"
        info "  1. Update application code (see README.md)"
        info "  2. Update Prisma schema (users/audit_logs/tenant_members stay in public)"
        info "  3. Update SQLAlchemy models (evaluations/courses now have tenant_id in tenant schemas)"
        info "  4. Run tests"
        echo ""

        rm -f "${STEP_PASSED}".*
        ;;
esac
