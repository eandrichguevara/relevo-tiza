#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT_DIR}/.pids"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Deteniendo todos los servicios de RELEVO + TIZA...${NC}"
echo ""

stopped=0

# ─── Detener por PID ──────────────────────────────────────────────────
stop_by_pid() {
    local pid_file=$1 name=$2
    if [ -f "${pid_file}" ]; then
        local pid=$(cat "${pid_file}")
        if kill -0 "${pid}" 2>/dev/null; then
            kill "${pid}" 2>/dev/null || true
            sleep 1
            if kill -0 "${pid}" 2>/dev/null; then
                kill -9 "${pid}" 2>/dev/null || true
            fi
            echo -e "  ${GREEN}✓${NC} ${name} detenido (PID: ${pid})"
            stopped=$((stopped + 1))
        else
            echo -e "  ${YELLOW}−${NC} ${name} ya estaba detenido"
        fi
        rm -f "${pid_file}"
    fi
}

stop_by_pid "${PID_DIR}/api.pid" "API :8000"
stop_by_pid "${PID_DIR}/tiza-web.pid" "tiza-web :3001"
stop_by_pid "${PID_DIR}/relevo-web.pid" "relevo-web :3002"

# ─── Detener por puerto (fallback) ────────────────────────────────────
stop_by_port() {
    local port=$1 name=$2
    local pids=$(lsof -ti:${port} 2>/dev/null || true)
    if [ -n "${pids}" ]; then
        echo "${pids}" | while read pid; do
            kill "${pid}" 2>/dev/null || true
        done
        sleep 1
        # Force kill if still alive
        local remaining=$(lsof -ti:${port} 2>/dev/null || true)
        if [ -n "${remaining}" ]; then
            echo "${remaining}" | while read pid; do
                kill -9 "${pid}" 2>/dev/null || true
            done
        fi
        echo -e "  ${GREEN}✓${NC} ${name} (puerto ${port}) liberado"
        stopped=$((stopped + 1))
    fi
}

stop_by_port 8000 "API :8000 (fallback)"
stop_by_port 3001 "tiza-web :3001 (fallback)"
stop_by_port 3002 "relevo-web :3002 (fallback)"

# ─── Docker ───────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}📦 Deteniendo servicios Docker...${NC}"
if docker compose -f "${ROOT_DIR}/docker-compose.yml" down 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker Compose detenido"
elif pkexec docker compose -f "${ROOT_DIR}/docker-compose.yml" down 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker Compose detenido"
else
    echo -e "  ${YELLOW}⚠${NC}  No se pudo detener Docker Compose (¿ya estaba detenido?)"
fi

echo ""
echo -e "${GREEN}✅ Todos los servicios detenidos.${NC}"
