#!/bin/bash
# Start all services for RELEVO + TIZA
cd /home/eandrich/Projects/tiza-project

# Start API
echo "Starting API..."
cd apps/api && source .venv/bin/activate && python run.py &
API_PID=$!

# Start TIZA frontend
echo "Starting TIZA..."
cd /home/eandrich/Projects/tiza-project/apps/tiza-web && npx next dev -p 3001 &
TIZA_PID=$!

# Start RELEVO frontend
echo "Starting RELEVO..."
cd /home/eandrich/Projects/tiza-project/apps/relevo-web && npx next dev -p 3002 &
RELEVO_PID=$!

echo "PIDs: API=$API_PID TIZA=$TIZA_PID RELEVO=$RELEVO_PID"

# Wait for all
wait
