'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';
import { useFiltersStore } from '@/stores/filters';
import type { Category } from '@/lib/supabase/types';
import { categoryLabel } from '@/lib/i18n/category';
import { categoryIcon } from '@/lib/categories/icons';
import { cn } from '@/lib/utils';

// Replaces the old all-chips-at-once row. A single dropdown that stays tidy as
// categories grow, shows a live count per category, and colours each row with
// the same category colour the map markers use (supabase/seed.sql → color).
export function CategoryFilter({
  categories,
  counts,
}: {
  categories: Category[];
  counts: Record<string, number>;
}) {
  const t = useTranslations('map');
  const tc = useTranslations('categories');
  const { categoryIds, setCategoryIds } = useFiltersStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click (no backdrop — avoids z-index fights with the other
  // filter controls in the same absolutely-positioned bar).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function toggle(id: string) {
    setCategoryIds(
      categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id],
    );
  }

  const selectedCount = categoryIds.length;
  const label =
    selectedCount === 0 ? t('allCategories') : t('nSelected', { count: selectedCount });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('categoryFilter')}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm shadow-sm backdrop-blur',
          selectedCount
            ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
            : 'border-[var(--border)] bg-[var(--surface)]/95 text-[var(--fg)]',
        )}
      >
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
          {selectedCount > 0 ? (
            <button
              onClick={() => setCategoryIds([])}
              className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
            >
              {t('clearCategories')}
            </button>
          ) : null}
          {categories.map((c) => {
            const active = categoryIds.includes(c.id);
            const count = counts[c.id] ?? 0;
            const Icon = categoryIcon(c.icon);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-subtle)]',
                  count === 0 && !active && 'opacity-40',
                )}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: c.color }}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="flex-1 truncate">{categoryLabel(tc, c)}</span>
                <span className="text-xs tabular-nums text-[var(--muted)]">{count}</span>
                {active ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
