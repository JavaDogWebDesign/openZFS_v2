#!/usr/bin/env bash
set -euo pipefail

# ZFS Storage Manager — Installation Script
# Target: Debian 12 (Bookworm) with ZFS already installed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== ZFS Storage Manager Installer ==="
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root."
  exit 1
fi

# Check Debian
if ! grep -q 'ID=debian' /etc/os-release 2>/dev/null; then
  echo "WARNING: This script is designed for Debian 12. Proceed with caution."
fi

# Check ZFS
if ! command -v zpool &>/dev/null; then
  echo "ERROR: ZFS is not installed. Please install zfsutils-linux first."
  exit 1
fi

echo "1. Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
  nodejs npm \
  libpam0g-dev \
  smartmontools \
  samba \
  nfs-kernel-server \
  acl \
  2>/dev/null

# Ensure Node.js >= 18
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required. Found: $(node -v)"
  echo "Install via NodeSource: https://github.com/nodesource/distributions"
  exit 1
fi

echo "2. Installing npm dependencies..."
cd "$PROJECT_DIR"
npm install

echo "3. Building packages..."
npm run build

echo "4. Setting up environment..."
if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  # Generate random session secret
  SESSION_SECRET=$(openssl rand -hex 32)
  sed -i "s/change-me-to-a-random-string/$SESSION_SECRET/" "$PROJECT_DIR/.env"
  echo "   Created .env with random session secret"
fi

echo "5. Creating data directory..."
mkdir -p "$PROJECT_DIR/data"

echo "6. Setting up Samba include directory..."
mkdir -p /etc/samba/smb.conf.d
if ! grep -q 'include = /etc/samba/smb.conf.d' /etc/samba/smb.conf 2>/dev/null; then
  echo "include = /etc/samba/smb.conf.d/*.conf" >> /etc/samba/smb.conf
  echo "   Added include directive to smb.conf"
fi

echo "7. Setting up NFS exports directory..."
mkdir -p /etc/exports.d

echo ""
echo "=== Installation Complete ==="
echo ""
echo "To start the application:"
echo "  cd $PROJECT_DIR && npm run dev"
echo ""
echo "Or for production:"
echo "  cd $PROJECT_DIR && npm run build && NODE_ENV=production node server/dist/index.js"
echo ""
