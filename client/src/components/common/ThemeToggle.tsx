import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  return (
    <button
      onClick={cycle}
      className={cn(
        'rounded-md p-2 text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
      aria-label={`Switch theme (current: ${theme})`}
      title={`Theme: ${theme}`}
    >
      {theme === 'light' && <Sun className="h-4 w-4" />}
      {theme === 'dark' && <Moon className="h-4 w-4" />}
      {theme === 'system' && <Monitor className="h-4 w-4" />}
    </button>
  );
}
