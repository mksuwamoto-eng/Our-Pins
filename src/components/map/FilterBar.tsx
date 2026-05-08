'use client';

import { useTranslations } from 'next-intl';
import { useFiltersStore } from '@/stores/filters';
import type { Category } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export function FilterBar({ categories }: { categories: Category[] }) {
  const t = useTranslations('map');
  const { categoryIds, setCategoryIds, search, setSearch } = useFiltersStore();

  function toggle(id: string) {
    setCategoryIds(categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id]);
  }

  return (
    <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-col gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`${t('filters')}…`}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 text-sm shadow-sm backdrop-blur"
      />
      <div className="flex flex-wrap gap-1">
        {categories.map((c) => {
          const active = categoryIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                active
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)]/95 text-[var(--fg)]',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
