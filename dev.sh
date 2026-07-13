#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="${ROOT_DIR}/.pids"
LOG_DIR="${ROOT_DIR}/.logs"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
    echo -e "\n${YELLOW}🛑 Deteniendo servicios...${NC}"
    bash "${ROOT_DIR}/scripts/stop-dev.sh" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

mkdir -p "${PID_DIR}" "${LOG_DIR}"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     RELEVO + TIZA — Entorno de Desarrollo       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Infraestructura (Docker) ──────────────────────────────────────
echo -e "${YELLOW}[1/5] Levantando infraestructura (PostgreSQL + Redis)...${NC}"

# Verificar si ya están corriendo
if docker compose -f "${ROOT_DIR}/docker-compose.yml" ps --status running 2>/dev/null | grep -q "tiza-"; then
    echo -e "  ${GREEN}✓${NC} Servicios Docker ya están corriendo"
else
    if docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Docker Compose levantado"
    elif pkexec docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Docker Compose levantado (vía pkexec)"
    else
        echo -e "  ${RED}✗${NC} No se pudo levantar Docker. ¿Tienes Docker instalado?"
        exit 1
    fi
fi

# Esperar a que estén healthy
echo -n "  Esperando a que PostgreSQL + Redis estén healthy"
for i in $(seq 1 30); do
    if docker compose -f "${ROOT_DIR}/docker-compose.yml" ps 2>/dev/null | grep -q "healthy" || \
       pkexec docker compose -f "${ROOT_DIR}/docker-compose.yml" ps 2>/dev/null | grep -q "healthy"; then
        POSTGRES_HEALTHY=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" ps 2>/dev/null | grep "postgres" | grep -c "healthy" || echo 0)
        REDIS_HEALTHY=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" ps 2>/dev/null | grep "redis" | grep -c "healthy" || echo 0)
        if [ "$POSTGRES_HEALTHY" -ge 1 ] && [ "$REDIS_HEALTHY" -ge 1 ]; then
            echo ""
            echo -e "  ${GREEN}✓${NC} PostgreSQL + Redis listos"
            break
        fi
    fi
    echo -n "."
    sleep 1
done
echo ""

# ─── 2. Dependencias ──────────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Instalando dependencias...${NC}"
pnpm install --silent 2>&1 | tail -1 || pnpm install 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} Dependencias Node.js listas"

# Verificar venv de Python
if [ -f "${ROOT_DIR}/apps/api/.venv/bin/python" ]; then
    "${ROOT_DIR}/apps/api/.venv/bin/python" -c "import fastapi" 2>/dev/null && \
        echo -e "  ${GREEN}✓${NC} Dependencias Python listas" || \
        echo -e "  ${YELLOW}⚠${NC}  Ejecuta: cd apps/api && .venv/bin/pip install -r requirements.txt"
fi

# ─── 3. API (FastAPI) ─────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Levantando API (FastAPI :8000)...${NC}"

if lsof -ti:8000 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API ya está corriendo en puerto 8000"
else
    nohup "${ROOT_DIR}/apps/api/.venv/bin/uvicorn" main:app \
        --host 0.0.0.0 --port 8000 --reload \
        > "${LOG_DIR}/api.log" 2>&1 &
    echo $! > "${PID_DIR}/api.pid"
    echo -e "  ${GREEN}✓${NC} API iniciada (PID: $(cat "${PID_DIR}/api.pid"))"
fi

# ─── 4. tiza-web (Next.js :3001) ──────────────────────────────────────
echo -e "${YELLOW}[4/5] Levantando tiza-web (Next.js :3001)...${NC}"

if lsof -ti:3001 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} tiza-web ya está corriendo en puerto 3001"
else
    nohup npx next dev -p 3001 \
        > "${LOG_DIR}/tiza-web.log" 2>&1 &
    echo $! > "${PID_DIR}/tiza-web.pid"
    echo -e "  ${GREEN}✓${NC} tiza-web iniciado (PID: $(cat "${PID_DIR}/tiza-web.pid"))"
fi

# ─── 5. relevo-web (Next.js :3002) ────────────────────────────────────
echo -e "${YELLOW}[5/5] Levantando relevo-web (Next.js :3002)...${NC}"

if lsof -ti:3002 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} relevo-web ya está corriendo en puerto 3002"
else
    nohup npx next dev -p 3002 \
        > "${LOG_DIR}/relevo-web.log" 2>&1 &
    echo $! > "${PID_DIR}/relevo-web.pid"
    echo -e "  ${GREEN}✓${NC} relevo-web iniciado (PID: $(cat "${PID_DIR}/relevo-web.pid"))"
fi

# ─── Verificar que todo esté respondiendo ─────────────────────────────
echo ""
echo -e "${YELLOW}⏳ Esperando que todos los servicios respondan...${NC}"
sleep 3

check_http() {
    local port=$1 name=$2
    for i in $(seq 1 20); do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}" 2>/dev/null | grep -q "200\|302\|301\|304\|307"; then
            echo -e "  ${GREEN}✓${NC} ${name} → http://localhost:${port}"
            return 0
        fi
        sleep 1
    done
    echo -e "  ${RED}✗${NC} ${name} → http://localhost:${port} (no responde)"
    return 1
}

check_http 8000 "API (FastAPI)"
check_http 3001 "tiza-web (Profesores)"
check_http 3002 "relevo-web (Sostenedores)"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ✅  Todos los servicios listos para desarrollar  ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  🌐  Profesores:    http://localhost:3001         ║${NC}"
echo -e "${CYAN}║  🏢  Sostenedores:  http://localhost:3002         ║${NC}"
echo -e "${CYAN}║  🔌  API:           http://localhost:8000/docs     ║${NC}"
echo -e "${CYAN}║  📦  PostgreSQL:    localhost:5432                 ║${NC}"
echo -e "${CYAN}║  ⚡  Redis:         localhost:6379                 ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  📋  Logs:          .logs/                         ║${NC}"
echo -e "${CYAN}║  🛑  Detener todo:  bash scripts/stop-dev.sh       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Presiona Ctrl+C para detener todos los servicios${NC}"
echo ""

# Mantener el script corriendo (y los servicios con él)
wait
