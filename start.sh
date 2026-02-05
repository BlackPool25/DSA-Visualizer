#!/bin/bash
# Start script for DSA Visualizer
# This script starts all services using Docker Compose v2

set -e  # Exit on error

echo "🚀 Starting DSA Visualizer..."
echo ""

# Check if images exist
if ! docker image inspect dsa-executor:latest >/dev/null 2>&1; then
    echo "⚠️  Docker images not found. Building them first..."
    ./build.sh
fi

echo "📦 Starting services with Docker Compose..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 3

echo ""
echo "✅ DSA Visualizer is running!"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo ""
echo "📊 View logs:"
echo "   docker compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker compose down"
echo ""
