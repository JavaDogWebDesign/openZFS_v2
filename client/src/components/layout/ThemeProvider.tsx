import type { ReactNode } from 'react';
import { ThemeProviderImpl, type Theme } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'zfs-manager-theme',
}: ThemeProviderProps) {
  return (
    <ThemeProviderImpl defaultTheme={defaultTheme} storageKey={storageKey}>
      {children}
    </ThemeProviderImpl>
  );
}
