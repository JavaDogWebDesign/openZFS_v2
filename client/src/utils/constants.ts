import {
  LayoutDashboard,
  Database,
  HardDrive,
  Layers,
  Camera,
  Share2,
  Users,
  UsersRound,
  Settings,
} from 'lucide-react';

/**
 * API base URL - proxied through Vite dev server in development.
 */
export const API_BASE = '/api';

/**
 * Socket.IO connection URL.
 */
export const SOCKET_URL = '/';

/**
 * Navigation items for the sidebar.
 */
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Pools', path: '/pools', icon: Database },
  { label: 'Drives', path: '/drives', icon: HardDrive },
  { label: 'Datasets', path: '/datasets', icon: Layers },
  { label: 'Snapshots', path: '/snapshots', icon: Camera },
  { label: 'Shares', path: '/shares', icon: Share2 },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Groups', path: '/groups', icon: UsersRound },
  { label: 'Settings', path: '/settings', icon: Settings },
] as const;

/**
 * Default pagination page size.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Maximum number of data points to show in real-time charts.
 */
export const MAX_CHART_DATA_POINTS = 60;

/**
 * Polling interval for non-WebSocket data refresh (milliseconds).
 */
export const POLL_INTERVAL = 30000;

/**
 * Local storage keys.
 */
export const STORAGE_KEYS = {
  THEME: 'zfs-manager-theme',
  SIDEBAR_COLLAPSED: 'zfs-manager-sidebar-collapsed',
} as const;
