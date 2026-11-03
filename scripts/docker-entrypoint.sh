#!/bin/sh
set -e

if [ "$1" = "backend" ]; then
    echo "Starting MIS Backend on port 8000..."
    cd /app/backend && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
elif [ "$1" = "frontend" ]; then
    echo "Starting MIS Frontend on port 3000..."
    cd /app/frontend && exec node server.js
else
    echo "Starting Meeting Intelligence System (Fullstack)..."
    cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!

    cd /app/frontend && node server.js &
    FRONTEND_PID=$!

    cleanup() {
        echo "Shutting down services..."
        kill -TERM "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
        exit 0
    }

    trap cleanup SIGINT SIGTERM

    wait -n "$BACKEND_PID" "$FRONTEND_PID"
    cleanup
fi
