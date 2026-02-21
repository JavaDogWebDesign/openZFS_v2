#!/usr/bin/env bash
set -euo pipefail

# ZFS Storage Manager — Uninstall Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== ZFS Storage Manager Uninstaller ==="
echo ""
echo "This will remove the application data but NOT system packages."
echo ""

read -r -p "Are you sure? [y/N] " response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "1. Removing application data..."
rm -rf "$PROJECT_DIR/data"
rm -f "$PROJECT_DIR/.env"

echo "2. Removing node_modules..."
rm -rf "$PROJECT_DIR/node_modules"
rm -rf "$PROJECT_DIR/shared/node_modules"
rm -rf "$PROJECT_DIR/server/node_modules"
rm -rf "$PROJECT_DIR/client/node_modules"

echo "3. Removing build artifacts..."
rm -rf "$PROJECT_DIR/shared/dist"
rm -rf "$PROJECT_DIR/server/dist"
rm -rf "$PROJECT_DIR/client/dist"

echo ""
echo "=== Uninstall Complete ==="
echo ""
echo "System packages (samba, nfs-kernel-server, etc.) were NOT removed."
echo "Remove them manually if desired."
echo ""
