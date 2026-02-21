import { useLocation, Link } from 'react-router-dom';
import { LogOut, User, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

/**
 * Build breadcrumb segments from the current URL path.
 */
function buildBreadcrumbs(pathname: string): Array<{ label: string; path: string }> {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Array<{ label: string; path: string }> = [
    { label: 'Home', path: '/' },
  ];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    crumbs.push({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      path: currentPath,
    });
  }

  return crumbs;
}

export function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const breadcrumbs = buildBreadcrumbs(location.pathname);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path} className="flex items-center">
            {index > 0 && <ChevronRight className="mx-1 h-4 w-4" />}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center space-x-3">
        <ThemeToggle />

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              'flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <User className="h-4 w-4" />
            <span>{user?.username ?? 'Unknown'}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-popover p-1 shadow-lg">
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border mb-1">
                Signed in as <span className="font-medium text-foreground">{user?.username}</span>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
