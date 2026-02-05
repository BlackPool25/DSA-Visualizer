#!/bin/bash
# Build script for DSA Visualizer
# This script builds all Docker images and tags them correctly

set -e  # Exit on error

echo "🏗️  Building DSA Visualizer Docker images..."
echo ""

# Build executor first (backend depends on it)
echo "📦 Building executor image..."
docker compose build --no-cache executor
docker tag dsa-visualiser_executor:latest dsa-executor:latest
echo "✓ Executor image built and tagged"
echo ""

# Build backend
echo "📦 Building backend image..."
docker compose build backend
echo "✓ Backend image built"
echo ""

# Build frontend
echo "📦 Building frontend image..."
docker compose build frontend
echo "✓ Frontend image built"
echo ""

echo "✅ All images built successfully!"
echo ""
echo "To start the services, run:"
echo "  ./start.sh"
echo ""
