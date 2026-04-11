#!/bin/bash
set -e

echo "=== POS Go Backend - Build & Run ==="
echo ""

# Check Go version
if ! command -v go &> /dev/null; then
    echo "ERROR: Go is not installed. Install Go 1.24+ from https://go.dev/dl/"
    exit 1
fi
echo "Go version: $(go version)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    exit 1
fi

# Step 1: Start MySQL
echo ""
echo "[1/4] Starting MySQL via Docker..."
docker compose up -d mysql
echo "Waiting for MySQL to be healthy..."
until docker compose exec mysql mysqladmin ping -h localhost --silent 2>/dev/null; do
    sleep 2
    echo "  ...waiting"
done
echo "MySQL is ready!"

# Step 2: Download dependencies
echo ""
echo "[2/4] Downloading Go dependencies..."
go mod tidy

# Step 3: Build
echo ""
echo "[3/4] Building..."
go build -o pos-backend ./cmd/server
echo "Build successful!"

# Step 4: Run
echo ""
echo "[4/4] Starting POS Backend on port 8080..."
echo "  Admin login: admin@pos.com / Admin@123"
echo "  Health check: http://localhost:8080/health"
echo ""
./pos-backend
