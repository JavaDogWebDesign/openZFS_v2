# ZFS Storage Manager

Web-based management interface for OpenZFS on Debian 12.

## Quick Start (Development)

```bash
npm install
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **Health check**: http://localhost:3001/api/health

## Production (Debian 12)

```bash
# Requires: ZFS, Node.js 18+, Samba, NFS
sudo ./scripts/install.sh
cp .env.example .env   # edit SESSION_SECRET
npm run build
NODE_ENV=production node server/dist/index.js
```

## Project Structure

```
shared/   — TypeScript types & constants (used by both server and client)
server/   — Express + Socket.IO + better-sqlite3 backend
client/   — React + Vite + Tailwind frontend
scripts/  — Install/uninstall helpers
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `SESSION_SECRET` | — | Required. Random string for session signing |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `DB_PATH` | `./data/zfs-manager.db` | SQLite database path |
| `LOG_LEVEL` | `info` | winston log level |

## Authentication

Login uses PAM — authenticate with any system user. Users in the `sudo` or `wheel` group get admin privileges.
