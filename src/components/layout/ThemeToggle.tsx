'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const t = useTranslations('header');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const current = resolvedTheme ?? theme ?? 'light';
  const next = current === 'dark' ? 'light' : 'dark';

  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={t('toggleTheme')}
      className="rounded p-1"
    >
      {current === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
