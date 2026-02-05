#!/bin/bash
# Clean script for DSA Visualizer
# This script removes old/unused Docker images and temporary files

set -e  # Exit on error

echo "🧹 Cleaning up DSA Visualizer..."
echo ""

# Stop running containers
echo "🛑 Stopping containers..."
docker compose down 2>/dev/null || true
echo "✓ Containers stopped"
echo ""

# Remove old/unused images
echo "🗑️  Removing old Docker images..."
docker image prune -f
echo "✓ Old images removed"
echo ""

# Remove dangling images
echo "🗑️  Removing dangling images..."
docker image prune -a -f --filter "dangling=true"
echo "✓ Dangling images removed"
echo ""

# Clean up temporary files
echo "🗑️  Cleaning temporary files..."
rm -rf /tmp/dsa-visualizer/* 2>/dev/null || true
echo "✓ Temporary files cleaned"
echo ""

echo "✅ Cleanup complete!"
echo ""
echo "To rebuild and start:"
echo "  ./build.sh && ./start.sh"
echo ""
